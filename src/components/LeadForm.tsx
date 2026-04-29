import { useState } from 'react';
import { supabase } from '../lib/supabase';

const UBEZPIECZENIA = [
  'Ubezpieczenie OC',
  'Ubezpieczenie utraty dochodu',
  'Ochrona karno-skarbowa',
  'Pakiety zdrowotne',
  'Nie wiem – poproszę konsultację',
];
const PRZYCHODYS = [
  'do 250 000 zł',
  '250 000 – 500 000 zł',
  '500 000 – 1 000 000 zł',
  'powyżej 1 000 000 zł',
];

// GetResponse config
const GR_API_KEY    = 'w29wnilr1s84mnqu266fq5bflahoq499';
const GR_LIST_TOKEN = 'C1gpQ';
const GR_ID_NIP      = 'nIA4c8';
const GR_ID_FIRMA    = 'nuEgTC';
const GR_ID_TELEFON  = 'nuEgBg';
const GR_ID_KATEGORIA = 'nIA4FW';

async function sendToGetResponse(form: Record<string, string>) {
  const telefon = form.telefon.replace(/\D/g, '');
  const tel = telefon.length === 9 ? '+48' + telefon : '+' + telefon;

  const customFields = [];
  if (form.nip)        customFields.push({ customFieldId: GR_ID_NIP,       value: [form.nip] });
  if (form.firma)      customFields.push({ customFieldId: GR_ID_FIRMA,     value: [form.firma] });
  if (tel)             customFields.push({ customFieldId: GR_ID_TELEFON,   value: [tel] });
  if (form.ubezpieczenie) customFields.push({ customFieldId: GR_ID_KATEGORIA, value: [form.ubezpieczenie] });

  try {
    await fetch('https://api.getresponse.com/v3/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Token': `api-key ${GR_API_KEY}`,
      },
      body: JSON.stringify({
        name: `${form.imie} ${form.nazwisko}`.trim(),
        email: form.email,
        dayOfCycle: '0',
        campaign: { campaignId: GR_LIST_TOKEN },
        customFieldValues: customFields,
      }),
    });
  } catch {
    // Nie blokujemy zapisu do Supabase jeśli GR zawiedzie
  }
}

export function LeadForm() {
  const [form, setForm] = useState({
    imie:'', nazwisko:'', firma:'', nip:'', email:'', telefon:'',
    ubezpieczenie:'' as string, przychod:'', rodo: false,
    klientWlasny: false,
  });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.rodo) { setError('Wymagana zgoda RODO'); return; }
    setLoading(true); setError('');

    const leadSource = form.klientWlasny ? 'klient własny' : 'formularz';

    // 1. Zapisz do crm_lead_intake
    const { error: supaErr } = await supabase.from('crm_lead_intake').insert({
      imie: form.imie, nazwisko: form.nazwisko, firma: form.firma,
      nip: form.nip, email: form.email, telefon: form.telefon,
      ubezpieczenie: form.ubezpieczenie, przychod: form.przychod,
      rodo: form.rodo,
    });

    if (supaErr) { setError('Błąd zapisu. Spróbuj ponownie.'); setLoading(false); return; }

    // 2. Zapisz do crm_companies jako lead
    if (form.firma || form.email) {
      const { data: maxRow } = await supabase.from('crm_companies').select('id').order('id', { ascending: false }).limit(1).maybeSingle();
      const newId = ((maxRow?.id as number) ?? 0) + 1;
      await supabase.from('crm_companies').insert({
        id: newId,
        company: form.firma || `${form.imie} ${form.nazwisko}`.trim(),
        contact: `${form.imie} ${form.nazwisko}`.trim(),
        email: form.email,
        phone: form.telefon,
        nip: form.nip,
        ubezpieczenie: form.ubezpieczenie,
        zainteresowania: form.ubezpieczenie,
        przychod: form.przychod,
        industry: 'Beauty & Wellness',
        status: 'lead',
        tag: form.klientWlasny ? 'klient własny' : '',
        lead_source: leadSource,
        assigned_to: '',
      }).select().maybeSingle();
    }

    // 3. Wyślij do GetResponse (tylko jeśli NIE jest klientem własnym)
    if (!form.klientWlasny && form.email) {
      await sendToGetResponse(form as unknown as Record<string,string>);
    }

    setSent(true);
  };

  if (sent) return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-zinc-900 mb-2">Dziękujemy!</h2>
        <p className="text-zinc-600 mb-1">Twoje zgłoszenie zostało przyjęte.</p>
        <p className="text-zinc-500 text-sm">Nasz doradca skontaktuje się z Tobą w ciągu 24 godzin.</p>
        <div className="mt-6 text-xs text-zinc-400">AuraBeauty CRM · ubezpieczenia dla branży beauty</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 bg-pink-500 flex items-center justify-center">
              <span className="text-white font-black text-lg">B</span>
            </div>
            <div className="text-left">
              <div className="font-black text-xl text-zinc-900">AuraBeauty</div>
              <div className="text-zinc-400 text-xs uppercase tracking-widest">ubezpieczenia dla beauty</div>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 mt-4">Poproś o bezpłatną ofertę</h1>
          <p className="text-zinc-500 text-sm mt-2">Wypełnij formularz — oddzwonimy i przygotujemy ofertę dopasowaną do Twojego salonu.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-zinc-200 shadow-sm p-6 space-y-4">

          {/* Klient własny — widoczne tylko dla agentów (ukryj jeśli chcesz) */}
          <div className="bg-amber-50 border border-amber-200 p-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={form.klientWlasny}
                onChange={e => setForm(p => ({...p, klientWlasny: e.target.checked}))}
                className="w-4 h-4 accent-amber-500 flex-shrink-0"/>
              <div>
                <div className="text-sm font-semibold text-amber-800">Klient własny</div>
                <div className="text-xs text-amber-600">Zaznacz jeśli to Twój bezpośredni klient — NIE będzie dodany do GetResponse</div>
              </div>
            </label>
          </div>

          <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest pb-1 border-b border-zinc-100">Dane kontaktowe</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Imię *">
              <input value={form.imie} onChange={f('imie')} required placeholder="Anna" className="field-input"/>
            </Field>
            <Field label="Nazwisko *">
              <input value={form.nazwisko} onChange={f('nazwisko')} required placeholder="Kowalska" className="field-input"/>
            </Field>
          </div>
          <Field label="Telefon *">
            <input value={form.telefon} onChange={f('telefon')} required type="tel" placeholder="+48 500 000 000" className="field-input"/>
          </Field>
          <Field label="Adres e-mail *">
            <input value={form.email} onChange={f('email')} required type="email" placeholder="anna@salon.pl" className="field-input"/>
          </Field>

          <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest pb-1 border-b border-zinc-100 pt-2">Dane firmy</div>
          <Field label="Nazwa salonu / firmy">
            <input value={form.firma} onChange={f('firma')} placeholder="Salon Urody Anna" className="field-input"/>
          </Field>
          <Field label="NIP firmy">
            <input value={form.nip} onChange={f('nip')} placeholder="1234567890" maxLength={10} className="field-input font-mono"/>
          </Field>

          <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest pb-1 border-b border-zinc-100 pt-2">Ubezpieczenie</div>
          <Field label="Czego szukasz? *">
            <select value={form.ubezpieczenie} onChange={f('ubezpieczenie')} required className="field-input bg-white">
              <option value="">— wybierz rodzaj —</option>
              {UBEZPIECZENIA.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
          <Field label="Roczny przychód firmy">
            <select value={form.przychod} onChange={f('przychod')} className="field-input bg-white">
              <option value="">— wybierz zakres —</option>
              {PRZYCHODYS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>

          <div className="pt-2 border-t border-zinc-100">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.rodo} onChange={e => setForm(p => ({...p, rodo: e.target.checked}))}
                className="mt-0.5 accent-pink-500 w-4 h-4 flex-shrink-0"/>
              <span className="text-xs text-zinc-500 leading-relaxed">
                <strong className="text-zinc-700">Zgoda RODO *</strong> — Wyrażam zgodę na przetwarzanie moich danych osobowych przez AuraBeauty w celu przedstawienia oferty ubezpieczeniowej i kontaktu handlowego, zgodnie z{' '}
                <a href="#" className="text-pink-600 hover:underline">Polityką Prywatności</a>.
              </span>
            </label>
          </div>

          {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2">{error}</div>}

          <button type="submit" disabled={loading || !form.rodo}
            className="w-full h-11 bg-pink-600 text-white font-semibold hover:bg-pink-500 disabled:opacity-50 transition-colors text-sm">
            {loading ? 'Wysyłanie...' : '📨 Wyślij zapytanie'}
          </button>

          {form.klientWlasny && (
            <div className="text-xs text-center text-amber-600">
              ⚠ Klient własny — dane zostaną zapisane tylko w CRM, bez wysyłki do GetResponse
            </div>
          )}
        </form>

        <div className="mt-4 text-center text-xs text-zinc-400">
          🔒 Dane są bezpieczne i chronione zgodnie z RODO
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-zinc-600 mb-1 block">{label}</label>
      {children}
    </div>
  );
}
