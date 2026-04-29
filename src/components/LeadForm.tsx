import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { PrivacyPolicy } from './PrivacyPolicy';

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

const inp = "w-full h-10 border border-zinc-300 px-3 text-sm focus:outline-none focus:border-pink-500 bg-white text-zinc-900";

export function LeadForm() {
  const [form, setForm] = useState({ imie:'', nazwisko:'', firma:'', nip:'', email:'', telefon:'', ubezpieczenie:'', przychod:'', rodo: false });
  const [loading, setLoading]       = useState(false);
  const [sent, setSent]             = useState(false);
  const [error, setError]           = useState('');
  const [showPrivacy, setShowPrivacy] = useState(false);

  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.rodo) { setError('Wymagana zgoda na przetwarzanie danych'); return; }
    setLoading(true); setError('');
    const { error: err } = await supabase.from('crm_lead_intake').insert({
      imie: form.imie, nazwisko: form.nazwisko, firma: form.firma,
      nip: form.nip, email: form.email, telefon: form.telefon,
      ubezpieczenie: form.ubezpieczenie, przychod: form.przychod, rodo: form.rodo,
    });
    if (err) { setError('Błąd zapisu. Spróbuj ponownie.'); setLoading(false); return; }
    // Edge Function → CRM + GR
    fetch('https://dhuvykwecsxgchzxufxw.supabase.co/functions/v1/lead-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': 'beauty2026secret' },
      body: JSON.stringify({ company: form.firma || `${form.imie} ${form.nazwisko}`.trim(), contact: `${form.imie} ${form.nazwisko}`.trim(), email: form.email, phone: form.telefon, nip: form.nip, ubezpieczenie: form.ubezpieczenie, przychod: form.przychod, tag: 'własny', lead_source: 'formularz', send_to_gr: true }),
    }).catch(() => null);
    setSent(true);
  };

  if (sent) return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-zinc-900 mb-2">Dziękujemy!</h2>
        <p className="text-zinc-500 text-sm">Nasz doradca skontaktuje się z Tobą w ciągu 24 godzin.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2">
            <div className="w-9 h-9 bg-pink-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-black">B</span>
            </div>
            <div className="text-left">
              <div className="font-black text-lg text-zinc-900 leading-tight">AuraBeauty</div>
              <div className="text-zinc-400 text-[10px] uppercase tracking-widest">ubezpieczenia dla beauty</div>
            </div>
          </div>
          <p className="text-zinc-500 text-sm mt-3">Wypełnij formularz — przygotujemy ofertę dopasowaną do Twojego salonu.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-zinc-200 shadow-sm rounded-none p-5 space-y-3">

          {/* Imię + Nazwisko w jednym rzędzie */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-zinc-600 mb-1 block">Imię *</label>
              <input value={form.imie} onChange={f('imie')} required placeholder="Anna" className={inp}/>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600 mb-1 block">Nazwisko *</label>
              <input value={form.nazwisko} onChange={f('nazwisko')} required placeholder="Kowalska" className={inp}/>
            </div>
          </div>

          {/* Telefon + Email */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-zinc-600 mb-1 block">Telefon *</label>
              <input value={form.telefon} onChange={f('telefon')} required type="tel" placeholder="+48 500 000 000" className={inp}/>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600 mb-1 block">E-mail *</label>
              <input value={form.email} onChange={f('email')} required type="email" placeholder="anna@salon.pl" className={inp}/>
            </div>
          </div>

          {/* Firma + NIP */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium text-zinc-600 mb-1 block">Nazwa salonu *</label>
              <input value={form.firma} onChange={f('firma')} required placeholder="Salon Urody Anna" className={inp}/>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-600 mb-1 block">NIP</label>
              <input value={form.nip} onChange={f('nip')} placeholder="1234567890" maxLength={10} className={`${inp} font-mono`}/>
            </div>
          </div>

          {/* Ubezpieczenie */}
          <div>
            <label className="text-xs font-medium text-zinc-600 mb-1 block">Czego szukasz? *</label>
            <select value={form.ubezpieczenie} onChange={f('ubezpieczenie')} required className={`${inp} bg-white`}>
              <option value="">— wybierz rodzaj ubezpieczenia —</option>
              {UBEZPIECZENIA.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>

          {/* Przychód */}
          <div>
            <label className="text-xs font-medium text-zinc-600 mb-1 block">Roczny przychód</label>
            <select value={form.przychod} onChange={f('przychod')} className={`${inp} bg-white`}>
              <option value="">— wybierz zakres —</option>
              {PRZYCHODYS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* RODO */}
          <div className="pt-1">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={form.rodo} onChange={e => setForm(p => ({...p, rodo: e.target.checked}))}
                className="mt-1 accent-pink-500 w-4 h-4 flex-shrink-0"/>
              <span className="text-xs text-zinc-500 leading-relaxed">
                Wyrażam zgodę na przetwarzanie moich danych osobowych przez Aura Consulting w celu przedstawienia oferty ubezpieczeniowej, zgodnie z{' '}
                <button type="button" onClick={() => setShowPrivacy(true)} className="text-pink-600 hover:underline font-semibold">
                  Polityką Prywatności
                </button>. <span className="text-zinc-400">(wymagane)</span>
              </span>
            </label>
          </div>

          {error && <div className="text-red-600 text-xs bg-red-50 border border-red-200 px-3 py-2">{error}</div>}

          <button type="submit" disabled={loading || !form.rodo}
            className="w-full h-11 bg-pink-600 text-white font-semibold hover:bg-pink-500 disabled:opacity-50 transition-colors text-sm">
            {loading ? 'Wysyłanie...' : '📨 Wyślij zapytanie o ofertę'}
          </button>
        </form>

        <div className="mt-3 text-center text-[11px] text-zinc-400">🔒 Dane chronione zgodnie z RODO · Aura Consulting</div>
      </div>

      {showPrivacy && <PrivacyPolicy onClose={() => setShowPrivacy(false)}/>}
    </div>
  );
}
