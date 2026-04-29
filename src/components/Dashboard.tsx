import { useState, useMemo, useRef } from 'react';
import { useCRMStore } from '../store/useCRMStore';
import type { Company } from '../data/companies';
import { TAGI_ZADANIOWE, RODZAJE_UBEZPIECZEN } from '../data/companies';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DashboardProps { onSelectCompany: (c: Company) => void; }
type SortKey = 'company' | 'employees';

const STATUS_COLORS: Record<string,string> = {
  lead:'bg-gray-100 text-gray-700', kontakt:'bg-pink-100 text-pink-700',
  oferta:'bg-amber-100 text-amber-700', negocjacje:'bg-purple-100 text-purple-700',
  zamkniety:'bg-emerald-100 text-emerald-700', stracony:'bg-red-100 text-red-700',
};

function startOfWeek() {
  const d = new Date(); d.setHours(0,0,0,0);
  const day = d.getDay(); d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d;
}

export function Dashboard({ onSelectCompany }: DashboardProps) {
  const { companies, stages, deleteCompany, importCompanies, currentUser, updateCompany } = useCRMStore();
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterRodzaj, setFilterRodzaj]   = useState('all');
  const [filterTag, setFilterTag]       = useState('all');
  const [filterSource, setFilterSource]  = useState('all');
  const [sortKey, setSortKey]           = useState<SortKey>('company');
  const [sortDir, setSortDir]           = useState<'asc'|'desc'>('asc');
  const [showAdd, setShowAdd]           = useState(false);
  const [newCo, setNewCo]               = useState<Record<string,string>>({});
  const [newCoSource, setNewCoSource]   = useState<'własny'|'BeautyRazem'>('własny');
  const [sendToGR, setSendToGR]         = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number|null>(null);
  const [importing, setImporting]       = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [importResult, setImportResult] = useState<{imported:number;merged:number;errors:number}|null>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const isAdmin = currentUser?.role === 'admin';


  const visible = isAdmin ? companies : companies.filter(c => !c.assignedTo || c.assignedTo === currentUser?.name);

  const searchSuggestions = useMemo(() => {
    if (!search.trim() || search.trim().length < 2) return [];
    const q = search.toLowerCase().trim();
    return visible.filter((co: Company) =>
      co.company.toLowerCase().includes(q) ||
      (co.nip ?? '').includes(q) ||
      (co.phone ?? '').replace(/\D/g,'').includes(q.replace(/\D/g,'')) ||
      (co.contact ?? '').toLowerCase().includes(q)
    ).slice(0, 8);
  }, [visible, search]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const sw = startOfWeek();
  // Count companies without tag
  const noTag = visible.filter(c => !c.tag || c.tag.trim() === '').length;
  // Składka po data_od — porównanie stringów (bez problemów z timezone)
  const nowDate = new Date();
  const monthStr = `${nowDate.getFullYear()}-${String(nowDate.getMonth()+1).padStart(2,'0')}`;
  const yearStr  = String(nowDate.getFullYear());
  const calcRevenue = (policies: Company['policies'], prefix: string) =>
    policies.filter(p => p.status==='aktywna' && p.skladka && p.dataOd?.startsWith(prefix))
            .reduce((s,p) => s + (p.skladka??0) + (p.ochronaPrawna ? 92 : 0), 0);
  const monthlyRevenue = visible.reduce((sum,c) => sum + calcRevenue(c.policies, monthStr), 0);
  const yearlyRevenue  = visible.reduce((sum,c) => sum + calcRevenue(c.policies, yearStr),  0);
  // Nowe salony = polisy dodane w tym tygodniu
  const newSalonsWeek = visible.filter(c => c.policies.some(p => new Date(p.createdAt) >= sw)).length;

  // ── Filters ───────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let r = visible;
    if (search) {
      const q = search.toLowerCase().trim();
      r = r.filter(c =>
        c.company.toLowerCase().includes(q) ||
        c.contact.toLowerCase().includes(q) ||
        (c.nip ?? '').includes(q) ||
        (c.phone ?? '').replace(/\D/g,'').includes(q.replace(/\D/g,'')) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.city ?? '').toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') r = r.filter(c => c.status === filterStatus);
    if (filterRodzaj !== 'all')  r = r.filter(c => (c.tag ?? '').toUpperCase() === filterRodzaj.toUpperCase());
    if (filterTag === '__none') r = r.filter(c => !c.tag || c.tag.trim() === '');
    else if (filterTag !== 'all') r = r.filter(c => c.tag === filterTag);
    if (filterSource !== 'all') r = r.filter(c => (c.leadSource ?? '') === filterSource);
    return [...r].sort((a, b) => {
      if (sortKey === 'employees') {
        const va = parseInt(a.employees||'0')||0, vb = parseInt(b.employees||'0')||0;
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      return sortDir === 'asc' ? a.company.localeCompare(b.company) : b.company.localeCompare(a.company);
    });
  }, [visible, search, filterStatus, filterTag, filterSource, filterRodzaj, sortKey, sortDir]);

  const SI = ({k}:{k:SortKey}) => <span className="ml-1 text-[10px] opacity-40">{sortKey===k?(sortDir==='desc'?'↓':'↑'):'↕'}</span>;
  const toggleSort = (k:SortKey) => { if(sortKey===k) setSortDir(d=>d==='asc'?'desc':'asc'); else{setSortKey(k);setSortDir('asc');} };

  const handleCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setImporting(true); setImportResult(null);
    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g,''));
    const MAP: Record<string,string> = { firma:'company', company:'company', nazwa:'company', name:'company', kontakt:'contact', contact:'contact', telefon:'phone', phone:'phone', email:'email', miasto:'city', city:'city', nip:'nip', ubezpieczenie:'ubezpieczenie', pracownicy:'employees', employees:'employees', przychód:'przychod', www:'url', url:'url' };
    const rows = lines.slice(1).map(line => {
      const vals: string[] = []; let cur = '', inQ = false;
      for (const ch of line) { if (ch==='"') { inQ=!inQ; } else if (ch===','&&!inQ) { vals.push(cur.trim()); cur=''; } else { cur+=ch; } }
      vals.push(cur.trim());
      const obj: Record<string,string> = {};
      headers.forEach((h,i) => { const key = MAP[h] ?? h; obj[key] = vals[i]?.replace(/^"|"$/g,'') ?? ''; });
      return obj;
    }).filter(r => r.company);
    const result = await importCompanies(rows as Parameters<typeof importCompanies>[0]);
    setImportResult(result);
    setImporting(false);
    if (csvRef.current) csvRef.current.value = '';
  };

  const handleAdd = async () => {
    if (!newCo.company?.trim()) return;
    // Wyślij przez Edge Function (zapisze do CRM + opcjonalnie do GR)
    await fetch('https://dhuvykwecsxgchzxufxw.supabase.co/functions/v1/lead-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': 'beauty2026secret' },
      body: JSON.stringify({
        company:       newCo.company,
        contact:       newCo.contact ?? '',
        email:         newCo.email ?? '',
        phone:         newCo.phone ?? '',
        nip:           newCo.nip ?? '',
        ubezpieczenie: newCo.ubezpieczenie ?? '',
        tag:           newCoSource,
        lead_source:   newCoSource,
        send_to_gr:    sendToGR,
      }),
    }).catch(() => null);
    // Odśwież dane
    await useCRMStore.getState().loadData();
    setNewCo({}); setNewCoSource('własny'); setSendToGR(false); setShowAdd(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Stats row ── */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-white border border-zinc-200 p-3">
          <div className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Składka — ten miesiąc</div>
          <div className="text-2xl font-black font-mono text-emerald-700">{monthlyRevenue.toLocaleString('pl-PL')} zł</div>
        </div>
        <div className="bg-white border border-zinc-200 p-3">
          <div className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Składka — ten rok</div>
          <div className="text-2xl font-black font-mono text-emerald-700">{yearlyRevenue.toLocaleString('pl-PL')} zł</div>
        </div>
        <div className="bg-white border border-zinc-200 p-3">
          <div className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Nowe salony — ten tydzień</div>
          <div className="text-2xl font-black font-mono text-zinc-900">{newSalonsWeek}</div>
          <div className="text-xs text-zinc-400">polis w tym tygodniu</div>
        </div>
        <div className={`border p-3 ${noTag > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-zinc-200'}`}>
          <div className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Bez tagu zadaniowego</div>
          <div className={`text-2xl font-black font-mono ${noTag > 0 ? 'text-amber-700' : 'text-zinc-400'}`}>{noTag}</div>
          <button onClick={() => setFilterTag('__none')} className="text-xs text-amber-600 hover:underline mt-0.5">
            {noTag > 0 ? 'Pokaż te firmy →' : 'Wszystkie mają tag ✓'}
          </button>
        </div>
      </div>

      {/* Import result banner */}
      {importResult && (
        <div className={`mb-3 px-4 py-2 text-sm flex items-center justify-between ${importResult.errors > 0 ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-emerald-50 border border-emerald-200 text-emerald-700'}`}>
          <span>
            ✅ Zaimportowano: <strong>{importResult.imported}</strong> nowych ·
            🔀 Scalono duplikaty NIP: <strong>{importResult.merged}</strong>
            {importResult.errors > 0 && ` · ❌ Błędy: ${importResult.errors}`}
          </span>
          <button onClick={() => setImportResult(null)} className="text-zinc-400 hover:text-zinc-700">✕</button>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="relative">
          <input
            placeholder="Szukaj: nazwa, NIP, telefon, email..."
            value={search}
            onChange={e => { setSearch(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            className="w-80 h-9 border border-zinc-300 px-3 pl-8 text-sm focus:outline-none focus:border-zinc-900 bg-white"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">🔍</span>
          {search && <button type="button" onClick={() => { setSearch(''); setShowSuggestions(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 text-xs">✕</button>}
          {showSuggestions && searchSuggestions.length > 0 && (
            <div className="absolute z-50 top-full left-0 w-96 bg-white border border-zinc-900 shadow-xl mt-px">
              {searchSuggestions.map((co: Company) => (
                <button key={co.id} type="button"
                  onMouseDown={() => { setSearch(co.company); setShowSuggestions(false); onSelectCompany(co); }}
                  className="w-full text-left px-3 py-2.5 hover:bg-pink-50 border-b border-zinc-100 last:border-0 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-zinc-900 truncate">{co.company}</div>
                    <div className="text-xs text-zinc-400 truncate">
                      {[co.contact, co.phone, co.nip ? 'NIP: '+co.nip : ''].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 font-medium flex-shrink-0 ${co.status==='zamkniety'?'bg-emerald-100 text-emerald-700':co.status==='kontakt'?'bg-pink-100 text-pink-700':'bg-gray-100 text-gray-600'}`}>
                    {stages.find(s=>s.key===co.status)?.label ?? co.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex gap-1 border border-zinc-300 h-9">
          {[['all','Wszyscy'],['WŁASNY','⭐ Własny'],['BEAUTYRAZEM','🌐 BeautyRazem']].map(([v,l])=>(
            <button key={v} onClick={()=>setFilterRodzaj(v)}
              className={`px-3 text-xs font-medium transition-colors ${filterRodzaj===v?'bg-zinc-900 text-white':'text-zinc-600 hover:bg-zinc-100'}`}>
              {l}
            </button>
          ))}
        </div>
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-44 h-9 text-sm rounded-none border-zinc-200 focus:ring-0"><SelectValue placeholder="Źródło"/></SelectTrigger>
          <SelectContent className="rounded-none">
            <SelectItem value="all">🌐 Wszystkie źródła</SelectItem>
            <SelectItem value="klient własny">⭐ Klient własny</SelectItem>
            <SelectItem value="formularz">📋 Formularz</SelectItem>
            <SelectItem value="import">📥 Import CSV</SelectItem>
            <SelectItem value="getresponse">📧 GetResponse</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterTag} onValueChange={setFilterTag}>
          <SelectTrigger className="w-44 h-9 text-sm rounded-none border-zinc-200 focus:ring-0"><SelectValue placeholder="Filtruj tag"/></SelectTrigger>
          <SelectContent className="rounded-none">
            <SelectItem value="all">Wszystkie tagi</SelectItem>
            <SelectItem value="__none">⚠ Bez tagu</SelectItem>
            {TAGI_ZADANIOWE.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        {(search || filterStatus !== 'all' || filterTag !== 'all') &&
          <button onClick={() => { setSearch(''); setFilterStatus('all'); setFilterTag('all'); }}
            className="h-9 px-3 text-xs text-zinc-500 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-900">Wyczyść</button>}
        <div className="ml-auto flex gap-2">
          <label className={`h-9 px-3 text-xs flex items-center gap-1.5 border cursor-pointer transition-colors ${importing ? 'border-zinc-200 text-zinc-300' : 'border-zinc-300 text-zinc-600 hover:border-zinc-900 hover:text-zinc-900'}`}>
            ↑ {importing ? 'Importuję...' : 'Import CSV'}
            <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} disabled={importing}/>
          </label>
          <button onClick={() => setShowAdd(true)} className="h-9 px-3 text-xs bg-zinc-900 text-white hover:bg-zinc-700 transition-colors">+ Dodaj firmę</button>
        </div>
      </div>

      {/* ── Add Modal ── */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={e=>{if(e.target===e.currentTarget)setShowAdd(false);}}>
          <div className="bg-white w-[520px] shadow-2xl border border-zinc-200">
            <div className="bg-zinc-900 text-white px-5 py-4 flex items-center justify-between">
              <span className="font-bold text-sm uppercase tracking-widest">Nowa firma</span>
              <button onClick={() => setShowAdd(false)} className="text-zinc-400 hover:text-white text-lg">✕</button>
            </div>
            <div className="p-5 space-y-3">
              {/* Źródło */}
              <div className="grid grid-cols-2 gap-2">
                {(['własny','BeautyRazem'] as const).map(src => (
                  <button key={src} type="button" onClick={() => setNewCoSource(src)}
                    className={`py-2 text-sm font-bold border-2 transition-colors ${newCoSource===src ? 'bg-zinc-900 text-white border-zinc-900' : 'border-zinc-300 text-zinc-600 hover:border-zinc-900'}`}>
                    {src === 'własny' ? '⭐ WŁASNY' : '🌐 BeautyRazem'}
                  </button>
                ))}
              </div>
              {/* Pola wymagane */}
              <div className="grid grid-cols-2 gap-2">
                {([['Nazwa firmy *','company'],['Kontakt *','contact'],['Telefon *','phone'],['E-mail *','email'],['NIP','nip'],['Miejscowość','city']] as [string,string][]).map(([label,key]) => (
                  <div key={key}>
                    <div className="text-xs text-zinc-500 mb-1">{label}</div>
                    <input value={newCo[key]??''} onChange={e => setNewCo(p=>({...p,[key]:e.target.value}))}
                      className="w-full h-8 border border-zinc-300 px-2 text-sm focus:outline-none focus:border-zinc-900 bg-white"/>
                  </div>
                ))}
              </div>
              {/* Rodzaj ubezpieczenia — DROPDOWN */}
              <div>
                <div className="text-xs text-zinc-500 mb-1">Rodzaj ubezpieczenia *</div>
                <select value={newCo.ubezpieczenie??''} onChange={e => setNewCo(p=>({...p, ubezpieczenie: e.target.value}))}
                  className="w-full h-9 border border-zinc-300 px-2 text-sm focus:outline-none focus:border-zinc-900 bg-white text-zinc-800">
                  <option value="">— wybierz —</option>
                  {RODZAJE_UBEZPIECZEN.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {/* Wyślij do GR */}
              <label className="flex items-center gap-3 p-3 border border-zinc-200 bg-zinc-50 cursor-pointer hover:bg-zinc-100 transition-colors">
                <input type="checkbox" checked={sendToGR} onChange={e => setSendToGR(e.target.checked)} className="w-4 h-4 accent-emerald-600"/>
                <div>
                  <div className="text-sm font-semibold text-zinc-900">📧 Wyślij do GetResponse</div>
                  <div className="text-xs text-zinc-500">Doda do listy mailingowej GR2026</div>
                </div>
              </label>
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm border border-zinc-200 text-zinc-600 hover:border-zinc-900">Anuluj</button>
              <button onClick={handleAdd}
                disabled={!newCo.company?.trim() || !newCo.contact?.trim() || !newCo.phone?.trim() || !newCo.email?.trim()}
                className="px-4 py-2 text-sm bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-40">Zapisz</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {confirmDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white border border-zinc-200 shadow-xl p-6 w-80">
            <div className="font-bold text-zinc-900 mb-1">Usuń firmę?</div>
            <div className="text-sm text-zinc-500 mb-4">Operacja nieodwracalna. Usuniecie też historię, przypomnienia i polisy.</div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 text-sm border border-zinc-200 text-zinc-600 hover:border-zinc-900">Anuluj</button>
              <button onClick={async () => { await deleteCompany(confirmDelete!); setConfirmDelete(null); }} className="px-3 py-1.5 text-sm bg-red-600 text-white hover:bg-red-700">USUŃ</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-white sticky top-0 z-10">
            <tr>
              <th className="text-left px-3 py-3 text-xs font-medium tracking-widest uppercase w-6">#</th>
              <th className="text-left px-3 py-3 text-xs font-medium tracking-widest uppercase">
                <button onClick={() => toggleSort('company')} className="flex items-center hover:text-zinc-300">Firma <SI k="company"/></button>
              </th>
              <th className="text-left px-3 py-3 text-xs font-medium tracking-widest uppercase">Kontakt</th>
              <th className="text-left px-3 py-3 text-xs font-medium tracking-widest uppercase">NIP</th>
              <th className="text-left px-3 py-3 text-xs font-medium tracking-widest uppercase">Zainteresowania</th>
              <th className="text-left px-3 py-3 text-xs font-medium tracking-widest uppercase">Tag zadaniowy</th>
              <th className="text-left px-3 py-3 text-xs font-medium tracking-widest uppercase">Rodzaj</th>
              <th className="text-left px-3 py-3 text-xs font-medium tracking-widest uppercase">Status</th>
              <th className="px-3 py-3 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr key={c.id} className={`border-b border-zinc-100 hover:bg-pink-50 transition-colors ${i%2===0?'bg-white':'bg-zinc-50/40'}`}>
                <td className="px-3 py-2.5 text-zinc-300 text-xs font-mono cursor-pointer" onClick={() => onSelectCompany(c)}>{i+1}</td>
                <td className="px-3 py-2.5 cursor-pointer" onClick={() => onSelectCompany(c)}>
                  <div className="font-semibold text-zinc-900 text-sm leading-tight">{c.company}</div>
                  {c.city && <div className="text-xs text-zinc-400">{c.city}</div>}
                </td>
                <td className="px-3 py-2.5 text-zinc-600 cursor-pointer" onClick={() => onSelectCompany(c)}>
                  <div className="text-sm">{c.contact || <span className="text-zinc-300">—</span>}</div>
                  {c.phone && <div className="text-xs text-zinc-400">{c.phone}</div>}
                </td>
                <td className="px-3 py-2.5 font-mono text-xs text-zinc-500 cursor-pointer" onClick={() => onSelectCompany(c)}>{c.nip || '—'}</td>
                <td className="px-3 py-2.5 cursor-pointer" onClick={() => onSelectCompany(c)}>
                  {c.zainteresowania
                    ? <div className="flex flex-wrap gap-1">{c.zainteresowania.split(',').map(z => <span key={z} className="text-[10px] px-1.5 py-0.5 bg-pink-100 text-pink-700 font-medium">{z.trim()}</span>)}</div>
                    : <span className="text-zinc-300 text-xs">—</span>}
                  {c.leadSource === 'klient własny' && <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 font-bold mt-0.5 inline-block">⭐ własny</span>}
                </td>
                <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                  <select value={c.tag ?? ''} onChange={e => updateCompany(c.id, { tag: e.target.value })}
                    className={`text-xs border px-1.5 py-1 bg-white focus:outline-none w-full max-w-[160px] ${!c.tag ? 'border-amber-200 text-amber-600' : 'border-zinc-200 text-zinc-700'}`}>
                    <option value="">— bez tagu —</option>
                    {TAGI_ZADANIOWE.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </td>
                <td className="px-3 py-2.5 cursor-pointer" onClick={() => onSelectCompany(c)}>
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[c.status]??'bg-gray-100 text-gray-700'}`}>
                    {stages.find(s=>s.key===c.status)?.label??c.status}
                  </span>
                </td>
                <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-1">
                    {c.email && <a href={`mailto:${c.email}`} className="text-zinc-300 hover:text-blue-500 text-base" title={c.email}>✉</a>}
                    {isAdmin && <button onClick={() => setConfirmDelete(c.id)} className="text-xs px-2 py-0.5 border border-red-200 text-red-500 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors font-medium">USUŃ</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="flex items-center justify-center h-40 text-zinc-400 text-sm">Brak wyników</div>}
      </div>
      <div className="mt-2 text-xs text-zinc-400">{filtered.length} z {visible.length} firm</div>
    </div>
  );
}
