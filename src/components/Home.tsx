import { useState, useEffect, useMemo } from 'react';
import { useCRMStore } from '../store/useCRMStore';
import type { Company } from '../data/companies';

interface HomeProps { onSelectCompany: (c: Company) => void; }

const ZONES = [
  { label: 'Warszawa',  tz: 'Europe/Warsaw' },
  { label: 'Londyn',    tz: 'Europe/London' },
  { label: 'Nowy Jork', tz: 'America/New_York' },
  { label: 'Singapur',  tz: 'Asia/Singapore' },
];

function WorldClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return (
    <div className="flex items-center gap-2">
      {ZONES.map(z => {
        const time = now.toLocaleTimeString('pl-PL', { timeZone: z.tz, hour: '2-digit', minute: '2-digit', hour12: false });
        const [h, m] = time.split(':');
        return (
          <div key={z.tz} className="flex flex-col items-center bg-white border-2 border-zinc-800 px-3 py-2 min-w-[80px]">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">{z.label}</span>
            <div className="flex items-center font-mono">
              {[h, m].map((seg, i) => (
                <span key={i} className="flex items-center">
                  {seg.split('').map((ch, j) => (
                    <span key={j} className="inline-block text-2xl font-black text-zinc-900 leading-none w-[16px] text-center">{ch}</span>
                  ))}
                  {i === 0 && <span className="text-zinc-400 text-xl font-black mx-0.5 leading-none">:</span>}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function fmtPLN(n: number) { return n.toLocaleString('pl-PL', { maximumFractionDigits: 0 }) + ' zł'; }
function fmtDate(s: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', weekday: 'short' });
}
function fmtDT(s: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function Home({ onSelectCompany }: HomeProps) {
  const { companies, currentUser } = useCRMStore();

  const hour = new Date().getHours();
  const greeting = hour < 18 ? 'Dzień dobry' : 'Dobry wieczór';
  const now = new Date();
  const yesterday  = new Date(now); yesterday.setDate(now.getDate()-1); yesterday.setHours(0,0,0,0);
  const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
  const tomorrowEnd = new Date(now); tomorrowEnd.setDate(now.getDate()+1); tomorrowEnd.setHours(23,59,59,999);

  // Stats
  const allPolicies = useMemo(() => companies.flatMap(c => c.policies), [companies]);
  const sm = new Date(now.getFullYear(), now.getMonth(), 1);
  const sy = new Date(now.getFullYear(), 0, 1);

  const skladkaMiesiac = allPolicies
    .filter(p => p.status==='aktywna' && p.dataOd && new Date(p.dataOd)>=sm && new Date(p.dataOd).getFullYear()===now.getFullYear())
    .reduce((s, p) => s + (p.skladka??0) + (p.ochronaPrawna?92:0), 0);
  const skladkaRok = allPolicies
    .filter(p => p.status==='aktywna' && p.dataOd && new Date(p.dataOd)>=sy)
    .reduce((s, p) => s + (p.skladka??0) + (p.ochronaPrawna?92:0), 0);

  const wygasajace = allPolicies.filter(p => {
    if (!p.dataDo || p.status!=='aktywna') return false;
    const days = Math.ceil((new Date(p.dataDo).getTime()-Date.now())/86400000);
    return days>=0 && days<=45;
  }).length;

  // Reminders 3 days
  const taskDays = useMemo(() => {
    const all = companies.flatMap(c => c.reminders.filter(r=>!r.done).map(r=>({...r,company:c})));
    return {
      yesterday: all.filter(r=>{ const d=new Date(r.date); return d>=yesterday&&d<todayStart; }),
      today:     all.filter(r=>{ const d=new Date(r.date); return d>=todayStart&&d<new Date(todayStart.getTime()+86400000); }),
      tomorrow:  all.filter(r=>{ const d=new Date(r.date); return d>=new Date(todayStart.getTime()+86400000)&&d<=tomorrowEnd; }),
    };
  }, [companies]);

  // Ostatnie notatki (historia kontaktów)
  const lastNotes = useMemo(() =>
    companies.flatMap(c => c.history.map(h => ({ ...h, company: c })))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 6)
  , [companies]);

  // Ostatnio dodane firmy (po ID — najwyższe ID = najnowsze)
  const recentlyAdded = useMemo(() =>
    [...companies].sort((a, b) => b.id - a.id).slice(0, 6)
  , [companies]);

  // Expiring soon list
  const expiringList = useMemo(() =>
    companies.flatMap(c => c.policies
      .filter(p => p.status==='aktywna' && p.dataDo && Math.ceil((new Date(p.dataDo).getTime()-Date.now())/86400000)<=45 && Math.ceil((new Date(p.dataDo).getTime()-Date.now())/86400000)>=0)
      .map(p => ({ ...p, company: c }))
    ).sort((a,b) => (a.dataDo??'').localeCompare(b.dataDo??'')).slice(0,6)
  , [companies]);

  const totalTasks = taskDays.yesterday.length+taskDays.today.length+taskDays.tomorrow.length;

  return (
    <div className="h-full overflow-y-auto pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-zinc-900">
            {greeting}, <span className="text-pink-500">{currentUser?.name?.split(' ')[0]??'użytkowniku'}</span>! 👋
          </h1>
          <div className="text-zinc-500 text-sm mt-0.5">
            {now.toLocaleDateString('pl-PL',{weekday:'long',day:'numeric',month:'long',year:'numeric'})} · {companies.length} salonów
          </div>
        </div>
        <WorldClock/>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-emerald-50 border border-emerald-200 p-4">
          <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Składka — ten miesiąc</div>
          <div className="text-2xl font-black font-mono text-emerald-700">{fmtPLN(skladkaMiesiac)}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 p-4">
          <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-1">Składka — ten rok</div>
          <div className="text-2xl font-black font-mono text-emerald-700">{fmtPLN(skladkaRok)}</div>
        </div>
        <div className={`p-4 border ${wygasajace>0?'bg-red-50 border-red-200':'bg-white border-zinc-200'}`}>
          <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${wygasajace>0?'text-red-500':'text-zinc-400'}`}>Wygasa ≤45 dni</div>
          <div className={`text-2xl font-black font-mono ${wygasajace>0?'text-red-700':'text-zinc-400'}`}>{wygasajace}</div>
        </div>
        <div className="bg-white border border-zinc-200 p-4">
          <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Zadania dziś</div>
          <div className="text-2xl font-black font-mono text-zinc-900">{taskDays.today.length}</div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-12 gap-3 mb-3">

        {/* Zadania 3 dni */}
        <div className="col-span-3 bg-white border border-zinc-200 flex flex-col" style={{maxHeight:'340px'}}>
          <div className="px-4 py-2.5 border-b border-zinc-100 flex items-center justify-between flex-shrink-0">
            <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">Zadania · 3 dni</div>
            <span className="text-xs bg-pink-100 text-pink-700 px-2 py-0.5 font-medium">{totalTasks}</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {(['yesterday','today','tomorrow'] as const).map(day => {
              const items = taskDays[day];
              const label = day==='yesterday'?'Wczoraj':day==='today'?'Dziś':'Jutro';
              const color = day==='yesterday'?'text-red-500 bg-red-50':day==='today'?'text-zinc-900 bg-amber-50':'text-zinc-400 bg-zinc-50';
              const icon  = day==='yesterday'?'⚠️':day==='today'?'🔔':'📅';
              return (
                <div key={day}>
                  <div className={`px-4 py-1 text-[10px] font-bold uppercase tracking-widest ${color}`}>{label} · {items.length}</div>
                  {items.length===0
                    ? <div className="px-4 py-1.5 text-xs text-zinc-300">Brak</div>
                    : items.map(r=>(
                      <div key={r.id} className="px-4 py-1.5 flex items-start gap-2 hover:bg-zinc-50 cursor-pointer border-b border-zinc-50" onClick={()=>onSelectCompany(r.company)}>
                        <span className="text-sm flex-shrink-0">{icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs text-zinc-800 leading-tight truncate">{r.text}</div>
                          <div className="text-[10px] text-zinc-400">{r.company.company} · {fmtDate(r.date)}</div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              );
            })}
          </div>
        </div>

        {/* Wygasające polisy */}
        <div className="col-span-3 bg-white border border-zinc-200 flex flex-col" style={{maxHeight:'340px'}}>
          <div className="px-4 py-2.5 border-b border-zinc-100 flex-shrink-0">
            <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">🔔 Wygasają wkrótce</div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
            {expiringList.length===0
              ? <div className="px-4 py-6 text-xs text-zinc-400 text-center">Brak polis wygasających w ciągu 45 dni ✓</div>
              : expiringList.map(p => {
                  const days = Math.ceil((new Date(p.dataDo!).getTime()-Date.now())/86400000);
                  return (
                    <div key={p.id} className="px-4 py-2 cursor-pointer hover:bg-zinc-50" onClick={()=>onSelectCompany(p.company)}>
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-zinc-900 truncate">{p.company.company}</div>
                        <span className={`text-[10px] px-1.5 py-0.5 font-bold flex-shrink-0 ml-2 ${days<=14?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}`}>{days} dni</span>
                      </div>
                      <div className="text-[10px] text-zinc-400">{p.rodzaj} · kończy się {fmtDate(p.dataDo!)}</div>
                    </div>
                  );
                })
            }
          </div>
        </div>

        {/* Ostatnio dodane firmy */}
        <div className="col-span-3 bg-white border border-zinc-200 flex flex-col" style={{maxHeight:'340px'}}>
          <div className="px-4 py-2.5 border-b border-zinc-100 flex-shrink-0">
            <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">Ostatnio dodane</div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
            {recentlyAdded.length===0
              ? <div className="px-4 py-6 text-xs text-zinc-400 text-center">Brak firm</div>
              : recentlyAdded.map(co=>(
                <div key={co.id} className="px-4 py-2 cursor-pointer hover:bg-pink-50" onClick={()=>onSelectCompany(co)}>
                  <div className="text-xs font-semibold text-zinc-800 truncate">{co.company}</div>
                  <div className="text-[10px] text-zinc-400 truncate">{[co.contact, co.phone].filter(Boolean).join(' · ')}</div>
                  <div className="text-[10px] mt-0.5">
                    {co.leadSource==='formularz' && <span className="text-pink-500">📋 formularz</span>}
                    {co.leadSource==='własny' && <span className="text-amber-500">⭐ własny</span>}
                    {(!co.leadSource || co.leadSource==='import') && <span className="text-zinc-300">import</span>}
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* Ostatnie notatki */}
        <div className="col-span-3 bg-white border border-zinc-200 flex flex-col" style={{maxHeight:'340px'}}>
          <div className="px-4 py-2.5 border-b border-zinc-100 flex-shrink-0">
            <div className="text-xs font-bold uppercase tracking-widest text-zinc-500">Ostatnie notatki</div>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
            {lastNotes.length===0
              ? <div className="px-4 py-6 text-xs text-zinc-400 text-center">Brak wpisów w historii</div>
              : lastNotes.map(h=>(
                <div key={h.id} className="px-4 py-2 cursor-pointer hover:bg-zinc-50" onClick={()=>onSelectCompany(h.company)}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs">{h.type==='telefon'?'📞':h.type==='email'?'✉️':h.type==='spotkanie'?'🤝':'📝'}</span>
                    <span className="text-xs font-semibold text-zinc-800 truncate">{h.company.company}</span>
                  </div>
                  <div className="text-xs text-zinc-500 truncate">{h.note.slice(0,50)}{h.note.length>50?'...':''}</div>
                  <div className="text-[10px] text-zinc-300 mt-0.5">{fmtDT(h.date)} · {h.author}</div>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}
