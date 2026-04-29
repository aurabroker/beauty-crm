import { useState } from 'react';
import { PrivacyPolicy } from './PrivacyPolicy';
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

export function LeadForm() {
  const [form, setForm] = useState({
    imie:'', nazwisko:'', firma:'', nip:'', email:'', telefon:'',
    ubezpieczenie:'', przychod:'', rodo: false,
  });
  const [loading, setLoading] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.rodo) { setError('Wymagana zgoda RODO'); return; }
    setLoading(true); setError('');

    // Zapisz do crm_lead_intake (formularz publiczny)
    const { error: err1 } = await supabase.from('crm_lead_intake').insert({
      imie: form.imie, nazwisko: form.nazwisko, firma: form.firma,
      nip: form.nip, email: form.email, telefon: form.telefon,
      ubezpieczenie: form.ubezpieczenie, przychod: form.przychod, rodo: form.rodo,
    });
    if (err1) { setError('Błąd zapisu. Spróbuj ponownie.'); setLoading(false); return; }

    // Wyślij do Edge Function → zapisze do CRM z TAG "własny" + wyśle do GR
    if (form.firma || form.email) {
      await fetch('https://dhuvykwecsxgchzxufxw.supabase.co/functions/v1/lead-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'beauty2026secret' },
        body: JSON.stringify({
          company:       form.firma || `${form.imie} ${form.nazwisko}`.trim(),
          contact:       `${form.imie} ${form.nazwisko}`.trim(),
          email:         form.email,
          phone:         form.telefon,
          nip:           form.nip,
          ubezpieczenie: form.ubezpieczenie,
          przychod:      form.przychod,
          tag:           'własny',
          lead_source:   'formularz',
          send_to_gr:    true,
        }),
      }).catch(() => null);
    }
    setSent(true);
  };

  if (sent) return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-zinc-900 mb-2">Dziękujemy!</h2>
        <p className="text-zinc-500 text-sm">Nasz doradca skontaktuje się z Tobą w ciągu 24 godzin.</p>
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
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-zinc-200 shadow-sm p-6 space-y-4">
          <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest pb-1 border-b border-zinc-100">Dane kontaktowe</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Imię *"><input value={form.imie} onChange={f('imie')} required placeholder="Anna" className="field-input"/></Field>
            <Field label="Nazwisko *"><input value={form.nazwisko} onChange={f('nazwisko')} required placeholder="Kowalska" className="field-input"/></Field>
          </div>
          <Field label="Telefon *"><input value={form.telefon} onChange={f('telefon')} required type="tel" placeholder="+48 500 000 000" className="field-input"/></Field>
          <Field label="E-mail *"><input value={form.email} onChange={f('email')} required type="email" placeholder="anna@salon.pl" className="field-input"/></Field>

          <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest pb-1 border-b border-zinc-100 pt-2">Dane firmy</div>
          <Field label="Nazwa salonu / firmy"><input value={form.firma} onChange={f('firma')} placeholder="Salon Urody Anna" className="field-input"/></Field>
          <Field label="NIP firmy"><input value={form.nip} onChange={f('nip')} placeholder="1234567890" maxLength={10} className="field-input font-mono"/></Field>

          <div className="text-xs font-bold text-zinc-400 uppercase tracking-widest pb-1 border-b border-zinc-100 pt-2">Ubezpieczenie</div>
          <Field label="Czego szukasz? *">
            <select value={form.ubezpieczenie} onChange={f('ubezpieczenie')} required className="field-input bg-white">
              <option value="">— wybierz rodzaj —</option>
              {UBEZPIECZENIA.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
          <Field label="Roczny przychód">
            <select value={form.przychod} onChange={f('przychod')} className="field-input bg-white">
              <option value="">— wybierz zakres —</option>
              {PRZYCHODYS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>

          <div className="pt-2 border-t border-zinc-100 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.rodo} onChange={e => setForm(p => ({...p, rodo: e.target.checked}))}
                className="mt-1 accent-pink-500 w-4 h-4 flex-shrink-0"/>
              <span className="text-xs text-zinc-500 leading-relaxed">
                <strong className="text-zinc-700">Zgoda na przetwarzanie danych *</strong> — Wyrażam zgodę na przetwarzanie moich danych osobowych przez Aura Consulting w celu przedstawienia oferty ubezpieczeniowej i kontaktu handlowego, zgodnie z{' '}
                <button type="button" onClick={() => setShowPrivacy(true)} className="text-pink-600 hover:underline font-medium">
                  Polityką Prywatności
                </button>.
                Podanie danych jest dobrowolne. Mam prawo wycofać zgodę w dowolnym momencie.
              </span>
            </label>
          </div>
          {error && <div className="text-red-600 text-sm bg-red-50 border border-red-200 px-3 py-2">{error}</div>}
          <button type="submit" disabled={loading || !form.rodo}
            className="w-full h-11 bg-pink-600 text-white font-semibold hover:bg-pink-500 disabled:opacity-50 transition-colors text-sm">
            {loading ? 'Wysyłanie...' : '📨 Wyślij zapytanie'}
          </button>
        </form>
        <div className="mt-4 text-center text-xs text-zinc-400">🔒 Dane chronione zgodnie z RODO</div>
      {showPrivacy && <PrivacyPolicy onClose={() => setShowPrivacy(false)}/>}
      </div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs font-medium text-zinc-600 mb-1 block">{label}</label>{children}</div>;
}
