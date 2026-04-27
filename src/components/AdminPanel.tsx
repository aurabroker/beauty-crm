import { GoogleSheetsImport } from './GoogleSheetsImport';
import { useState } from 'react';
import { useCRMStore } from '../store/useCRMStore';
import type { PipelineStage } from '../data/companies';
import { Input } from '@/components/ui/input';

const COLORS = ['#1f2937','#2563eb','#7c3aed','#059669','#dc2626','#d97706','#0891b2','#db2777'];

export function AdminPanel() {
  const { users, stages, addUser, deleteUser, updateUser, updateStages, currentUser } = useCRMStore();
  const [tab, setTab] = useState<'users'|'pipeline'|'gsheets'>('users');
  const [newUser, setNewUser] = useState({ name:'', email:'', role:'user' as 'admin'|'user', color: COLORS[1] });
  const [editStages, setEditStages] = useState<PipelineStage[]>(stages);
  const [stagesSaved, setStagesSaved] = useState(false);

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-zinc-400">
          <div className="text-4xl mb-3">🔒</div>
          <div className="font-medium">Brak dostępu</div>
          <div className="text-sm mt-1">Panel admina dostępny tylko dla roli Admin</div>
        </div>
      </div>
    );
  }

  const handleAddUser = async () => {
    if (!newUser.name.trim() || !newUser.email.trim()) return;
    await addUser(newUser);
    setNewUser({ name:'', email:'', role:'user', color: COLORS[1] });
  };

  const handleSaveStages = async () => {
    await updateStages(editStages);
    setStagesSaved(true);
    setTimeout(() => setStagesSaved(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tabs */}
      <div className="flex border-b border-zinc-200 mb-6">
        {(['users','pipeline','gsheets'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-3 text-xs font-medium uppercase tracking-widest transition-colors border-b-2 ${tab===t?'border-zinc-900 text-zinc-900':'border-transparent text-zinc-400 hover:text-zinc-700'}`}>
            {t==='users'?'👤 Użytkownicy':t==='pipeline'?'⬛ Kolumny Pipeline':'📊 Google Sheets'}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <div className="flex gap-6 flex-1 overflow-hidden">
          {/* User list */}
          <div className="flex-1 overflow-auto">
            <div className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-3">Aktywni użytkownicy ({users.length})</div>
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="flex items-center gap-3 p-3 border border-zinc-200 bg-white hover:border-zinc-400 transition-colors">
                  <div className="w-9 h-9 flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ backgroundColor: u.color }}>
                    {u.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-zinc-900 text-sm">{u.name}</div>
                    <div className="text-xs text-zinc-400">{u.email}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 font-medium ${u.role==='admin'?'bg-zinc-900 text-white':'bg-zinc-100 text-zinc-600'}`}>{u.role}</span>
                  <div className="flex gap-2">
                    <select value={u.role} onChange={e => updateUser(u.id, { role: e.target.value as 'admin'|'user' })}
                      className="text-xs border border-zinc-200 px-2 py-1 bg-white">
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                    {u.id !== currentUser?.id && (
                      <button onClick={() => deleteUser(u.id)} className="text-zinc-300 hover:text-red-500 text-sm px-1">✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Add user form */}
          <div className="w-72 flex-shrink-0">
            <div className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-3">Dodaj użytkownika</div>
            <div className="border border-zinc-200 p-4 bg-white space-y-3">
              <div>
                <div className="text-xs text-zinc-500 mb-1">Imię i nazwisko</div>
                <Input value={newUser.name} onChange={e=>setNewUser(p=>({...p,name:e.target.value}))}
                  className="h-8 text-sm rounded-none border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-900" placeholder="Jan Kowalski"/>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">Email</div>
                <Input value={newUser.email} onChange={e=>setNewUser(p=>({...p,email:e.target.value}))}
                  className="h-8 text-sm rounded-none border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-900" placeholder="jan@firma.pl" type="email"/>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">Rola</div>
                <select value={newUser.role} onChange={e=>setNewUser(p=>({...p,role:e.target.value as 'admin'|'user'}))}
                  className="w-full text-sm border border-zinc-200 px-2 py-1.5 bg-white focus:outline-none focus:border-zinc-900">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-2">Kolor avatara</div>
                <div className="flex gap-1.5 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setNewUser(p=>({...p,color:c}))}
                      className={`w-7 h-7 transition-all ${newUser.color===c?'ring-2 ring-offset-1 ring-zinc-900 scale-110':''}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <button onClick={handleAddUser} disabled={!newUser.name.trim()||!newUser.email.trim()}
                className="w-full py-2 bg-zinc-900 text-white text-sm hover:bg-zinc-700 disabled:opacity-40 transition-colors">
                Dodaj użytkownika
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === 'gsheets' && (
        <div className="flex-1 overflow-auto">
          <GoogleSheetsImport />
        </div>
      )}

      {tab === 'pipeline' && (
        <div className="max-w-lg">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-3">Nazwy etapów pipeline (edytowalne)</div>
          <div className="space-y-2 mb-4">
            {editStages.map((stage, i) => (
              <div key={stage.key} className="flex items-center gap-3 p-3 border border-zinc-200 bg-white">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                <div className="text-xs text-zinc-400 w-24 font-mono">{stage.key}</div>
                <Input value={stage.label}
                  onChange={e => setEditStages(prev => prev.map((s,j) => j===i ? {...s, label:e.target.value} : s))}
                  className="flex-1 h-8 text-sm rounded-none border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-900"/>
                <input type="color" value={stage.color}
                  onChange={e => setEditStages(prev => prev.map((s,j) => j===i ? {...s, color:e.target.value} : s))}
                  className="w-8 h-8 border border-zinc-200 cursor-pointer p-0.5"/>
              </div>
            ))}
          </div>
          <button onClick={handleSaveStages}
            className={`px-6 py-2 text-sm font-medium transition-colors ${stagesSaved?'bg-emerald-600 text-white':'bg-zinc-900 text-white hover:bg-zinc-700'}`}>
            {stagesSaved ? '✓ Zapisano!' : 'Zapisz nazwy etapów'}
          </button>
          <div className="mt-2 text-xs text-zinc-400">Zmiany są widoczne dla wszystkich użytkowników i zapisywane w bazie.</div>
        </div>
      )}
    </div>
  );
}
