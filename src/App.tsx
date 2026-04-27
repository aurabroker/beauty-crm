import { useState, useEffect } from 'react';
import { useCRMStore } from './store/useCRMStore';
import type { Company } from './data/companies';
import { Dashboard } from './components/Dashboard';
import { Pipeline } from './components/Pipeline';
import { CompanyDrawer } from './components/CompanyDrawer';
import { Calendar } from './components/Calendar';
import { Reports } from './components/Reports';
import { AdminPanel } from './components/AdminPanel';

type View = 'dashboard' | 'pipeline' | 'calendar' | 'reports' | 'admin';

const NAV: { key: View; label: string }[] = [
  { key:'dashboard', label:'Firmy' },
  { key:'pipeline',  label:'Pipeline' },
  { key:'calendar',  label:'Kalendarz' },
  { key:'reports',   label:'Raporty' },
  { key:'admin',     label:'Admin' },
];

export default function App() {
  const { currentUser, users, setCurrentUser, companies, loadData, loading } = useCRMStore();
  const [view, setView] = useState<View>('dashboard');
  const [selectedCompany, setSelectedCompany] = useState<Company|null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => { loadData(); }, []);

  const freshCompany = selectedCompany ? companies.find(c=>c.id===selectedCompany.id)??selectedCompany : null;
  const totalReminders = companies.reduce((s,c)=>s+c.reminders.filter(r=>!r.done).length,0);

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-zinc-950">
      <div className="text-center">
        <div className="text-white font-black text-2xl tracking-tight mb-2">CRM</div>
        <div className="text-zinc-500 text-sm">Ładowanie...</div>
        <div className="mt-4 w-48 h-0.5 bg-zinc-800 mx-auto overflow-hidden">
          <div className="h-full bg-amber-400 animate-pulse w-full"/>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-zinc-100 overflow-hidden font-sans">
      {/* TOP MENU */}
      <header className="bg-zinc-950 text-white flex-shrink-0">
        <div className="flex items-center h-12 px-4 gap-0">
          {/* Logo */}
          <div className="font-black text-base tracking-tight mr-6 flex-shrink-0">
            <span className="text-white">CRM</span>
            <span className="text-pink-400 text-xs font-medium ml-1.5 uppercase tracking-widest">BeautyPolisa</span>
          </div>
          {/* Nav */}
          <nav className="flex h-full">
            {NAV.map(item => {
              if (item.key==='admin' && currentUser?.role!=='admin') return null;
              return (
                <button key={item.key} onClick={()=>setView(item.key)}
                  className={`h-full px-4 text-sm font-medium transition-colors relative flex items-center gap-1.5 ${view===item.key?'text-white bg-zinc-800':'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}>
                  {item.label}
                  {item.key==='calendar' && totalReminders>0 && (
                    <span className="bg-amber-400 text-zinc-900 text-[10px] font-bold px-1.5 min-w-[18px] text-center">{totalReminders}</span>
                  )}
                  {view===item.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400"/>}
                </button>
              );
            })}
          </nav>
          {/* Right side */}
          <div className="ml-auto flex items-center gap-3">
            <button onClick={()=>loadData()} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">↻</button>
            <span className="text-xs text-zinc-600">{companies.length} firm</span>
            {/* User switcher */}
            <div className="relative">
              <button onClick={()=>setShowUserMenu(p=>!p)}
                className="flex items-center gap-2 px-2 py-1 hover:bg-zinc-800 transition-colors">
                <div className="w-7 h-7 flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: currentUser?.color??'#374151' }}>
                  {currentUser?.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <span className="text-sm text-zinc-300 hidden sm:block">{currentUser?.name}</span>
                <span className="text-zinc-500 text-xs">▾</span>
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-zinc-900 border border-zinc-700 shadow-xl z-50">
                  <div className="px-3 py-2 text-xs text-zinc-500 uppercase tracking-widest border-b border-zinc-800">Przełącz użytkownika</div>
                  {users.map(u => (
                    <button key={u.id} onClick={()=>{setCurrentUser(u);setShowUserMenu(false);}}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors ${currentUser?.id===u.id?'bg-zinc-800 text-white':'text-zinc-300 hover:bg-zinc-800'}`}>
                      <div className="w-6 h-6 flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ backgroundColor: u.color }}>
                        {u.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                      </div>
                      <div>
                        <div>{u.name}</div>
                        <div className="text-xs text-zinc-500">{u.role}</div>
                      </div>
                      {currentUser?.id===u.id && <span className="ml-auto text-amber-400 text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-hidden p-5" onClick={()=>showUserMenu&&setShowUserMenu(false)}>
        {view==='dashboard' && <Dashboard onSelectCompany={setSelectedCompany}/>}
        {view==='pipeline'  && <Pipeline onSelectCompany={setSelectedCompany}/>}
        {view==='calendar'  && <Calendar onSelectCompany={setSelectedCompany}/>}
        {view==='reports'   && <Reports/>}
        {view==='admin'     && <AdminPanel/>}
      </main>

      {freshCompany && <CompanyDrawer company={freshCompany} onClose={()=>setSelectedCompany(null)}/>}
    </div>
  );
}
