import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { useCRMStore } from './store/useCRMStore';
import type { Company } from './data/companies';
import { LoginPage } from './components/LoginPage';
import { LeadForm } from './components/LeadForm';
import { Dashboard } from './components/Dashboard';
import { Pipeline } from './components/Pipeline';
import { CompanyDrawer } from './components/CompanyDrawer';
import { Calendar } from './components/Calendar';
import { Reports } from './components/Reports';
import { AdminPanel } from './components/AdminPanel';
import { Clients } from './components/Clients';

type View = 'dashboard' | 'pipeline' | 'klienci' | 'calendar' | 'reports' | 'admin';

const NAV: { key: View; label: string }[] = [
  { key:'dashboard', label:'Firmy' },
  { key:'pipeline',  label:'Pipeline' },
  { key:'klienci',   label:'Klienci' },
  { key:'calendar',  label:'Kalendarz' },
  { key:'reports',   label:'Raporty' },
  { key:'admin',     label:'Admin' },
];

// Detect if we're on the public form URL
const isPublicForm = window.location.pathname === '/formularz' || window.location.search.includes('form=1');

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, []);

  // Public form — no auth needed
  if (isPublicForm) return <LeadForm />;

  if (authLoading) return (
    <div className="flex h-screen items-center justify-center bg-zinc-950">
      <div className="text-zinc-500 text-sm">Ładowanie...</div>
    </div>
  );

  if (!session) return <LoginPage onLogin={() => {}} />;

  return <CRMApp />;
}

function CRMApp() {
  const { currentUser, users, setCurrentUser, companies, loadData, loading } = useCRMStore();
  const [view, setView] = useState<View>('dashboard');
  const [selectedCompany, setSelectedCompany] = useState<Company|null>(null);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => { loadData(); }, []);

  const freshCompany = selectedCompany ? companies.find(c => c.id === selectedCompany.id) ?? selectedCompany : null;
  const totalReminders = companies.reduce((s,c) => s + c.reminders.filter(r => !r.done).length, 0);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center bg-zinc-950">
      <div className="text-center">
        <div className="text-white font-black text-2xl tracking-tight mb-2">CRM</div>
        <div className="text-zinc-500 text-sm">Ładowanie danych...</div>
        <div className="mt-4 w-48 h-0.5 bg-zinc-800 mx-auto overflow-hidden">
          <div className="h-full bg-pink-500 animate-pulse w-full"/>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-zinc-100 overflow-hidden font-sans">
      {/* TOP MENU */}
      <header className="bg-zinc-950 text-white flex-shrink-0">
        <div className="flex items-center h-12 px-4">
          <div className="font-black text-base tracking-tight mr-6 flex-shrink-0 flex items-center gap-1.5">
            <div className="w-6 h-6 bg-pink-500 flex items-center justify-center text-white text-xs font-black">B</div>
            <span className="text-white">BeautyPolisa</span>
            <span className="text-pink-400 text-[10px] font-medium ml-0.5 uppercase tracking-widest">CRM</span>
          </div>

          <nav className="flex h-full">
            {NAV.map(item => {
              if (item.key === 'admin' && currentUser?.role !== 'admin') return null;
              return (
                <button key={item.key} onClick={() => setView(item.key)}
                  className={`h-full px-4 text-sm font-medium transition-colors relative flex items-center gap-1.5 ${view===item.key ? 'text-white bg-zinc-800' : 'text-zinc-400 hover:text-white hover:bg-zinc-900'}`}>
                  {item.label}
                  {item.key === 'calendar' && totalReminders > 0 && (
                    <span className="bg-pink-500 text-white text-[10px] font-bold px-1.5 min-w-[18px] text-center">{totalReminders}</span>
                  )}
                  {view === item.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-500"/>}
                </button>
              );
            })}
          </nav>

          {/* Public form link */}
          <a href="/formularz" target="_blank" rel="noopener"
            className="ml-4 h-7 px-3 text-xs flex items-center gap-1.5 border border-pink-700 text-pink-400 hover:bg-pink-900 transition-colors">
            📋 Link do formularza
          </a>

          <div className="ml-auto flex items-center gap-3">
            <button onClick={() => loadData()} className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors" title="Odśwież dane">↻</button>
            <span className="text-xs text-zinc-600">{companies.length} firm</span>

            {/* User menu */}
            <div className="relative">
              <button onClick={() => setShowUserMenu(p => !p)}
                className="flex items-center gap-2 px-2 py-1 hover:bg-zinc-800 transition-colors">
                <div className="w-7 h-7 flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: currentUser?.color ?? '#374151' }}>
                  {currentUser?.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <span className="text-sm text-zinc-300 hidden sm:block">{currentUser?.name}</span>
                <span className="text-zinc-500 text-xs">▾</span>
              </button>
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-zinc-900 border border-zinc-700 shadow-xl z-50">
                  <div className="px-3 py-2 text-xs text-zinc-500 uppercase tracking-widest border-b border-zinc-800">Przełącz konto</div>
                  {users.map(u => (
                    <button key={u.id} onClick={() => { setCurrentUser(u); setShowUserMenu(false); }}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left transition-colors ${currentUser?.id===u.id ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`}>
                      <div className="w-6 h-6 flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ backgroundColor: u.color }}>
                        {u.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                      </div>
                      <div><div>{u.name}</div><div className="text-xs text-zinc-500">{u.role}</div></div>
                      {currentUser?.id === u.id && <span className="ml-auto text-pink-400 text-xs">✓</span>}
                    </button>
                  ))}
                  <div className="border-t border-zinc-800 p-2">
                    <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-xs text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors">
                      🚪 Wyloguj się
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-5" onClick={() => showUserMenu && setShowUserMenu(false)}>
        {view === 'dashboard' && <Dashboard onSelectCompany={setSelectedCompany}/>}
        {view === 'pipeline'  && <Pipeline onSelectCompany={setSelectedCompany}/>}
        {view === 'klienci'   && <Clients onSelectCompany={setSelectedCompany}/>}
        {view === 'calendar'  && <Calendar onSelectCompany={setSelectedCompany}/>}
        {view === 'reports'   && <Reports/>}
        {view === 'admin'     && <AdminPanel/>}
      </main>

      {freshCompany && <CompanyDrawer company={freshCompany} onClose={() => setSelectedCompany(null)}/>}
    </div>
  );
}
