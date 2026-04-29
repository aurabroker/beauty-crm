import { useState, useEffect, useMemo } from 'react';
import { useCRMStore } from '../store/useCRMStore';
import type { Company, Reminder } from '../data/companies';

interface CalendarProps { onSelectCompany: (c: Company) => void; }
type CalView = 'day'|'workweek'|'month';

const MONTHS_PL = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
const DAYS_SHORT = ['Pon','Wt','Śr','Czw','Pt','Sob','Nd'];
const HOURS = Array.from({length:17},(_,i)=>i+6);

function sow(d:Date):Date{const r=new Date(d);r.setHours(0,0,0,0);const day=r.getDay();r.setDate(r.getDate()-(day===0?6:day-1));return r;}
function addDays(d:Date,n:number):Date{const r=new Date(d);r.setDate(r.getDate()+n);return r;}
function isSameDay(a:Date,b:Date){return a.toISOString().slice(0,10)===b.toISOString().slice(0,10);}
function fmtTime(s:string){if(!s)return'';return new Date(s).toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'});}
function fmtDate(d:Date){return d.toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit'});}
function daysLeftFn(s:string){return Math.ceil((new Date(s).getTime()-Date.now())/86400000);}

type CalItem = {
  id:string; company:Company; reminder:Reminder;
  isPolicy:boolean; daysLeft?:number;
};

export function Calendar({onSelectCompany}:CalendarProps){
  const {companies,addReminder,deleteReminder} = useCRMStore();
  const [view,setView]         = useState<CalView>('workweek');
  const [anchor,setAnchor]     = useState(()=>{const d=new Date();d.setHours(0,0,0,0);return d;});
  const [showForm,setShowForm] = useState(false);
  const [formDate,setFormDate] = useState('');
  const [formText,setFormText] = useState('');
  const [formType,setFormType] = useState<'notatka'|'telefon'|'spotkanie'>('telefon');
  const [formCompany,setFormCompany] = useState<Company|null>(null);
  const [companySearch,setCompanySearch] = useState('');
  const [draggedId,setDraggedId] = useState<string|null>(null);
  const [alertItem,setAlertItem] = useState<CalItem|null>(null);
  const [deleteAlert,setDeleteAlert] = useState<CalItem|null>(null);
  const [resignConfirm,setResignConfirm] = useState(false);

  const today=new Date();today.setHours(0,0,0,0);

  // Alert for upcoming events
  useEffect(()=>{
    const check=()=>{
      const now=Date.now();
      for(const c of companies){
        for(const r of c.reminders){
          if(!r.done&&Math.abs(new Date(r.date).getTime()-now)<5*60*1000){
            setAlertItem({id:r.id,company:c,reminder:r,isPolicy:r.text.startsWith('🛡️')});return;
          }
        }
      }
      setAlertItem(null);
    };
    check();const t=setInterval(check,30000);return()=>clearInterval(t);
  },[companies]);

  const companySuggestions=useMemo(()=>{
    if(!companySearch.trim()||companySearch.trim().length<2)return[];
    const q=companySearch.toLowerCase();
    return companies.filter(c=>c.company.toLowerCase().includes(q)).slice(0,6);
  },[companies,companySearch]);

  // Build all calendar items
  const allItems:CalItem[]=useMemo(()=>
    companies.flatMap(co=>co.reminders.filter(r=>!r.done).map(r=>{
      const isPolicy=r.text.startsWith('🛡️');
      let daysLeft:number|undefined;
      if(isPolicy){
        const bestPolicy=co.policies.filter(p=>p.dataDo&&p.status==='aktywna')
          .map(p=>daysLeftFn(p.dataDo)).filter(d=>d>=0).sort((a,b)=>a-b)[0];
        daysLeft=bestPolicy;
      }
      return{id:r.id,company:co,reminder:r,isPolicy,daysLeft};
    }))
  ,[companies]);

  const itemsForDay=(day:Date)=>
    allItems.filter(i=>i.reminder.date.slice(0,10)===day.toISOString().slice(0,10))
      .sort((a,b)=>a.reminder.date.localeCompare(b.reminder.date));

  const viewDays=():Date[]=>{
    if(view==='day')return[anchor];
    if(view==='workweek')return Array.from({length:5},(_,i)=>addDays(sow(anchor),i));
    const first=new Date(anchor.getFullYear(),anchor.getMonth(),1);
    const start=sow(first);
    return Array.from({length:42},(_,i)=>addDays(start,i));
  };
  const days=viewDays();

  const navigate=(dir:number)=>{
    if(view==='day')setAnchor(addDays(anchor,dir));
    else if(view==='workweek')setAnchor(addDays(anchor,dir*7));
    else{const d=new Date(anchor);d.setMonth(d.getMonth()+dir);setAnchor(d);}
  };

  const openAddForm=(dateStr?:string)=>{
    let def=dateStr??new Date().toISOString().slice(0,10)+'T09:00';
    if(def&&!def.includes('T'))def+='T09:00';
    const h=parseInt(def.split('T')[1]?.slice(0,2)??'9');
    const clamped=Math.max(6,Math.min(22,h));
    def=def.split('T')[0]+'T'+String(clamped).padStart(2,'0')+':00';
    setFormDate(def);setFormText('');setFormType('telefon');
    setFormCompany(null);setCompanySearch('');setShowForm(true);
  };

  const saveForm=async()=>{
    if(!formText.trim()||!formDate||!formCompany)return;
    const icons:Record<string,string>={telefon:'📞',spotkanie:'🤝',notatka:'📝'};
    const txt=`${icons[formType]} ${formText.trim()}`;
    await addReminder(formCompany.id,{id:crypto.randomUUID(),date:new Date(formDate).toISOString(),text:txt,done:false});
    setShowForm(false);
  };

  const handleDrop=(day:Date,hour:number,e:React.DragEvent)=>{
    e.preventDefault();
    if(!draggedId)return;
    const item=allItems.find(i=>i.id===draggedId);
    if(!item||item.isPolicy)return; // Can't drag policy reminders
    const newDate=new Date(day);newDate.setHours(hour,0,0,0);
    // Delete old + add new
    deleteReminder(item.company.id,item.id);
    addReminder(item.company.id,{id:crypto.randomUUID(),date:newDate.toISOString(),text:item.reminder.text,done:false});
    setDraggedId(null);
  };

  const tryDeleteItem=(item:CalItem)=>{
    if(item.isPolicy){setDeleteAlert(item);setResignConfirm(false);}
    else{if(window.confirm('Usunąć to przypomnienie?'))deleteReminder(item.company.id,item.id);}
  };

  const confirmDeletePolicy=async()=>{
    if(!resignConfirm){alert('Zaznacz potwierdzenie rezygnacji!');return;}
    if(!deleteAlert)return;
    deleteReminder(deleteAlert.company.id,deleteAlert.id);
    setDeleteAlert(null);
  };

  const Chip=({item,small=false}:{item:CalItem;small?:boolean})=>{
    const isP=item.isPolicy;

    return(
      <div
        draggable={!isP}
        onDragStart={()=>!isP&&setDraggedId(item.id)}
        onDragEnd={()=>setDraggedId(null)}
        className={`text-[10px] px-1.5 py-0.5 mb-0.5 flex items-center justify-between gap-1 ${isP?'bg-amber-100 border-l-4 border-amber-500 text-amber-900':'bg-blue-100 border-l-4 border-blue-500 text-blue-900'} ${!isP?'cursor-grab active:cursor-grabbing':'cursor-pointer'}`}
        onClick={e=>{e.stopPropagation();onSelectCompany(item.company);}}>
        <span className="truncate">
          {!small&&<span className="font-semibold">{item.company.company}</span>}
          {isP&&item.daysLeft!==undefined&&<span className="ml-1">— {item.daysLeft} dni</span>}
          {!isP&&!small&&<span className="ml-1 opacity-70">{fmtTime(item.reminder.date)}</span>}
          {small&&<span>{isP?'🛡️':'📌'} {item.company.company.slice(0,15)}</span>}
        </span>
        <button onMouseDown={e=>{e.stopPropagation();tryDeleteItem(item);}}
          className={`font-bold flex-shrink-0 hover:text-red-600 ${isP?'text-amber-600':'text-blue-400'}`}>✕</button>
      </div>
    );
  };

  return(
    <div className="flex flex-col h-full">

      {/* Alert */}
      {alertItem&&(
        <div className="mb-2 px-4 py-2 bg-red-600 text-white text-sm font-medium flex items-center justify-between animate-pulse">
          <span>🔔 Zaraz: <strong>{alertItem.reminder.text.slice(0,60)}</strong> — {alertItem.company.company}</span>
          <button onClick={()=>setAlertItem(null)} className="text-white/70">✕</button>
        </div>
      )}

      {/* Delete policy reminder confirmation */}
      {deleteAlert&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white border-2 border-red-300 shadow-xl p-6 w-[480px]">
            <div className="text-base font-bold text-zinc-900 mb-2">⚠️ Usunięcie przypomnienia o polisie</div>
            <div className="text-sm text-zinc-600 mb-1">{deleteAlert.company.company}</div>
            <div className="text-xs text-zinc-400 mb-4">{deleteAlert.reminder.text}</div>
            <div className="bg-red-50 border border-red-200 p-3 mb-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={resignConfirm} onChange={e=>setResignConfirm(e.target.checked)}
                  className="mt-1 accent-red-600 w-4 h-4 flex-shrink-0"/>
                <span className="text-sm text-red-800 font-medium">
                  Potwierdzam, że klient ZREZYGNOWAŁ z odnowienia polisy.
                </span>
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setDeleteAlert(null)} className="px-4 py-2 text-sm border border-zinc-200 text-zinc-600">Anuluj</button>
              <button onClick={confirmDeletePolicy} disabled={!resignConfirm}
                className="px-4 py-2 text-sm bg-red-600 text-white disabled:opacity-40">Oznacz jako rezygnacja</button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0 flex-wrap">
        <div className="flex gap-0.5 border border-zinc-200">
          {(['day','workweek','month'] as CalView[]).map(v=>(
            <button key={v} onClick={()=>setView(v)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${view===v?'bg-zinc-900 text-white':'text-zinc-600 hover:bg-zinc-100'}`}>
              {v==='day'?'Dzień':v==='workweek'?'Tydzień':'Miesiąc'}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button onClick={()=>navigate(-1)} className="px-2 py-1.5 text-sm border border-zinc-200 hover:border-zinc-900">←</button>
          <button onClick={()=>setAnchor(new Date(today))} className="px-3 py-1.5 text-xs border border-zinc-200 hover:border-zinc-900">Dziś</button>
          <button onClick={()=>navigate(1)} className="px-2 py-1.5 text-sm border border-zinc-200 hover:border-zinc-900">→</button>
        </div>
        <span className="text-sm font-medium text-zinc-700">
          {view==='day'?anchor.toLocaleDateString('pl-PL',{weekday:'long',day:'numeric',month:'long'})
          :view==='workweek'?`${fmtDate(sow(anchor))} — ${fmtDate(addDays(sow(anchor),4))} ${anchor.getFullYear()}`
          :`${MONTHS_PL[anchor.getMonth()]} ${anchor.getFullYear()}`}
        </span>
        <button onClick={()=>openAddForm()} className="ml-auto h-8 px-4 text-xs bg-zinc-900 text-white hover:bg-zinc-700">+ Dodaj zdarzenie</button>
      </div>

      {/* DAY/WORKWEEK */}
      {(view==='day'||view==='workweek')&&(
        <div className="flex-1 overflow-auto border border-zinc-200 bg-white">
          <div className="grid sticky top-0 z-10 bg-white border-b border-zinc-200"
            style={{gridTemplateColumns:`52px repeat(${days.length},1fr)`}}>
            <div className="border-r border-zinc-100"/>
            {days.map((d,i)=>{
              const isT=isSameDay(d,today);
              return(
                <div key={i} className={`text-center py-2 border-r border-zinc-100 ${isT?'bg-zinc-900 text-white':''}`}>
                  <div className="text-[10px] uppercase tracking-widest">{DAYS_SHORT[(d.getDay()+6)%7]}</div>
                  <div className={`text-lg font-bold font-mono ${isT?'text-white':'text-zinc-900'}`}>{d.getDate()}</div>
                </div>
              );
            })}
          </div>
          {HOURS.map(h=>(
            <div key={h} className="grid border-b border-zinc-100 min-h-[52px]"
              style={{gridTemplateColumns:`52px repeat(${days.length},1fr)`}}>
              <div className="text-[10px] text-zinc-400 font-mono text-right pr-2 pt-1 border-r border-zinc-100">{String(h).padStart(2,'0')}:00</div>
              {days.map((d,di)=>{
                const isT=isSameDay(d,today);
                const items=itemsForDay(d).filter(i=>new Date(i.reminder.date).getHours()===h);
                return(
                  <div key={di}
                    className={`border-r border-zinc-100 px-0.5 pt-0.5 min-h-[52px] transition-colors ${isT?'bg-amber-50/30':''}`}
                    onDragOver={e=>e.preventDefault()}
                    onDrop={e=>handleDrop(d,h,e)}
                    onClick={()=>openAddForm(`${d.toISOString().slice(0,10)}T${String(h).padStart(2,'0')}:00`)}>
                    {items.map(item=><Chip key={item.id} item={item} small/>)}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* MONTH */}
      {view==='month'&&(
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-7 border-t border-l border-zinc-200">
            {DAYS_SHORT.map(d=>(
              <div key={d} className="text-center py-2 text-xs font-medium uppercase tracking-widest text-zinc-500 border-b border-r border-zinc-200 bg-zinc-50">{d}</div>
            ))}
            {days.map((d,i)=>{
              const isT=isSameDay(d,today);
              const inMon=d.getMonth()===anchor.getMonth();
              const items=itemsForDay(d);
              return(
                <div key={i} onClick={()=>openAddForm(d.toISOString().slice(0,10))}
                  className={`border-b border-r border-zinc-200 p-1 min-h-[90px] cursor-pointer hover:bg-zinc-50 ${!inMon?'bg-zinc-50/60':''}`}>
                  <div className={`text-xs font-mono mb-1 w-6 h-6 flex items-center justify-center ${isT?'bg-zinc-900 text-white rounded-full':'text-zinc-500'} ${!inMon?'opacity-40':''}`}>{d.getDate()}</div>
                  {items.slice(0,3).map(item=><Chip key={item.id} item={item}/>)}
                  {items.length>3&&<div className="text-[10px] text-zinc-400">+{items.length-3}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ADD FORM */}
      {showForm&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={e=>{if(e.target===e.currentTarget)setShowForm(false);}}>
          <div className="bg-white w-[460px] shadow-2xl border border-zinc-200">
            <div className="bg-zinc-900 text-white px-5 py-4 flex items-center justify-between">
              <span className="font-bold text-sm uppercase tracking-widest">Nowe zdarzenie</span>
              <button onClick={()=>setShowForm(false)} className="text-zinc-400 hover:text-white">✕</button>
            </div>
            <div className="p-5 space-y-3">
              {/* Klient */}
              <div className="relative">
                <div className="text-xs text-zinc-500 mb-1">Klient * (wymagane)</div>
                <input value={companySearch} onChange={e=>{setCompanySearch(e.target.value);setFormCompany(null);}}
                  placeholder="Zacznij pisać nazwę..."
                  className={`w-full h-9 border px-3 text-sm focus:outline-none ${formCompany?'border-emerald-400 bg-emerald-50':'border-zinc-300 focus:border-zinc-900'}`}/>
                {formCompany&&<div className="text-xs text-emerald-600 mt-0.5">✓ {formCompany.company}</div>}
                {companySuggestions.length>0&&!formCompany&&(
                  <div className="absolute z-10 top-full left-0 right-0 bg-white border border-zinc-200 shadow-lg">
                    {companySuggestions.map(c=>(
                      <button key={c.id} onClick={()=>{setFormCompany(c);setCompanySearch(c.company);}}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 border-b border-zinc-100 last:border-0">
                        {c.company}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Typ */}
              <div className="flex gap-1">
                {(['telefon','spotkanie','notatka'] as const).map(t=>(
                  <button key={t} onClick={()=>setFormType(t)}
                    className={`flex-1 py-1.5 text-xs border transition-colors ${formType===t?'bg-zinc-900 text-white border-zinc-900':'border-zinc-200 text-zinc-600 hover:border-zinc-900'}`}>
                    {t==='telefon'?'📞 Telefon':t==='spotkanie'?'🤝 Spotkanie':'📝 Notatka'}
                  </button>
                ))}
              </div>
              {/* Treść */}
              <div>
                <div className="text-xs text-zinc-500 mb-1">Opis *</div>
                <input value={formText} onChange={e=>setFormText(e.target.value)} placeholder="np. Omówienie oferty OC..."
                  className="w-full h-9 border border-zinc-300 px-3 text-sm focus:outline-none focus:border-zinc-900"/>
              </div>
              {/* Data */}
              <div>
                <div className="text-xs text-zinc-500 mb-1">Data i godzina *</div>
                <input type="datetime-local" value={formDate} onChange={e=>setFormDate(e.target.value)}
                  className="w-full h-9 border border-zinc-300 px-3 text-sm focus:outline-none focus:border-zinc-900"/>
              </div>
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <button onClick={()=>setShowForm(false)} className="px-4 py-2 text-sm border border-zinc-200 text-zinc-600">Anuluj</button>
              <button onClick={saveForm} disabled={!formText.trim()||!formDate||!formCompany}
                className="px-4 py-2 text-sm bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-40">Zapisz</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
