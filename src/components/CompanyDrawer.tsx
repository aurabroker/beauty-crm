import { useState } from 'react';
import { useCRMStore } from '../store/useCRMStore';
import type { Company, ContactHistory } from '../data/companies';
import { RODZAJE_UBEZPIECZEN, TAGI_ZADANIOWE } from '../data/companies';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const STATUS_COLORS: Record<string,string> = {
  lead:'bg-gray-100 text-gray-700', kontakt:'bg-pink-100 text-pink-700', oferta:'bg-amber-100 text-amber-700',
  negocjacje:'bg-purple-100 text-purple-700', zamkniety:'bg-emerald-100 text-emerald-700', stracony:'bg-red-100 text-red-700',
};
const HIST_ICONS: Record<string,string> = { notatka:'📝', telefon:'📞', email:'✉️', spotkanie:'🤝' };
const HIST_LABELS: Record<string,string> = { notatka:'Notatka', telefon:'Telefon', email:'E-mail', spotkanie:'Spotkanie' };

function fmtDate(s: string) { if (!s) return '—'; return new Date(s).toLocaleDateString('pl-PL', { day:'2-digit', month:'2-digit', year:'numeric' }); }
function fmtDT(s: string)   { if (!s) return '—'; return new Date(s).toLocaleDateString('pl-PL', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); }
function calcReminder(d: string): string { if (!d) return ''; const dt = new Date(d); dt.setDate(dt.getDate()-45); return dt.toISOString().split('T')[0]; }
function daysLeft(d: string): number { return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000); }
function today12m(): { today: string; plus12: string } {
  const t = new Date(); const p = new Date(); p.setFullYear(p.getFullYear()+1);
  return { today: t.toISOString().split('T')[0], plus12: p.toISOString().split('T')[0] };
}

type Tab = 'info' | 'polisy' | 'historia' | 'przypomnienia';

export function CompanyDrawer({ company, onClose }: { company: Company; onClose: () => void }) {
  const { stages, addHistory, addReminder, toggleReminder, deleteReminder, updateCompanyStatus,
          addPolicy, updatePolicy, deletePolicy, updateCompany, currentUser } = useCRMStore();
  const [tab, setTab] = useState<Tab>('info');
  const [histType, setHistType] = useState<ContactHistory['type']>('notatka');
  const [histNote, setHistNote] = useState('');
  const [reminderText, setReminderText] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [editingPolicyId, setEditingPolicyId] = useState<string|null>(null);
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const { today, plus12 } = today12m();
  const emptyForm = () => ({ nrPolisy:'', rodzaj:'', sumaUbezpieczenia:'', skladka:'', skladkaOkres:'jednorazowa' as 'jednorazowa'|'miesięczna'|'kwartalna'|'roczna', dataOd: today, dataDo: plus12, status:'aktywna' as 'aktywna'|'wygasła'|'anulowana', notes:'', ochronaPrawna: false });
  const [policyForm, setPolicyForm] = useState(emptyForm());

  const activePolicies = company.policies.filter(p => p.status === 'aktywna');
  const activeReminders = company.reminders.filter(r => !r.done).length;

  const handleAddHistory = () => {
    if (!histNote.trim()) return;
    addHistory(company.id, { id: crypto.randomUUID(), type: histType, date: new Date().toISOString(), note: histNote.trim(), author: currentUser?.name ?? '' });
    setHistNote('');
  };

  const handleAddReminder = () => {
    if (!reminderText.trim() || !reminderDate) return;
    addReminder(company.id, { id: crypto.randomUUID(), date: reminderDate, text: reminderText.trim(), done: false });
    setReminderText(''); setReminderDate('');
  };

  const startEdit = (policyId: string) => {
    const p = company.policies.find(p => p.id === policyId);
    if (!p) return;
    setPolicyForm({
      nrPolisy: p.nrPolisy, rodzaj: p.rodzaj, ochronaPrawna: p.ochronaPrawna ?? false,
      sumaUbezpieczenia: p.sumaUbezpieczenia.replace(/[^\d]/g,''),
      skladka: p.skladka?.toString() ?? '',
      skladkaOkres: p.skladkaOkres, dataOd: p.dataOd?.slice(0,10) ?? '',
      dataDo: p.dataDo?.slice(0,10) ?? '', status: p.status, notes: p.notes,
    });
    setEditingPolicyId(policyId);
    setShowPolicyForm(true);
  };

  const handleSavePolicy = async () => {
    if (!policyForm.nrPolisy || !policyForm.rodzaj) return;
    setSaving(true);
    const data = {
      nrPolisy: policyForm.nrPolisy, rodzaj: policyForm.rodzaj,
      sumaUbezpieczenia: policyForm.sumaUbezpieczenia ? (policyForm.sumaUbezpieczenia.includes('000') ? policyForm.sumaUbezpieczenia + ' PLN' : `${Number(policyForm.sumaUbezpieczenia.replace(/\s/g,'')) ? Number(policyForm.sumaUbezpieczenia.replace(/\s/g,'')).toLocaleString('pl-PL') + ' PLN' : policyForm.sumaUbezpieczenia}`) : '',
      skladka: policyForm.skladka ? Number(policyForm.skladka) : null,
      skladkaOkres: policyForm.skladkaOkres, dataOd: policyForm.dataOd,
      dataDo: policyForm.dataDo, status: policyForm.status, notes: policyForm.notes,
    };
    if (editingPolicyId) {
      await updatePolicy(editingPolicyId, data);
    } else {
      await addPolicy(company.id, { ...data, ochronaPrawna: policyForm.ochronaPrawna, przypomnienie: calcReminder(policyForm.dataDo) });
    }
    setPolicyForm(emptyForm()); setShowPolicyForm(false); setEditingPolicyId(null); setSaving(false);
  };

  const cancelForm = () => { setPolicyForm(emptyForm()); setShowPolicyForm(false); setEditingPolicyId(null); };

  const reminderPreview = policyForm.dataDo ? calcReminder(policyForm.dataDo) : '';

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose}/>
      {/* 760px drawer */}
      <div className="w-[760px] bg-white h-full flex flex-col shadow-2xl border-l border-zinc-200">

        {/* Header */}
        <div className="bg-zinc-900 text-white px-6 py-4 flex-shrink-0">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 pr-4">
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Karta klienta</div>
              <h2 className="font-bold text-xl leading-tight">{company.company}</h2>
              {company.contact && <div className="text-zinc-400 text-sm mt-0.5">{company.contact} {company.title && `· ${company.title}`}</div>}
            </div>
            <button onClick={onClose} className="text-zinc-400 hover:text-white text-2xl mt-1">✕</button>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={company.status} onValueChange={v => updateCompanyStatus(company.id, v as Company['status'])}>
              <SelectTrigger className={`h-7 w-32 text-xs rounded-none border-0 font-semibold ${STATUS_COLORS[company.status]} focus:ring-0`}>
                <SelectValue/>
              </SelectTrigger>
              <SelectContent className="rounded-none">
                {stages.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {activePolicies.length > 0 && (
              <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 font-medium">🛡️ {activePolicies.length} polisa</span>
            )}
            {company.nip && <span className="text-xs text-zinc-400 font-mono">NIP: {company.nip}</span>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-200 bg-zinc-50 flex-shrink-0">
          {(['info','polisy','historia','przypomnienia'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 text-xs font-medium uppercase tracking-wider transition-colors ${tab===t ? 'bg-white text-zinc-900 border-b-2 border-zinc-900' : 'text-zinc-400 hover:text-zinc-700'}`}>
              {t==='polisy' ? `🛡️ Polisy${company.policies.length ? ` (${company.policies.length})` : ''}`
               : t==='historia' ? `Historia${company.history.length ? ` (${company.history.length})` : ''}`
               : t==='przypomnienia' ? `Przypomnienia${activeReminders ? ` (${activeReminders})` : ''}`
               : 'Informacje'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── INFO ── */}
          {tab === 'info' && (
            <div className="p-6 grid grid-cols-2 gap-5">
              <div className="space-y-4">
                <Section title="Dane firmy">
                  <Row label="Branża"     value={company.industry || '—'}/>
                  <Row label="Miasto"     value={company.city || '—'}/>
                  <Row label="NIP"        value={company.nip || '—'} mono/>
                  <Row label="Pracownicy" value={company.employees ? Number(company.employees).toLocaleString('pl-PL') : '—'} mono/>
                  {company.url && <Row label="WWW" value={<a href={company.url} target="_blank" rel="noopener" className="text-blue-600 hover:underline text-sm">{company.url.replace(/https?:\/\//,'')}</a>}/>}
                </Section>

                {/* Zainteresowania — widoczne w Lead */}
                <div className="border border-dashed border-pink-200 bg-pink-50 p-3">
                  <div className="text-[10px] font-bold text-pink-400 uppercase tracking-widest mb-2">Zainteresowania (z leadu)</div>
                  {company.zainteresowania
                    ? <div className="flex flex-wrap gap-1.5">
                        {company.zainteresowania.split(',').map(z => (
                          <span key={z} className="text-xs px-2 py-0.5 bg-pink-100 text-pink-700 font-medium border border-pink-200">{z.trim()}</span>
                        ))}
                      </div>
                    : <div className="text-xs text-zinc-400">Brak zainteresowań z leadu</div>
                  }
                  {company.ubezpieczenie && company.ubezpieczenie !== company.zainteresowania && (
                    <div className="mt-2 text-xs text-zinc-400">Lead: {company.ubezpieczenie}</div>
                  )}
                </div>

                <Section title="Tag zadaniowy">
                  <div className="px-3 py-2">
                    <select value={company.tag ?? ''} onChange={e => updateCompany(company.id, { tag: e.target.value })}
                      className="w-full text-sm border border-zinc-200 px-2 py-1.5 bg-white focus:outline-none focus:border-zinc-900">
                      <option value="">— bez tagu —</option>
                      {TAGI_ZADANIOWE.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </Section>
              </div>

              <div className="space-y-4">
                <Section title="Kontakt">
                  <Row label="Osoba"     value={company.contact || '—'}/>
                  {company.phone && <Row label="Telefon" value={<a href={`tel:${company.phone}`} className="text-blue-600 hover:underline">{company.phone}</a>}/>}
                  {company.email && <Row label="E-mail"  value={<a href={`mailto:${company.email}`} className="text-blue-600 hover:underline text-xs break-all">{company.email}</a>}/>}
                </Section>
                <Section title="Dane z formularza">
                  {company.przychod && <Row label="Przychód" value={company.przychod}/>}
                </Section>
                {company.notes && (
                  <Section title="Notatki">
                    <div className="px-3 py-2 text-sm text-zinc-600 whitespace-pre-wrap">{company.notes}</div>
                  </Section>
                )}
              </div>
            </div>
          )}

          {/* ── POLISY ── */}
          {tab === 'polisy' && (
            <div className="p-6">
              {/* Policy list */}
              {company.policies.length > 0 && !showPolicyForm && (
                <div className="space-y-3 mb-4">
                  {company.policies.map(p => {
                    const days = p.dataDo ? daysLeft(p.dataDo) : null;
                    const expiring = days !== null && days <= 45 && days > 0;
                    const expired = days !== null && days <= 0;
                    return (
                      <div key={p.id} className={`border p-4 ${expired ? 'border-red-200 bg-red-50' : expiring ? 'border-amber-200 bg-amber-50' : 'border-zinc-200 bg-white'}`}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-zinc-900">{p.rodzaj}</span>
                              {p.nrPolisy && <span className="text-xs font-mono bg-zinc-100 text-zinc-600 px-2 py-0.5 border border-zinc-200">#{p.nrPolisy}</span>}
                              <span className={`text-xs px-2 py-0.5 font-medium ${p.status==='aktywna' ? 'bg-emerald-100 text-emerald-700' : p.status==='wygasła' ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-500'}`}>{p.status}</span>
                            </div>
                            <div className="text-xs text-zinc-400 mt-0.5">Dodano: {fmtDT(p.createdAt)}{p.createdBy ? ` · ${p.createdBy}` : ''}</div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => startEdit(p.id)} className="text-xs px-2 py-1 border border-zinc-200 text-zinc-600 hover:border-zinc-900 transition-colors">✏ Edytuj</button>
                            <button onClick={() => deletePolicy(p.id, company.id)} className="text-xs px-2 py-1 border border-red-200 text-red-500 hover:bg-red-600 hover:text-white transition-colors">Usuń</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                          <div>
                            <div className="text-xs text-zinc-400 mb-0.5">Suma ubezpieczenia</div>
                            <div className="font-mono font-semibold text-zinc-900">{p.sumaUbezpieczenia || '—'}</div>
                          </div>
                          <div>
                            <div className="text-xs text-zinc-400 mb-0.5">Składka</div>
                            <div className="font-mono font-semibold text-zinc-900">
                              {p.skladka ? `${(p.skladka + (p.ochronaPrawna ? 92 : 0)).toLocaleString('pl-PL')} zł` : '—'}
                              <span className="text-xs text-zinc-400 font-normal ml-1">{p.skladkaOkres === 'jednorazowa' ? '(jednorazowa)' : `/${p.skladkaOkres === 'miesięczna' ? 'mies.' : p.skladkaOkres === 'kwartalna' ? 'kw.' : 'rok'}`}</span>
                              {p.ochronaPrawna && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 ml-1">+ochrona 92zł</span>}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-zinc-400 mb-0.5">Okres</div>
                            <div className="text-zinc-700">{fmtDate(p.dataOd)} — {fmtDate(p.dataDo)}</div>
                          </div>
                        </div>
                        <div className={`text-xs px-3 py-2 ${expired ? 'bg-red-100 text-red-700' : expiring ? 'bg-amber-100 text-amber-700' : 'bg-zinc-50 text-zinc-500'}`}>
                          {expired ? `⚠️ Polisa wygasła ${fmtDate(p.dataDo)} (${Math.abs(days!)} dni temu)`
                           : expiring ? `🔔 Wygasa za ${days} dni — przypomnienie: ${fmtDate(p.przypomnienie)}`
                           : p.przypomnienie ? `📅 Przypomnienie: ${fmtDate(p.przypomnienie)}` : '—'}
                        </div>
                        {p.notes && <div className="mt-2 text-xs text-zinc-500 italic">{p.notes}</div>}
                        {p.status === 'aktywna' && expired && (
                          <button onClick={() => updatePolicy(p.id, { status: 'wygasła' })} className="mt-2 text-xs text-zinc-400 hover:text-zinc-700 underline">Oznacz jako wygasłą</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add / Edit form */}
              {showPolicyForm ? (
                <div className="border border-zinc-200 p-5 bg-zinc-50">
                  <div className="text-xs font-bold text-zinc-900 uppercase tracking-widest mb-4">
                    {editingPolicyId ? '✏️ Edytuj polisę' : '🛡️ Nowa polisa'} — {company.company}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="col-span-2">
                      <Lbl>Nr polisy *</Lbl>
                      <Input value={policyForm.nrPolisy} onChange={e => setPolicyForm(p => ({...p, nrPolisy: e.target.value}))}
                        placeholder="np. POL/2025/001234" className="h-9 text-sm rounded-none border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-900 font-mono"/>
                    </div>
                    <div className="col-span-2">
                      <Lbl>Rodzaj ubezpieczenia *</Lbl>
                      <select value={policyForm.rodzaj} onChange={e => setPolicyForm(p => ({...p, rodzaj: e.target.value}))}
                        className="w-full h-9 text-sm border border-zinc-200 px-2 bg-white focus:outline-none focus:border-zinc-900">
                        <option value="">— wybierz —</option>
                        {RODZAJE_UBEZPIECZEN.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <Lbl>Suma ubezpieczenia</Lbl>
                      {policyForm.rodzaj === 'Ubezpieczenie OC' ? (
                        <div className="flex gap-2">
                          {['100 000','200 000','300 000'].map(v => (
                            <button key={v} type="button"
                              onClick={() => setPolicyForm(p => ({...p, sumaUbezpieczenia: v}))}
                              className={`flex-1 h-9 text-sm border-2 font-bold transition-colors ${policyForm.sumaUbezpieczenia===v ? 'bg-zinc-900 text-white border-zinc-900' : 'border-zinc-300 text-zinc-700 hover:border-zinc-900'}`}>
                              {v} zł
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex">
                          <Input value={policyForm.sumaUbezpieczenia} onChange={e => setPolicyForm(p => ({...p, sumaUbezpieczenia: e.target.value}))}
                            placeholder="np. 500000" type="number"
                            className="flex-1 h-9 text-sm rounded-none border-zinc-200 border-r-0 focus-visible:ring-0 focus-visible:border-zinc-900"/>
                          <span className="h-9 px-3 flex items-center text-sm font-medium bg-zinc-100 border border-zinc-200 text-zinc-600 select-none">PLN</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <Lbl>Składka</Lbl>
                      <div className="flex gap-1">
                        <Input value={policyForm.skladka} onChange={e => setPolicyForm(p => ({...p, skladka: e.target.value}))}
                          placeholder="kwota zł" type="number"
                          className="flex-1 h-9 text-sm rounded-none border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-900"/>
                        <select value={policyForm.skladkaOkres} onChange={e => setPolicyForm(p => ({...p, skladkaOkres: e.target.value as typeof p.skladkaOkres}))}
                          className="h-9 text-xs border border-zinc-200 px-1 bg-white focus:outline-none min-w-[100px]">
                          <option value="jednorazowa">jednorazowa</option>
                          <option value="miesięczna">/mies.</option>
                          <option value="kwartalna">/kw.</option>
                          <option value="roczna">/rok</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <Lbl>Data rozpoczęcia</Lbl>
                      <Input type="date" value={policyForm.dataOd} onChange={e => setPolicyForm(p => ({...p, dataOd: e.target.value}))}
                        className="h-9 text-sm rounded-none border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-900"/>
                    </div>
                    <div>
                      <Lbl>Data zakończenia</Lbl>
                      <Input type="date" value={policyForm.dataDo} onChange={e => setPolicyForm(p => ({...p, dataDo: e.target.value}))}
                        className="h-9 text-sm rounded-none border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-900"/>
                    </div>
                    <div>
                      <Lbl>Status polisy</Lbl>
                      <select value={policyForm.status} onChange={e => setPolicyForm(p => ({...p, status: e.target.value as typeof p.status}))}
                        className="w-full h-9 text-sm border border-zinc-200 px-2 bg-white focus:outline-none focus:border-zinc-900">
                        <option value="aktywna">Aktywna</option>
                        <option value="wygasła">Wygasła</option>
                        <option value="anulowana">Anulowana</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <Lbl>Notatki</Lbl>
                      <Textarea value={policyForm.notes} onChange={e => setPolicyForm(p => ({...p, notes: e.target.value}))}
                        rows={2} className="text-sm rounded-none border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-900 resize-none"/>
                    </div>
                  </div>
                  {/* Ochrona prawna — tylko dla OC */}
                  {policyForm.rodzaj === 'Ubezpieczenie OC' && (
                    <div className="mb-3">
                      <label className="flex items-center gap-3 p-3 border-2 cursor-pointer transition-colors hover:border-zinc-900 border-zinc-200 bg-zinc-50">
                        <input type="checkbox" checked={policyForm.ochronaPrawna}
                          onChange={e => setPolicyForm(p => ({...p, ochronaPrawna: e.target.checked}))}
                          className="w-5 h-5 accent-emerald-600 flex-shrink-0"/>
                        <div className="flex-1">
                          <div className="text-sm font-bold text-zinc-900">☑ Ochrona prawna — 100 000 zł</div>
                          <div className="text-xs text-zinc-500 mt-0.5">Składka roczna: <strong className="text-zinc-700">92 zł</strong> — doliczana do sumy składki</div>
                        </div>
                        {policyForm.ochronaPrawna && <span className="text-sm font-bold bg-emerald-100 text-emerald-700 px-2 py-1">+ 92 zł</span>}
                      </label>
                    </div>
                  )}
                  {/* Łączna składka preview */}
                  {(Number(policyForm.skladka) > 0 || policyForm.ochronaPrawna) && (
                    <div className="mb-3 px-4 py-3 bg-emerald-50 border-2 border-emerald-300 text-sm text-emerald-900 font-medium">
                      💰 Łączna składka:{' '}
                      <strong className="text-lg">
                        {(Number(policyForm.skladka||0) + (policyForm.ochronaPrawna ? 92 : 0)).toLocaleString('pl-PL')} zł
                      </strong>
                      {policyForm.ochronaPrawna && Number(policyForm.skladka) > 0 && (
                        <span className="text-xs text-emerald-600 ml-2 font-normal">
                          ({Number(policyForm.skladka).toLocaleString('pl-PL')} polisa + 92 ochrona prawna)
                        </span>
                      )}
                    </div>
                  )}
                  {!editingPolicyId && reminderPreview && (
                    <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      📅 Przypomnienie do kalendarza: <strong>{fmtDate(reminderPreview)}</strong> (45 dni przed końcem)
                    </div>
                  )}
                  <div className="flex gap-2 justify-end">
                    <button onClick={cancelForm} className="px-4 py-2 text-sm border border-zinc-200 text-zinc-600 hover:border-zinc-900">Anuluj</button>
                    <button onClick={handleSavePolicy} disabled={!policyForm.nrPolisy || !policyForm.rodzaj || saving}
                      className="px-4 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 font-medium">
                      {saving ? 'Zapisuję...' : editingPolicyId ? '✓ Zapisz zmiany' : '✓ Dodaj polisę'}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setPolicyForm(emptyForm()); setShowPolicyForm(true); }}
                  className="w-full py-3 border-2 border-dashed border-zinc-200 text-zinc-500 hover:border-zinc-900 hover:text-zinc-900 transition-colors text-sm font-medium">
                  + Dodaj polisę
                </button>
              )}
              {company.policies.length === 0 && !showPolicyForm && (
                <div className="text-center text-zinc-400 text-sm py-6">Brak polis</div>
              )}
            </div>
          )}

          {/* ── HISTORIA ── */}
          {tab === 'historia' && (
            <div className="p-6">
              <div className="border border-zinc-200 p-4 mb-5 bg-zinc-50">
                <div className="flex gap-1 mb-3">
                  {(['notatka','telefon','email','spotkanie'] as const).map(t => (
                    <button key={t} onClick={() => setHistType(t)}
                      className={`flex-1 py-1.5 text-xs border transition-colors ${histType===t ? 'bg-zinc-900 text-white border-zinc-900' : 'border-zinc-200 text-zinc-600 hover:border-zinc-900'}`}>
                      {HIST_ICONS[t]} {HIST_LABELS[t]}
                    </button>
                  ))}
                </div>
                <Textarea value={histNote} onChange={e => setHistNote(e.target.value)} rows={2}
                  placeholder="Treść wpisu..." className="text-sm rounded-none border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-900 resize-none mb-2"/>
                <button onClick={handleAddHistory} disabled={!histNote.trim()}
                  className="w-full py-2 bg-zinc-900 text-white text-sm hover:bg-zinc-700 disabled:opacity-40">Zapisz wpis</button>
              </div>
              {company.history.length === 0
                ? <div className="text-center text-zinc-400 text-sm py-6">Brak historii</div>
                : <div>{company.history.map((e,i) => (
                    <div key={e.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 bg-zinc-900 text-white flex items-center justify-center text-sm flex-shrink-0">{HIST_ICONS[e.type]}</div>
                        {i < company.history.length-1 && <div className="w-px flex-1 bg-zinc-200 my-1"/>}
                      </div>
                      <div className="pb-4 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-zinc-700">{HIST_LABELS[e.type]}</span>
                          <span className="text-xs text-zinc-400">{fmtDT(e.date)}</span>
                          {e.author && <span className="text-xs text-zinc-400">· {e.author}</span>}
                        </div>
                        <p className="text-sm text-zinc-700 bg-white border border-zinc-100 p-3 whitespace-pre-wrap">{e.note}</p>
                      </div>
                    </div>
                  ))}</div>
              }
            </div>
          )}

          {/* ── PRZYPOMNIENIA ── */}
          {tab === 'przypomnienia' && (
            <div className="p-6">
              <div className="border border-zinc-200 p-4 mb-5 bg-zinc-50">
                <Input value={reminderText} onChange={e => setReminderText(e.target.value)} placeholder="Treść przypomnienia..."
                  className="mb-2 text-sm rounded-none border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-900"/>
                <Input type="datetime-local" value={reminderDate} onChange={e => setReminderDate(e.target.value)}
                  className="mb-2 text-sm rounded-none border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-900"/>
                <button onClick={handleAddReminder} disabled={!reminderText.trim() || !reminderDate}
                  className="w-full py-2 bg-zinc-900 text-white text-sm hover:bg-zinc-700 disabled:opacity-40">Dodaj przypomnienie</button>
              </div>
              {company.reminders.length === 0
                ? <div className="text-center text-zinc-400 text-sm py-6">Brak przypomnień</div>
                : <div className="space-y-2">
                    {[...company.reminders].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(r => {
                      const isPast = new Date(r.date) < new Date() && !r.done;
                      const isPolicy = r.text.startsWith('🛡️');
                      return (
                        <div key={r.id} className={`flex items-start gap-3 p-3 border ${r.done ? 'border-zinc-100 bg-zinc-50 opacity-60' : isPast ? 'border-red-200 bg-red-50' : isPolicy ? 'border-emerald-200 bg-emerald-50' : 'border-zinc-200 bg-white'}`}>
                          <input type="checkbox" checked={r.done} onChange={() => toggleReminder(company.id, r.id)} className="mt-0.5 accent-zinc-900"/>
                          <div className="flex-1">
                            <div className={`text-sm ${r.done ? 'line-through text-zinc-400' : 'text-zinc-800'}`}>{r.text}</div>
                            <div className={`text-xs mt-0.5 ${isPast && !r.done ? 'text-red-500 font-medium' : 'text-zinc-400'}`}>
                              {isPast && !r.done ? '⚠ Przeterminowane — ' : ''}{fmtDate(r.date)}
                            </div>
                          </div>
                          <button onClick={() => deleteReminder(company.id, r.id)} className="text-zinc-300 hover:text-red-500 text-sm">✕</button>
                        </div>
                      );
                    })}
                  </div>
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-medium text-zinc-400 uppercase tracking-widest mb-1.5">{title}</div>
      <div className="border border-zinc-100 divide-y divide-zinc-100">{children}</div>
    </div>
  );
}
function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start px-3 py-2 gap-2">
      <span className="text-xs text-zinc-400 w-28 flex-shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm text-zinc-800 flex-1 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
function Lbl({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-zinc-500 mb-1">{children}</div>;
}
