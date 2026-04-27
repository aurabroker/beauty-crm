import { useState, useMemo, useRef } from 'react';
import { useCRMStore } from '../store/useCRMStore';
import type { Company } from '../data/companies';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { lookupByNIP } from '../lib/gus';

interface DashboardProps { onSelectCompany: (c: Company) => void; }
type SortKey = 'employees' | 'company' | 'revenue';
type SortDir = 'asc' | 'desc';

const STATUS_COLORS: Record<string,string> = {
  lead:'bg-gray-100 text-gray-700', kontakt:'bg-blue-100 text-blue-700',
  oferta:'bg-amber-100 text-amber-700', negocjacje:'bg-purple-100 text-purple-700',
  zamkniety:'bg-emerald-100 text-emerald-700', stracony:'bg-red-100 text-red-700',
};

export function Dashboard({ onSelectCompany }: DashboardProps) {
  const { companies, stages, addCompany, deleteCompany, importCompanies, currentUser } = useCRMStore();
  const [search, setSearch] = useState('');
  const [filterCity, setFilterCity] = useState('all');
  const [filterIndustry, setFilterIndustry] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('employees');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showAdd, setShowAdd] = useState(false);
  const [newCo, setNewCo] = useState<Record<string,string>>({});
  const [confirmDelete, setConfirmDelete] = useState<number|null>(null);
  const [importing, setImporting] = useState(false);
  const csvRef = useRef<HTMLInputElement>(null);
  const isAdmin = currentUser?.role === 'admin';
  const [nipInput, setNipInput] = useState('');
  const [gusLoading, setGusLoading] = useState(false);
  const [gusError, setGusError] = useState('');

  const handleGUSLookup = async () => {
    if (!nipInput.trim()) return;
    setGusLoading(true); setGusError('');
    try {
      const data = await lookupByNIP(nipInput);
      if (data) {
        setNewCo(p => ({ ...p, company: data.name, city: data.city, nip: data.nip, regon: data.regon }));
        setGusError('');
      } else { setGusError('Nie znaleziono firmy o tym NIP'); }
    } catch(e: unknown) { setGusError((e as Error).message); }
    finally { setGusLoading(false); }
  };

  const visible = isAdmin ? companies : companies.filter(c => !c.assignedTo || c.assignedTo === currentUser?.name);
  const cities = useMemo(() => ['all',...Array.from(new Set(visible.map(c=>c.city))).filter(Boolean).sort()], [visible]);
  const industries = useMemo(() => ['all',...Array.from(new Set(visible.map(c=>c.industry))).filter(Boolean).sort()], [visible]);

  const filtered = useMemo(() => {
    let r = visible;
    if (search) r = r.filter(c=>`${c.company} ${c.contact} ${c.city}`.toLowerCase().includes(search.toLowerCase()));
    if (filterCity!=='all') r = r.filter(c=>c.city===filterCity);
    if (filterIndustry!=='all') r = r.filter(c=>c.industry===filterIndustry);
    if (filterStatus!=='all') r = r.filter(c=>c.status===filterStatus);
    return [...r].sort((a,b) => {
      if (sortKey==='employees') { const va=parseInt(a.employees||'0')||0,vb=parseInt(b.employees||'0')||0; return sortDir==='asc'?va-vb:vb-va; }
      if (sortKey==='revenue') return sortDir==='asc'?a.revenue-b.revenue:b.revenue-a.revenue;
      return sortDir==='asc'?a.company.localeCompare(b.company):b.company.localeCompare(a.company);
    });
  }, [visible,search,filterCity,filterIndustry,filterStatus,sortKey,sortDir]);

  const toggleSort = (k:SortKey) => { if (sortKey===k) setSortDir(d=>d==='asc'?'desc':'asc'); else {setSortKey(k);setSortDir('desc');} };
  const SI = ({k}:{k:SortKey}) => <span className="ml-1 text-[10px] opacity-40">{sortKey===k?(sortDir==='desc'?'↓':'↑'):'↕'}</span>;

  const handleCSV = async (e:React.ChangeEvent<HTMLInputElement>) => {
    const file=e.target.files?.[0]; if(!file) return;
    setImporting(true);
    const text=await file.text();
    const lines=text.split('\n').filter(Boolean);
    const headers=lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/"/g,''));
    const rows=lines.slice(1).map(line=>{
      const vals=line.split(',').map(v=>v.trim().replace(/"/g,''));
      const obj:Record<string,string>={};
      headers.forEach((h,i)=>{obj[h]=vals[i]??'';});
      return {
        company:obj.company||obj.nazwa||obj.name||'', contact:obj.contact||obj.kontakt||'',
        phone:obj.phone||obj.telefon||'', email:obj.email||'', city:obj.city||obj.miasto||'',
        state:obj.state||obj.województwo||'', industry:obj.industry||obj.branża||'',
        employees:obj.employees||obj.pracownicy||'', revenue:Number(obj.revenue||obj.przychód||0),
        url:obj.url||obj.www||''
      } as Partial<Company>;
    }).filter(r=>r.company);
    await importCompanies(rows);
    setImporting(false);
    if(csvRef.current) csvRef.current.value='';
  };

  const handleAdd = async () => {
    if (!newCo.company?.trim()) return;
    await addCompany({ ...newCo, revenue: Number(newCo.revenue)||0 });
    setNewCo({}); setShowAdd(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Input placeholder="Szukaj firmy, kontaktu, miasta..." value={search} onChange={e=>setSearch(e.target.value)}
          className="w-56 h-9 text-sm rounded-none border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-900"/>
        <Select value={filterCity} onValueChange={setFilterCity}>
          <SelectTrigger className="w-36 h-9 text-sm rounded-none border-zinc-200 focus:ring-0"><SelectValue/></SelectTrigger>
          <SelectContent className="rounded-none max-h-60">{cities.map(c=><SelectItem key={c} value={c}>{c==='all'?'Wszystkie miasta':c}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterIndustry} onValueChange={setFilterIndustry}>
          <SelectTrigger className="w-44 h-9 text-sm rounded-none border-zinc-200 focus:ring-0"><SelectValue/></SelectTrigger>
          <SelectContent className="rounded-none max-h-60">{industries.map(i=><SelectItem key={i} value={i}>{i==='all'?'Wszystkie branże':i}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-9 text-sm rounded-none border-zinc-200 focus:ring-0"><SelectValue/></SelectTrigger>
          <SelectContent className="rounded-none"><SelectItem value="all">Wszystkie statusy</SelectItem>{stages.map(s=><SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
        {(search||filterCity!=='all'||filterIndustry!=='all'||filterStatus!=='all') &&
          <button onClick={()=>{setSearch('');setFilterCity('all');setFilterIndustry('all');setFilterStatus('all');}}
            className="h-9 px-3 text-xs text-zinc-500 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-900">Wyczyść</button>}
        <div className="ml-auto flex gap-2">
          <label className={`h-9 px-3 text-xs flex items-center gap-1.5 border cursor-pointer transition-colors ${importing?'border-zinc-200 text-zinc-300':'border-zinc-300 text-zinc-600 hover:border-zinc-900 hover:text-zinc-900'}`}>
            <span>↑</span> {importing?'Importuję...':'Import CSV'}
            <input ref={csvRef} type="file" accept=".csv" className="hidden" onChange={handleCSV} disabled={importing}/>
          </label>
          <button onClick={()=>setShowAdd(true)} className="h-9 px-3 text-xs bg-zinc-900 text-white hover:bg-zinc-700 transition-colors">+ Dodaj firmę</button>
        </div>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={e=>{if(e.target===e.currentTarget)setShowAdd(false);}}>
          <div className="bg-white w-[560px] shadow-2xl border border-zinc-200">
            <div className="bg-zinc-900 text-white px-5 py-4 flex items-center justify-between">
              <span className="font-bold text-sm uppercase tracking-widest">Nowa firma</span>
              <button onClick={()=>setShowAdd(false)} className="text-zinc-400 hover:text-white text-lg">✕</button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-3">
              {([['Nazwa firmy *','company'],['Kontakt','contact'],['Stanowisko','title'],['Telefon','phone'],['E-mail','email'],['Miasto','city'],['Województwo','state'],['Branża','industry'],['Pracownicy','employees'],['WWW','url']] as [string,string][]).map(([label,key])=>(
                <div key={key}>
                  <div className="text-xs text-zinc-500 mb-1">{label}</div>
                  <Input value={newCo[key]??''} onChange={e=>setNewCo(p=>({...p,[key]:e.target.value}))}
                    className="h-8 text-sm rounded-none border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-900"/>
                </div>
              ))}
            </div>
            {/* GUS lookup */}
            <div className="px-5 pb-3 border-t border-zinc-100 pt-3">
              <div className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-2">🔍 Pobierz dane z GUS (po NIP)</div>
              <div className="flex gap-2">
                <input value={nipInput} onChange={e=>setNipInput(e.target.value)} placeholder="np. 5270103391"
                  className="flex-1 h-8 text-sm border border-zinc-200 px-2 focus:outline-none focus:border-zinc-900 font-mono"/>
                <button onClick={handleGUSLookup} disabled={gusLoading||!nipInput.trim()}
                  className="px-3 h-8 text-xs bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors whitespace-nowrap">
                  {gusLoading?'Szukam...':'Pobierz z GUS'}
                </button>
              </div>
              {gusError&&<div className="text-xs text-red-500 mt-1">{gusError}</div>}
              <div className="text-xs text-zinc-400 mt-1">Dane z Białej Listy MF (NIP → nazwa, miasto, REGON)</div>
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button onClick={()=>setShowAdd(false)} className="px-4 py-2 text-sm border border-zinc-200 text-zinc-600 hover:border-zinc-900">Anuluj</button>
              <button onClick={handleAdd} disabled={!newCo.company?.trim()} className="px-4 py-2 text-sm bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-40">Zapisz</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {confirmDelete!==null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white border border-zinc-200 shadow-xl p-6 w-80">
            <div className="font-bold text-zinc-900 mb-1">Usuń firmę?</div>
            <div className="text-sm text-zinc-500 mb-4">Operacja nieodwracalna. Usuniecie też historię i przypomnienia.</div>
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setConfirmDelete(null)} className="px-3 py-1.5 text-sm border border-zinc-200 text-zinc-600 hover:border-zinc-900">Anuluj</button>
              <button onClick={async()=>{await deleteCompany(confirmDelete);setConfirmDelete(null);}} className="px-3 py-1.5 text-sm bg-red-600 text-white hover:bg-red-700">Usuń</button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto border border-zinc-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 text-white sticky top-0 z-10">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium tracking-widest uppercase w-8">#</th>
              <th className="text-left px-4 py-3 text-xs font-medium tracking-widest uppercase">
                <button onClick={()=>toggleSort('company')} className="flex items-center hover:text-zinc-300">Firma <SI k="company"/></button>
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium tracking-widest uppercase">Kontakt</th>
              <th className="text-left px-4 py-3 text-xs font-medium tracking-widest uppercase">Miasto</th>
              <th className="text-left px-4 py-3 text-xs font-medium tracking-widest uppercase">Branża</th>
              <th className="text-left px-4 py-3 text-xs font-medium tracking-widest uppercase">
                <button onClick={()=>toggleSort('employees')} className="flex items-center hover:text-zinc-300">👥 Pracownicy <SI k="employees"/></button>
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium tracking-widest uppercase">Status</th>
              <th className="px-4 py-3 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((company,i)=>(
              <tr key={company.id} className={`border-b border-zinc-100 hover:bg-amber-50 transition-colors ${i%2===0?'bg-white':'bg-zinc-50/40'}`}>
                <td className="px-4 py-3 text-zinc-300 text-xs font-mono cursor-pointer" onClick={()=>onSelectCompany(company)}>{i+1}</td>
                <td className="px-4 py-3 cursor-pointer" onClick={()=>onSelectCompany(company)}>
                  <div className="font-semibold text-zinc-900 text-sm">{company.company}</div>
                  {company.url&&<div className="text-xs text-zinc-400 mt-0.5">{company.url.replace(/https?:\/\//,'')}</div>}
                </td>
                <td className="px-4 py-3 text-zinc-600 cursor-pointer" onClick={()=>onSelectCompany(company)}>
                  <div>{company.contact||<span className="text-zinc-300">—</span>}</div>
                  {company.title&&<div className="text-xs text-zinc-400">{company.title}</div>}
                </td>
                <td className="px-4 py-3 text-zinc-600 cursor-pointer" onClick={()=>onSelectCompany(company)}>{company.city||'—'}</td>
                <td className="px-4 py-3 text-zinc-500 text-xs cursor-pointer" onClick={()=>onSelectCompany(company)}>{company.industry||'—'}</td>
                <td className="px-4 py-3 cursor-pointer" onClick={()=>onSelectCompany(company)}>
                  <span className="font-mono font-bold text-zinc-900 text-lg">
                    {company.employees?Number(company.employees).toLocaleString('pl-PL'):<span className="text-zinc-300 font-normal text-sm">—</span>}
                  </span>
                </td>
                <td className="px-4 py-3 cursor-pointer" onClick={()=>onSelectCompany(company)}>
                  <span className={`inline-block px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[company.status]??'bg-gray-100 text-gray-700'}`}>
                    {stages.find(s=>s.key===company.status)?.label??company.status}
                  </span>
                </td>
                <td className="px-4 py-3" onClick={e=>e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    {company.email&&(
                      <a href={`mailto:${company.email}`}
                        className="text-xs px-2 py-1 border border-zinc-200 text-zinc-500 hover:border-blue-400 hover:text-blue-600 transition-colors whitespace-nowrap"
                        title={company.email}>✉ Email</a>
                    )}
                    {isAdmin&&(
                      <button onClick={()=>setConfirmDelete(company.id)}
                        className="text-xs px-2 py-1 border border-red-200 text-red-500 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors font-medium whitespace-nowrap">
                        USUŃ
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length===0&&<div className="flex items-center justify-center h-40 text-zinc-400 text-sm">Brak wyników dla podanych filtrów</div>}
      </div>
      <div className="mt-2 text-xs text-zinc-400">{filtered.length} z {visible.length} firm</div>
    </div>
  );
}
