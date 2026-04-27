import { useState } from 'react';
import { useCRMStore } from '../store/useCRMStore';
import type { Company, ContactHistory, Reminder } from '../data/companies';
import { RODZAJE_UBEZPIECZEN } from '../data/companies';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

// re-export helper

const STATUS_COLORS: Record<string,string> = {
  lead:'bg-gray-100 text-gray-700', kontakt:'bg-pink-100 text-pink-700', oferta:'bg-amber-100 text-amber-700',
  negocjacje:'bg-purple-100 text-purple-700', zamkniety:'bg-emerald-100 text-emerald-700', stracony:'bg-red-100 text-red-700',
};
const HIST_ICONS: Record<string,string> = { notatka:'📝', telefon:'📞', email:'✉️', spotkanie:'🤝' };
const HIST_LABELS: Record<string,string> = { notatka:'Notatka', telefon:'Telefon', email:'E-mail', spotkanie:'Spotkanie' };

function fmtDate(s: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('pl-PL', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function fmtDateTime(s: string) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('pl-PL', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
}
function calcReminder(dataDo: string): string {
  if (!dataDo) return '';
  const d = new Date(dataDo); d.setDate(d.getDate() - 45);
  return d.toISOString().split('T')[0];
}
function daysLeft(dataDo: string): number {
  const diff = new Date(dataDo).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

interface Props { company: Company; onClose: () => void; }

type Tab = 'info' | 'polisy' | 'historia' | 'przypomnienia';

export function CompanyDrawer({ company, onClose }: Props) {
  const { stages, addHistory, addReminder, toggleReminder, deleteReminder, updateCompanyStatus,
          addPolicy, updatePolicy, deletePolicy, currentUser } = useCRMStore();
  const [tab, setTab] = useState<Tab>('info');

  // History state
  const [histType, setHistType] = useState<ContactHistory['type']>('notatka');
  const [histNote, setHistNote] = useState('');

  // Reminder state
  const [reminderText, setReminderText] = useState('');
  const [reminderDate, setReminderDate] = useState('');

  // Policy state
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [policyForm, setPolicyForm] = useState<{
    rodzaj: string; sumaUbezpieczenia: string; skladka: string;
    skladkaOkres: 'miesięczna'|'roczna'; dataOd: string; dataDo: string; notes: string;
  }>({ rodzaj: '', sumaUbezpieczenia: '', skladka: '', skladkaOkres: 'miesięczna', dataOd: '', dataDo: '', notes: '' });
  const [savingPolicy, setSavingPolicy] = useState(false);

  const activePolicies = company.policies.filter(p => p.status === 'aktywna');
  const activeReminders = company.reminders.filter(r => !r.done).length;

  const handleAddHistory = () => {
    if (!histNote.trim()) return;
    const entry: ContactHistory = { id: crypto.randomUUID(), type: histType, date: new Date().toISOString(), note: histNote.trim(), author: currentUser?.name ?? '' };
    addHistory(company.id, entry);
    setHistNote('');
  };

  const handleAddReminder = () => {
    if (!reminderText.trim() || !reminderDate) return;
    const r: Reminder = { id: crypto.randomUUID(), date: reminderDate, text: reminderText.trim(), done: false };
    addReminder(company.id, r);
    setReminderText(''); setReminderDate('');
  };

  const handleSavePolicy = async () => {
    if (!policyForm.rodzaj) return;
    setSavingPolicy(true);
    await addPolicy(company.id, {
      rodzaj: policyForm.rodzaj,
      sumaUbezpieczenia: policyForm.sumaUbezpieczenia,
      skladka: policyForm.skladka ? Number(policyForm.skladka) : null,
      skladkaOkres: policyForm.skladkaOkres,
      dataOd: policyForm.dataOd,
      dataDo: policyForm.dataDo,
      przypomnienie: policyForm.dataDo ? calcReminder(policyForm.dataDo) : '',
      status: 'aktywna',
      notes: policyForm.notes,
    });
    setPolicyForm({ rodzaj:'', sumaUbezpieczenia:'', skladka:'', skladkaOkres:'miesięczna', dataOd:'', dataDo:'', notes:'' });
    setShowPolicyForm(false);
    setSavingPolicy(false);
  };

  const reminderPreview = policyForm.dataDo ? calcReminder(policyForm.dataDo) : '';

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      {/* WIDER drawer — 720px */}
      <div className="w-[720px] bg-white h-full flex flex-col shadow-2xl border-l border-zinc-200">

        {/* Header */}
        <div className="bg-zinc-900 text-white px-6 py-4 flex-shrink-0">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 pr-4">
              <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Karta klienta</div>
              <h2 className="font-bold text-lg leading-tight">{company.company}</h2>
              {company.contact && <div className="text-zinc-400 text-sm mt-0.5">{company.contact}</div>}
            </div>
            <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl mt-1">✕</button>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={company.status} onValueChange={v => updateCompanyStatus(company.id, v as Company['status'])}>
              <SelectTrigger className={`h-7 w-32 text-xs rounded-none border-0 font-semibold ${STATUS_COLORS[company.status]} focus:ring-0`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none">
                {stages.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {activePolicies.length > 0 && (
              <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 font-medium">
                🛡️ {activePolicies.length} aktywna polisa
              </span>
            )}
            {company.nip && <span className="text-xs text-zinc-400 font-mono">NIP: {company.nip}</span>}
            {company.ubezpieczenie && <span className="text-xs text-zinc-500">{company.ubezpieczenie}</span>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-200 bg-zinc-50 flex-shrink-0">
          {(['info','polisy','historia','przypomnienia'] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-3 text-xs font-medium uppercase tracking-wider transition-colors ${tab===t ? 'bg-white text-zinc-900 border-b-2 border-zinc-900' : 'text-zinc-400 hover:text-zinc-700'}`}>
              {t === 'polisy' ? `🛡️ Polisy${company.policies.length ? ` (${company.policies.length})` : ''}`
               : t === 'przypomnienia' ? `Przypomnienia${activeReminders ? ` (${activeReminders})` : ''}`
               : t === 'historia' ? `Historia${company.history.length ? ` (${company.history.length})` : ''}`
               : 'Informacje'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── INFO ── */}
          {tab === 'info' && (
            <div className="p-6 grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <Section title="Dane firmy">
                  <Row label="Branża"    value={company.industry || '—'} />
                  <Row label="Miasto"    value={company.city || '—'} />
                  <Row label="NIP"       value={company.nip || '—'} mono />
                  <Row label="Pracownicy" value={company.employees ? Number(company.employees).toLocaleString('pl-PL') : '—'} mono />
                  <Row label="WWW"       value={company.url ? <a href={company.url} target="_blank" rel="noopener" className="text-blue-600 hover:underline text-sm">{company.url.replace('http://','')}</a> : '—'} />
                </Section>
                <Section title="Ubezpieczenia (lead)">
                  <Row label="Rodzaj"    value={company.ubezpieczenie || '—'} />
                  <Row label="Przychód"  value={company.przychod || '—'} />
                </Section>
              </div>
              <div className="space-y-4">
                <Section title="Kontakt">
                  <Row label="Osoba"     value={company.contact || '—'} />
                  {company.title && <Row label="Stanowisko" value={company.title} />}
                  <Row label="Telefon"   value={company.phone ? <a href={`tel:${company.phone}`} className="text-blue-600 hover:underline">{company.phone}</a> : '—'} />
                  <Row label="E-mail"    value={company.email ? <a href={`mailto:${company.email}`} className="text-blue-600 hover:underline text-xs">{company.email}</a> : '—'} />
                </Section>
                {company.notes && (
                  <Section title="Notatki">
                    <div className="px-3 py-2 text-sm text-zinc-600">{company.notes}</div>
                  </Section>
                )}
              </div>
            </div>
          )}

          {/* ── POLISY ── */}
          {tab === 'polisy' && (
            <div className="p-6">
              {/* Existing policies */}
              {company.policies.length > 0 && (
                <div className="space-y-3 mb-6">
                  {company.policies.map(p => {
                    const days = p.dataDo ? daysLeft(p.dataDo) : null;
                    const expiringSoon = days !== null && days <= 45 && days > 0;
                    const expired = days !== null && days <= 0;
                    return (
                      <div key={p.id} className={`border p-4 ${expired ? 'border-red-200 bg-red-50' : expiringSoon ? 'border-amber-200 bg-amber-50' : 'border-zinc-200 bg-white'}`}>
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="font-bold text-zinc-900">{p.rodzaj}</div>
                            <div className="text-xs text-zinc-400 mt-0.5">Dodano: {fmtDateTime(p.createdAt)}{p.createdBy ? ` · ${p.createdBy}` : ''}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 font-medium ${p.status === 'aktywna' ? 'bg-emerald-100 text-emerald-700' : p.status === 'wygasła' ? 'bg-red-100 text-red-700' : 'bg-zinc-100 text-zinc-600'}`}>
                              {p.status}
                            </span>
                            <button onClick={() => deletePolicy(p.id, company.id)} className="text-zinc-300 hover:text-red-500 text-sm">✕</button>
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
                              {p.skladka ? `${p.skladka.toLocaleString('pl-PL')} zł` : '—'}
                              {p.skladka && <span className="text-xs text-zinc-400 font-normal ml-1">/{p.skladkaOkres === 'miesięczna' ? 'mies.' : 'rok'}</span>}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-zinc-400 mb-0.5">Okres</div>
                            <div className="text-zinc-700">{fmtDate(p.dataOd)} — {fmtDate(p.dataDo)}</div>
                          </div>
                        </div>
                        {/* Reminder / expiry info */}
                        <div className={`flex items-center gap-2 text-xs px-3 py-2 ${expired ? 'bg-red-100 text-red-700' : expiringSoon ? 'bg-amber-100 text-amber-700' : 'bg-zinc-50 text-zinc-500'}`}>
                          {expired
                            ? `⚠️ Polisa wygasła ${fmtDate(p.dataDo)} (${Math.abs(days!)} dni temu)`
                            : expiringSoon
                            ? `🔔 Wygasa za ${days} dni (${fmtDate(p.dataDo)}) — przypomnienie: ${fmtDate(p.przypomnienie)}`
                            : p.przypomnienie
                            ? `📅 Przypomnienie o odnowieniu: ${fmtDate(p.przypomnienie)} (45 dni przed końcem)`
                            : '—'}
                        </div>
                        {p.notes && <div className="mt-2 text-xs text-zinc-500 italic">{p.notes}</div>}
                        {/* Mark as expired */}
                        {p.status === 'aktywna' && (
                          <button onClick={() => updatePolicy(p.id, { status: 'wygasła' })}
                            className="mt-2 text-xs text-zinc-400 hover:text-zinc-700 underline">
                            Oznacz jako wygasłą
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add policy form */}
              {!showPolicyForm ? (
                <button onClick={() => setShowPolicyForm(true)}
                  className="w-full py-3 border-2 border-dashed border-zinc-200 text-zinc-500 hover:border-zinc-900 hover:text-zinc-900 transition-colors text-sm font-medium">
                  + Dodaj polisę
                </button>
              ) : (
                <div className="border border-zinc-200 p-5 bg-zinc-50">
                  <div className="text-xs font-bold text-zinc-900 uppercase tracking-widest mb-4">🛡️ Nowa polisa — {company.company}</div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="col-span-2">
                      <Label>Rodzaj ubezpieczenia *</Label>
                      <select value={policyForm.rodzaj} onChange={e => setPolicyForm(p => ({...p, rodzaj: e.target.value}))}
                        className="w-full h-9 text-sm border border-zinc-200 px-2 bg-white focus:outline-none focus:border-zinc-900">
                        <option value="">— wybierz —</option>
                        {RODZAJE_UBEZPIECZEN.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <Label>Suma ubezpieczenia</Label>
                      <Input value={policyForm.sumaUbezpieczenia} onChange={e => setPolicyForm(p => ({...p, sumaUbezpieczenia: e.target.value}))}
                        placeholder="np. 500 000 zł" className="h-9 text-sm rounded-none border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-900"/>
                    </div>
                    <div>
                      <Label>Składka</Label>
                      <div className="flex gap-1">
                        <Input value={policyForm.skladka} onChange={e => setPolicyForm(p => ({...p, skladka: e.target.value}))}
                          placeholder="kwota w zł" type="number" className="flex-1 h-9 text-sm rounded-none border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-900"/>
                        <select value={policyForm.skladkaOkres} onChange={e => setPolicyForm(p => ({...p, skladkaOkres: e.target.value as 'miesięczna'|'roczna'}))}
                          className="h-9 text-xs border border-zinc-200 px-1 bg-white focus:outline-none">
                          <option value="miesięczna">/mies.</option>
                          <option value="roczna">/rok</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <Label>Data rozpoczęcia</Label>
                      <Input type="date" value={policyForm.dataOd} onChange={e => setPolicyForm(p => ({...p, dataOd: e.target.value}))}
                        className="h-9 text-sm rounded-none border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-900"/>
                    </div>
                    <div>
                      <Label>Data zakończenia</Label>
                      <Input type="date" value={policyForm.dataDo} onChange={e => setPolicyForm(p => ({...p, dataDo: e.target.value}))}
                        className="h-9 text-sm rounded-none border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-900"/>
                    </div>
                    <div className="col-span-2">
                      <Label>Notatki do polisy</Label>
                      <Textarea value={policyForm.notes} onChange={e => setPolicyForm(p => ({...p, notes: e.target.value}))}
                        rows={2} placeholder="Dodatkowe informacje..." className="text-sm rounded-none border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-900 resize-none"/>
                    </div>
                  </div>

                  {/* Auto-reminder preview */}
                  {reminderPreview && (
                    <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 text-xs text-amber-800">
                      📅 Automatyczne przypomnienie o odnowieniu zostanie dodane do Kalendarza:
                      <strong className="ml-1">{fmtDate(reminderPreview)}</strong>
                      <span className="text-amber-600 ml-1">(45 dni przed końcem polisy)</span>
                    </div>
                  )}

                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowPolicyForm(false)} className="px-4 py-2 text-sm border border-zinc-200 text-zinc-600 hover:border-zinc-900">Anuluj</button>
                    <button onClick={handleSavePolicy} disabled={!policyForm.rodzaj || savingPolicy}
                      className="px-4 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 font-medium">
                      {savingPolicy ? 'Zapisuję...' : '✓ Zapisz polisę'}
                    </button>
                  </div>
                </div>
              )}

              {company.policies.length === 0 && !showPolicyForm && (
                <div className="text-center text-zinc-400 text-sm py-8">Brak polis — klient jeszcze nie kupił ubezpieczenia</div>
              )}
            </div>
          )}

          {/* ── HISTORIA ── */}
          {tab === 'historia' && (
            <div className="p-6">
              <div className="border border-zinc-200 p-4 mb-6 bg-zinc-50">
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-3">Dodaj wpis</div>
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
                  className="w-full py-2 bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-700 disabled:opacity-40">
                  Zapisz wpis
                </button>
              </div>
              {company.history.length === 0
                ? <div className="text-center text-zinc-400 text-sm py-8">Brak historii kontaktów</div>
                : <div className="space-y-0">
                    {company.history.map((e, i) => (
                      <div key={e.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="w-8 h-8 bg-zinc-900 text-white flex items-center justify-center text-sm flex-shrink-0">{HIST_ICONS[e.type]}</div>
                          {i < company.history.length-1 && <div className="w-px flex-1 bg-zinc-200 my-1"/>}
                        </div>
                        <div className="pb-4 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-zinc-700">{HIST_LABELS[e.type]}</span>
                            <span className="text-xs text-zinc-400">{fmtDateTime(e.date)}</span>
                            {e.author && <span className="text-xs text-zinc-400">· {e.author}</span>}
                          </div>
                          <p className="text-sm text-zinc-700 bg-white border border-zinc-100 p-3">{e.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
              }
            </div>
          )}

          {/* ── PRZYPOMNIENIA ── */}
          {tab === 'przypomnienia' && (
            <div className="p-6">
              <div className="border border-zinc-200 p-4 mb-6 bg-zinc-50">
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-3">Nowe przypomnienie</div>
                <Input value={reminderText} onChange={e => setReminderText(e.target.value)} placeholder="Treść..."
                  className="mb-2 text-sm rounded-none border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-900"/>
                <Input type="datetime-local" value={reminderDate} onChange={e => setReminderDate(e.target.value)}
                  className="mb-2 text-sm rounded-none border-zinc-200 focus-visible:ring-0 focus-visible:border-zinc-900"/>
                <button onClick={handleAddReminder} disabled={!reminderText.trim() || !reminderDate}
                  className="w-full py-2 bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-700 disabled:opacity-40">
                  Dodaj przypomnienie
                </button>
              </div>
              {company.reminders.length === 0
                ? <div className="text-center text-zinc-400 text-sm py-8">Brak przypomnień</div>
                : <div className="space-y-2">
                    {[...company.reminders].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(r => {
                      const isPast = new Date(r.date) < new Date() && !r.done;
                      const isPolicy = r.text.startsWith('🛡️');
                      return (
                        <div key={r.id} className={`flex items-start gap-3 p-3 border ${r.done ? 'border-zinc-100 bg-zinc-50 opacity-60' : isPast ? 'border-red-200 bg-red-50' : isPolicy ? 'border-emerald-200 bg-emerald-50' : 'border-zinc-200 bg-white'}`}>
                          <input type="checkbox" checked={r.done} onChange={() => toggleReminder(company.id, r.id)} className="mt-0.5 accent-zinc-900"/>
                          <div className="flex-1 min-w-0">
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
    <div className="flex items-center px-3 py-2">
      <span className="text-xs text-zinc-400 w-28 flex-shrink-0">{label}</span>
      <span className={`text-sm text-zinc-800 ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-zinc-500 mb-1">{children}</div>;
}
