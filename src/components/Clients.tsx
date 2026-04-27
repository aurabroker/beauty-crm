import { useState, useMemo } from 'react';
import { useCRMStore } from '../store/useCRMStore';
import type { Company } from '../data/companies';
import { Input } from '@/components/ui/input';

interface ClientsProps { onSelectCompany: (c: Company) => void; }

function daysLeft(dataDo: string): number {
  return Math.ceil((new Date(dataDo).getTime() - Date.now()) / 86400000);
}
function fmtDate(s: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function PolicyBadge({ dataDo }: { dataDo: string }) {
  if (!dataDo) return null;
  const days = daysLeft(dataDo);
  if (days <= 0)  return <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 font-medium">Wygasła</span>;
  if (days <= 45) return <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 font-medium">⚠ {days} dni</span>;
  return <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 font-medium">✓ {days} dni</span>;
}

type Filter = 'wszyscy' | 'aktywne' | 'wygasaja' | 'wygasle';

export function Clients({ onSelectCompany }: ClientsProps) {
  const { companies, currentUser } = useCRMStore();
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<Filter>('wszyscy');

  const visible = currentUser?.role === 'admin'
    ? companies
    : companies.filter(c => !c.assignedTo || c.assignedTo === currentUser?.name);

  const clients = useMemo(() => {
    let r = visible.filter(c => c.status === 'zamkniety');
    if (search) r = r.filter(c =>
      `${c.company} ${c.contact} ${c.nip}`.toLowerCase().includes(search.toLowerCase())
    );
    if (filter === 'aktywne')  r = r.filter(c => c.policies.some(p => p.status === 'aktywna' && p.dataDo && daysLeft(p.dataDo) > 45));
    if (filter === 'wygasaja') r = r.filter(c => c.policies.some(p => p.status === 'aktywna' && p.dataDo && daysLeft(p.dataDo) <= 45 && daysLeft(p.dataDo) > 0));
    if (filter === 'wygasle')  r = r.filter(c => c.policies.some(p => p.dataDo && daysLeft(p.dataDo) <= 0));
    return r.sort((a, b) => {
      // Sort: expiring soon first
      const aMin = Math.min(...a.policies.filter(p => p.dataDo).map(p => daysLeft(p.dataDo)), Infinity);
      const bMin = Math.min(...b.policies.filter(p => p.dataDo).map(p => daysLeft(p.dataDo)), Infinity);
      return aMin - bMin;
    });
  }, [visible, search, filter]);

  // Stats
  const total    = visible.filter(c => c.status === 'zamkniety').length;
  const expiring = visible.filter(c => c.status === 'zamkniety' && c.policies.some(p => p.dataDo && daysLeft(p.dataDo) <= 45 && daysLeft(p.dataDo) > 0)).length;
  const expired  = visible.filter(c => c.status === 'zamkniety' && c.policies.some(p => p.dataDo && daysLeft(p.dataDo) <= 0)).length;
  const noPolicies = visible.filter(c => c.status === 'zamkniety' && c.policies.length === 0).length;

  const FILTERS: { key: Filter; label: string; count: number; color: string }[] = [
    { key: 'wszyscy',  label: 'Wszyscy klienci',   count: total,      color: 'bg-zinc-900 text-white' },
    { key: 'aktywne',  label: 'Polisa aktywna',     count: total - expiring - expired, color: 'bg-emerald-600 text-white' },
    { key: 'wygasaja', label: 'Wygasa ≤ 45 dni',    count: expiring,   color: 'bg-amber-500 text-white' },
    { key: 'wygasle',  label: 'Polisa wygasła',     count: expired,    color: 'bg-red-600 text-white' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <div className="bg-white border border-zinc-200 p-4">
          <div className="text-xs text-zinc-400 uppercase tracking-widest mb-1">Klientów łącznie</div>
          <div className="text-3xl font-black font-mono text-zinc-900">{total}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 p-4">
          <div className="text-xs text-emerald-600 uppercase tracking-widest mb-1">Aktywna polisa</div>
          <div className="text-3xl font-black font-mono text-emerald-700">{total - expiring - expired - noPolicies}</div>
        </div>
        <div className="bg-amber-50 border border-amber-200 p-4">
          <div className="text-xs text-amber-600 uppercase tracking-widest mb-1">Wygasa wkrótce</div>
          <div className="text-3xl font-black font-mono text-amber-700">{expiring}</div>
        </div>
        <div className="bg-red-50 border border-red-200 p-4">
          <div className="text-xs text-red-500 uppercase tracking-widest mb-1">Polisa wygasła</div>
          <div className="text-3xl font-black font-mono text-red-700">{expired}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Input placeholder="Szukaj klienta, NIP..." value={search} onChange={e => setSearch(e.target.value)}
          className="w-56 h-9 text-sm rounded-none border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-900" />
        <div className="flex gap-1.5">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`h-9 px-3 text-xs font-medium transition-colors flex items-center gap-1.5 border ${
                filter === f.key
                  ? f.color + ' border-transparent'
                  : 'border-zinc-200 text-zinc-600 hover:border-zinc-900 bg-white'
              }`}>
              {f.label}
              <span className={`text-[10px] px-1.5 py-0.5 font-bold ${filter === f.key ? 'bg-white/20' : 'bg-zinc-100 text-zinc-500'}`}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-white sticky top-0 z-10">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium tracking-widest uppercase">Klient</th>
              <th className="text-left px-4 py-3 text-xs font-medium tracking-widest uppercase">Kontakt</th>
              <th className="text-left px-4 py-3 text-xs font-medium tracking-widest uppercase">NIP</th>
              <th className="text-left px-4 py-3 text-xs font-medium tracking-widest uppercase">Polisa</th>
              <th className="text-left px-4 py-3 text-xs font-medium tracking-widest uppercase">Składka</th>
              <th className="text-left px-4 py-3 text-xs font-medium tracking-widest uppercase">Koniec</th>
              <th className="text-left px-4 py-3 text-xs font-medium tracking-widest uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c, i) => {
              const activePolicies = c.policies.filter(p => p.status === 'aktywna');
              const mainPolicy = activePolicies.sort((a, b) =>
                (a.dataDo && b.dataDo) ? daysLeft(a.dataDo) - daysLeft(b.dataDo) : 0
              )[0];

              return (
                <tr key={c.id} onClick={() => onSelectCompany(c)}
                  className={`border-b border-zinc-100 cursor-pointer hover:bg-pink-50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/40'}`}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-zinc-900">{c.company}</div>
                    {c.ubezpieczenie && <div className="text-xs text-zinc-400 mt-0.5">{c.ubezpieczenie}</div>}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    <div>{c.contact || <span className="text-zinc-300">—</span>}</div>
                    {c.phone && <div className="text-xs text-zinc-400">{c.phone}</div>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">{c.nip || '—'}</td>
                  <td className="px-4 py-3">
                    {mainPolicy
                      ? <div>
                          <div className="text-sm text-zinc-800 font-medium">{mainPolicy.rodzaj}</div>
                          {mainPolicy.sumaUbezpieczenia && <div className="text-xs text-zinc-400">{mainPolicy.sumaUbezpieczenia}</div>}
                        </div>
                      : <span className="text-xs text-zinc-300">Brak polisy</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-sm font-bold text-zinc-900">
                    {mainPolicy?.skladka
                      ? `${mainPolicy.skladka.toLocaleString('pl-PL')} zł`
                      : <span className="text-zinc-300 font-normal">—</span>}
                    {mainPolicy?.skladka && <span className="text-xs text-zinc-400 font-normal ml-1">/{mainPolicy.skladkaOkres === 'miesięczna' ? 'mies.' : 'rok'}</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-600">
                    {mainPolicy?.dataDo ? fmtDate(mainPolicy.dataDo) : <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {mainPolicy?.dataDo
                      ? <PolicyBadge dataDo={mainPolicy.dataDo} />
                      : c.policies.length === 0
                      ? <span className="text-xs px-2 py-0.5 bg-zinc-100 text-zinc-500">Brak polisy</span>
                      : <span className="text-xs px-2 py-0.5 bg-zinc-100 text-zinc-500">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {clients.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-zinc-400 gap-2">
            <div className="text-2xl">👤</div>
            <div className="text-sm">{total === 0 ? 'Brak klientów — dodaj polisę żeby oznaczyć firmę jako Klient' : 'Brak wyników dla tego filtra'}</div>
          </div>
        )}
      </div>
      <div className="mt-2 text-xs text-zinc-400">{clients.length} klientów</div>
    </div>
  );
}
