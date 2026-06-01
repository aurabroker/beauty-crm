import { useState, useEffect, useMemo } from 'react';
import { useCRMStore } from '../store/useCRMStore';
import type { Company, MienieWniosek } from '../data/companies';

const PLN = (v: number) => v ? v.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 }) : '—';
const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('pl-PL') : '—';

const KATEGORIE: { key: keyof MienieWniosek; label: string }[] = [
  { key: 'sumaBudynek',          label: 'Budynek / nakłady' },
  { key: 'sumaWyposazenie',      label: 'Wyposażenie stałe' },
  { key: 'sumaMaszyny',          label: 'Maszyny i urządzenia' },
  { key: 'sumaSrodkiObrotowe',   label: 'Środki obrotowe' },
  { key: 'sumaElektronikaIt',    label: 'Elektronika / IT' },
  { key: 'sumaSprzet',           label: 'Sprzęt medyczny' },
  { key: 'sumaGotowkaLokal',     label: 'Gotówka w lokalu' },
  { key: 'sumaGotowkaTransport', label: 'Gotówka w transporcie' },
  { key: 'sumaSzyby',            label: 'Szyby i przedmioty' },
  { key: 'sumaMieniePracownikow',label: 'Mienie pracowników' },
];

function WniosekDrawer({ wniosek, company, onClose }: { wniosek: MienieWniosek; company?: Company; onClose: () => void }) {
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="mb-6">
      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 border-b border-zinc-800 pb-1">{title}</h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">{children}</div>
    </div>
  );
  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-sm text-zinc-100">{value || '—'}</div>
    </div>
  );
  const Bool = ({ v }: { v: boolean }) => (
    <span className={v ? 'text-emerald-400' : 'text-zinc-600'}>{v ? 'TAK' : 'NIE'}</span>
  );

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60" onClick={onClose} />
      <div className="w-[680px] bg-zinc-950 border-l border-zinc-800 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 flex-shrink-0">
          <div>
            <div className="font-bold text-white text-base">{wniosek.nazwaFirmy || company?.company}</div>
            <div className="text-xs text-zinc-500">NIP: {wniosek.nip || company?.nip || '—'} · złożony {fmtDate(wniosek.createdAt)}</div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 text-sm">
          <Section title="Dane ubezpieczającego">
            <Field label="Nazwa firmy" value={wniosek.nazwaFirmy} />
            <Field label="NIP" value={wniosek.nip} />
            <Field label="REGON" value={wniosek.regon} />
            <Field label="KRS" value={wniosek.krs} />
            <Field label="Adres siedziby" value={wniosek.adresSiedziby} />
            <Field label="Forma prawna" value={wniosek.formaPrawna} />
            <Field label="PKD" value={wniosek.numerPkd} />
            <Field label="E-mail" value={wniosek.emailKontaktowy} />
            <Field label="Telefon" value={wniosek.telefon} />
            <Field label="Osoba kontaktowa" value={wniosek.osobaKontaktu} />
            <Field label="Stanowisko" value={wniosek.stanowisko} />
          </Section>

          <Section title="Lokalizacja i budynek">
            <Field label="Adres lokalizacji" value={wniosek.adresLokalizacji} />
            <Field label="Typ lokalu" value={wniosek.typLokalu} />
            <Field label="Piętro" value={wniosek.pietro} />
            <Field label="Powierzchnia" value={wniosek.powierzchnia ? `${wniosek.powierzchnia} m²` : null} />
            <Field label="Rok budowy" value={wniosek.rokBudowy} />
            <Field label="Rok remontu" value={wniosek.rokRemontu} />
            <Field label="Budynek własny" value={<Bool v={wniosek.budynekWlasny} />} />
            <Field label="Materiał ścian" value={wniosek.materialScian} />
            <Field label="Pokrycie dachu" value={wniosek.pokrycieDachu} />
            <Field label="Stan techniczny" value={wniosek.stanTechniczny} />
            <Field label="Ogrzewanie" value={wniosek.ogrzewanie} />
            <Field label="Materiały palne" value={<Bool v={wniosek.materialyPalne} />} />
          </Section>

          <Section title="Profil działalności">
            <Field label="Rodzaj działalności" value={wniosek.rodzajDzialalnosci} />
            <Field label="Liczba pracowników" value={wniosek.liczbaPracownikow} />
            <Field label="Roczny obrót" value={wniosek.rocznyObrot} />
            <div className="col-span-2">
              <div className="text-xs text-zinc-500 mb-1">Wykonywane zabiegi</div>
              <div className="flex flex-wrap gap-1">
                {wniosek.zabiegi?.length ? wniosek.zabiegi.map(z => (
                  <span key={z} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">{z}</span>
                )) : <span className="text-zinc-600 text-xs">brak</span>}
              </div>
            </div>
          </Section>

          <Section title="Zabezpieczenia p.poż.">
            <Field label="Gaśnice (szt.)" value={wniosek.gasniceSzt} />
            <Field label="Hydranty" value={<Bool v={wniosek.hydranty} />} />
            <Field label="Przegląd gaśnic" value={wniosek.dataPrzegladuGasnic} />
            <Field label="SAP" value={<Bool v={wniosek.sap} />} />
            <Field label="Tryskacze" value={<Bool v={wniosek.tryskacze} />} />
            <Field label="Drogi ewakuacyjne" value={<Bool v={wniosek.drogiEwakuacyjne} />} />
            <Field label="Odległość od PSP" value={wniosek.odlegloscPsp ? `${wniosek.odlegloscPsp} km` : null} />
            <Field label="Zakaz palenia" value={<Bool v={wniosek.zakazPalenia} />} />
          </Section>

          <Section title="Zabezpieczenia antykradzieżowe">
            <Field label="Alarm" value={wniosek.alarmTyp} />
            <Field label="Ogrodzenie" value={<Bool v={wniosek.ogrodzenie} />} />
            <Field label="Agencja ochrony" value={wniosek.agencjaOchrony} />
            <Field label="Ochrona 24h" value={<Bool v={wniosek.agencja24h} />} />
            <Field label="CCTV" value={<Bool v={wniosek.cctv} />} />
            <Field label="Kraty" value={<Bool v={wniosek.kraty} />} />
            <Field label="Rolety" value={<Bool v={wniosek.rolety} />} />
            <Field label="Zamki atestowane" value={<Bool v={wniosek.zamkiAtestowane} />} />
            <Field label="Drzwi atestowane" value={<Bool v={wniosek.drzwiAtestowane} />} />
            <Field label="Szyby antywłam." value={<Bool v={wniosek.szybyAntywlamaniowe} />} />
            <Field label="Sejf / klasa" value={wniosek.sejfKlasa} />
            <Field label="Komputerowy alarm" value={<Bool v={wniosek.systemAlarmowy} />} />
          </Section>

          <Section title="Zakres ubezpieczenia">
            <div className="col-span-2 flex flex-wrap gap-1">
              {wniosek.zakres?.length ? wniosek.zakres.map(z => (
                <span key={z} className="text-xs bg-pink-950 text-pink-300 px-2 py-0.5 rounded">{z}</span>
              )) : <span className="text-zinc-600 text-xs">brak</span>}
            </div>
          </Section>

          <Section title="Sumy ubezpieczenia (PLN)">
            {KATEGORIE.map(k => (
              <Field key={k.key} label={k.label} value={PLN(wniosek[k.key] as number)} />
            ))}
            <div className="col-span-2 border-t border-zinc-700 pt-2 mt-1">
              <Field label="ŁĄCZNA SUMA" value={<span className="font-bold text-pink-400 text-base">{PLN(wniosek.sumaLacznie)}</span>} />
            </div>
          </Section>

          <Section title="Historia szkodowości">
            <Field label="Brak szkód w 5 latach" value={<Bool v={wniosek.brakSzkod} />} />
            {!wniosek.brakSzkod && wniosek.szkody?.length > 0 && (
              <div className="col-span-2 mt-2">
                <table className="w-full text-xs text-zinc-300">
                  <thead><tr className="text-zinc-500 border-b border-zinc-800">
                    <th className="text-left pb-1">Data</th><th className="text-left pb-1">Przyczyna</th>
                    <th className="text-right pb-1">Kwota</th><th className="text-right pb-1">Odszkodowanie</th>
                  </tr></thead>
                  <tbody>{wniosek.szkody.map((s, i) => (
                    <tr key={i} className="border-b border-zinc-900">
                      <td className="py-1">{s.data}</td><td className="py-1">{s.przyczyna}</td>
                      <td className="py-1 text-right">{PLN(s.kwota)}</td>
                      <td className="py-1 text-right">{PLN(s.odszkodowanie)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title="Dotychczasowe ubezpieczenie">
            <Field label="Posiada polisę" value={<Bool v={wniosek.posiadaPolise} />} />
            <Field label="Towarzystwo" value={wniosek.towarzystwoObecne} />
            <Field label="Nr polisy" value={wniosek.nrPolisyObecny} />
            <Field label="Ważna do" value={wniosek.waznoscDo} />
            <Field label="Składka roczna" value={wniosek.rocznaSlkadkaObecna ? PLN(wniosek.rocznaSlkadkaObecna) : null} />
          </Section>

          {wniosek.uwagi && (
            <Section title="Uwagi">
              <div className="col-span-2 text-sm text-zinc-300 bg-zinc-900 p-3 rounded">{wniosek.uwagi}</div>
            </Section>
          )}

          {(wniosek.sprzet?.length > 0) && (
            <div className="mb-6">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 border-b border-zinc-800 pb-1">Sprzęt medyczny ({wniosek.sprzet.length} poz.)</h3>
              <table className="w-full text-xs text-zinc-300">
                <thead><tr className="text-zinc-500 border-b border-zinc-800">
                  <th className="text-left pb-1">Nazwa</th><th className="text-left pb-1">Marka/Model</th>
                  <th className="text-left pb-1">Rok</th><th className="text-right pb-1">Wartość</th>
                </tr></thead>
                <tbody>{wniosek.sprzet.filter(s => s.nazwa).map((s, i) => (
                  <tr key={i} className="border-b border-zinc-900">
                    <td className="py-1">{s.nazwa}</td><td className="py-1">{s.producent} {s.model}</td>
                    <td className="py-1">{s.rokZakupu}</td><td className="py-1 text-right">{PLN(s.wartosc)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}

          {(wniosek.elektronika?.length > 0) && (
            <div className="mb-6">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-3 border-b border-zinc-800 pb-1">Elektronika EEI ({wniosek.elektronika.length} poz.)</h3>
              <table className="w-full text-xs text-zinc-300">
                <thead><tr className="text-zinc-500 border-b border-zinc-800">
                  <th className="text-left pb-1">Nazwa</th><th className="text-left pb-1">Marka/Model</th>
                  <th className="text-left pb-1">Rok</th><th className="text-right pb-1">Wartość</th>
                </tr></thead>
                <tbody>{wniosek.elektronika.filter(e => e.nazwa).map((e, i) => (
                  <tr key={i} className="border-b border-zinc-900">
                    <td className="py-1">{e.nazwa}</td><td className="py-1">{e.producent} {e.model}</td>
                    <td className="py-1">{e.rokZakupu}</td><td className="py-1 text-right">{PLN(e.wartosc)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Mienie({ onSelectCompany }: { onSelectCompany: (c: Company) => void }) {
  const { companies, mienieWnioski, mienieLoading, loadMienieWnioski, generateFormToken, resetFormToken } = useCRMStore();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'lista'|'agregaty'>('lista');
  const [selectedWniosek, setSelectedWniosek] = useState<MienieWniosek | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [generating, setGenerating] = useState<number | null>(null);

  useEffect(() => { loadMienieWnioski(); }, []);

  const wniosekByCompany = useMemo(() => {
    const m = new Map<number, MienieWniosek>();
    mienieWnioski.forEach(w => { if (w.companyId) m.set(w.companyId, w); });
    return m;
  }, [mienieWnioski]);

  const filteredCompanies = useMemo(() =>
    companies.filter(c => {
      const q = search.toLowerCase();
      return !q || c.company.toLowerCase().includes(q) || (c.nip ?? '').includes(q) || (c.city ?? '').toLowerCase().includes(q);
    }),
    [companies, search]
  );

  const totalSuma = useMemo(() => mienieWnioski.reduce((s, w) => s + (w.sumaLacznie ?? 0), 0), [mienieWnioski]);
  const sumaByKat = useMemo(() =>
    KATEGORIE.map(k => ({
      label: k.label,
      total: mienieWnioski.reduce((s, w) => s + ((w[k.key] as number) ?? 0), 0),
    })),
    [mienieWnioski]
  );

  const copyLink = async (c: Company) => {
    const base = window.location.origin;
    const url = `${base}/mienie-formularz.html?token=${c.formToken}`;
    await navigator.clipboard.writeText(url);
    setCopied(c.id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleGenerate = async (c: Company) => {
    setGenerating(c.id);
    await (c.formToken ? resetFormToken(c.id) : generateFormToken(c.id));
    setGenerating(null);
  };

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      {/* KPI */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        {[
          { label: 'Wnioski złożone', value: mienieWnioski.length, sub: `z ${companies.length} firm` },
          { label: 'Linki wygenerowane', value: companies.filter(c => c.formToken).length, sub: 'aktywnych linków' },
          { label: 'Łączna suma ubezpieczenia', value: PLN(totalSuma), sub: 'wszystkie kategorie' },
          { label: 'Śr. suma na wniosek', value: mienieWnioski.length ? PLN(Math.round(totalSuma / mienieWnioski.length)) : '—', sub: 'na jeden wniosek' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded p-4 border border-zinc-200">
            <div className="text-xs text-zinc-500 mb-1">{kpi.label}</div>
            <div className="text-2xl font-bold text-zinc-900">{kpi.value}</div>
            <div className="text-xs text-zinc-400 mt-0.5">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-zinc-200 flex-shrink-0">
        {(['lista', 'agregaty'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${tab === t ? 'border-pink-500 text-pink-600' : 'border-transparent text-zinc-500 hover:text-zinc-800'}`}>
            {t === 'lista' ? 'Lista klientów' : 'Agregaty sum'}
          </button>
        ))}
        {tab === 'lista' && (
          <div className="ml-auto mb-2">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Szukaj firmy, NIP, miasto..."
              className="text-sm border border-zinc-300 px-3 py-1.5 rounded w-72 focus:outline-none focus:border-pink-400" />
          </div>
        )}
      </div>

      {tab === 'lista' && (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-zinc-50 border-b border-zinc-200">
              <tr className="text-left text-xs text-zinc-500 uppercase tracking-wide">
                <th className="px-3 py-2">Firma</th>
                <th className="px-3 py-2">NIP</th>
                <th className="px-3 py-2">Miasto</th>
                <th className="px-3 py-2">Status formularza</th>
                <th className="px-3 py-2 text-right">Suma łączna</th>
                <th className="px-3 py-2">Data złożenia</th>
                <th className="px-3 py-2 text-center">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.map(c => {
                const w = wniosekByCompany.get(c.id);
                return (
                  <tr key={c.id} className="border-b border-zinc-100 hover:bg-zinc-50 transition-colors">
                    <td className="px-3 py-2">
                      <button onClick={() => onSelectCompany(c)} className="text-left font-medium text-zinc-900 hover:text-pink-600 transition-colors">
                        {c.company}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-zinc-500 text-xs">{c.nip || '—'}</td>
                    <td className="px-3 py-2 text-zinc-500 text-xs">{c.city || '—'}</td>
                    <td className="px-3 py-2">
                      {w ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                          ✓ Złożony
                        </span>
                      ) : c.formToken ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                          ⏳ Link wysłany
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-400">— brak linku</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-zinc-800">
                      {w ? PLN(w.sumaLacznie) : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-500">
                      {w ? fmtDate(w.createdAt) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        {w && (
                          <button onClick={() => setSelectedWniosek(w)}
                            className="text-xs px-2 py-1 bg-zinc-800 text-zinc-200 hover:bg-zinc-700 rounded transition-colors">
                            Podgląd
                          </button>
                        )}
                        {c.formToken ? (
                          <>
                            <button onClick={() => copyLink(c)}
                              className={`text-xs px-2 py-1 rounded transition-colors ${copied === c.id ? 'bg-emerald-500 text-white' : 'bg-pink-600 text-white hover:bg-pink-700'}`}>
                              {copied === c.id ? '✓ Skopiowano' : 'Kopiuj link'}
                            </button>
                            <button onClick={() => handleGenerate(c)} disabled={generating === c.id}
                              title="Generuj nowy link (unieważni stary)"
                              className="text-xs px-2 py-1 border border-zinc-300 text-zinc-500 hover:text-zinc-800 hover:border-zinc-500 rounded transition-colors">
                              {generating === c.id ? '…' : '↻'}
                            </button>
                          </>
                        ) : (
                          <button onClick={() => handleGenerate(c)} disabled={generating === c.id}
                            className="text-xs px-2 py-1 border border-pink-300 text-pink-600 hover:bg-pink-50 rounded transition-colors">
                            {generating === c.id ? 'Generuję…' : '+ Generuj link'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredCompanies.length === 0 && (
                <tr><td colSpan={7} className="text-center py-12 text-zinc-400">Brak wyników</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'agregaty' && (
        <div className="flex-1 overflow-auto">
          {mienieLoading ? (
            <div className="flex items-center justify-center h-40 text-zinc-400 text-sm">Ładowanie danych…</div>
          ) : mienieWnioski.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-zinc-400 text-sm">Brak złożonych wniosków</div>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              {/* Breakdown table */}
              <div className="bg-white border border-zinc-200 rounded p-5">
                <h3 className="font-semibold text-zinc-800 mb-4 text-sm">Sumy ubezpieczenia według kategorii</h3>
                <div className="space-y-3">
                  {sumaByKat.map(k => {
                    const pct = totalSuma > 0 ? (k.total / totalSuma) * 100 : 0;
                    return (
                      <div key={k.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-zinc-600">{k.label}</span>
                          <span className="font-medium text-zinc-800">{PLN(k.total)}</span>
                        </div>
                        <div className="h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                          <div className="h-full bg-pink-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                  <div className="border-t border-zinc-200 pt-3 flex justify-between font-bold text-sm">
                    <span className="text-zinc-700">ŁĄCZNIE</span>
                    <span className="text-pink-600">{PLN(totalSuma)}</span>
                  </div>
                </div>
              </div>

              {/* Sprzęt medyczny aggregate */}
              <div className="bg-white border border-zinc-200 rounded p-5">
                <h3 className="font-semibold text-zinc-800 mb-4 text-sm">Top sprzęt medyczny (po wartości)</h3>
                {(() => {
                  const allSprzet = mienieWnioski.flatMap(w => (w.sprzet ?? []).filter(s => s.nazwa && s.wartosc));
                  const sorted = [...allSprzet].sort((a, b) => b.wartosc - a.wartosc).slice(0, 10);
                  return sorted.length ? (
                    <table className="w-full text-xs">
                      <thead><tr className="text-zinc-400 border-b border-zinc-100">
                        <th className="text-left pb-1">Urządzenie</th>
                        <th className="text-left pb-1">Marka</th>
                        <th className="text-right pb-1">Wartość</th>
                      </tr></thead>
                      <tbody>{sorted.map((s, i) => (
                        <tr key={i} className="border-b border-zinc-50">
                          <td className="py-1 text-zinc-700">{s.nazwa}</td>
                          <td className="py-1 text-zinc-400">{s.producent}</td>
                          <td className="py-1 text-right font-medium text-zinc-800">{PLN(s.wartosc)}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  ) : <div className="text-zinc-400 text-xs">Brak danych</div>;
                })()}
              </div>

              {/* Per-wniosek table */}
              <div className="col-span-2 bg-white border border-zinc-200 rounded p-5">
                <h3 className="font-semibold text-zinc-800 mb-4 text-sm">Wnioski — zestawienie {mienieWnioski.length} rekordów</h3>
                <table className="w-full text-xs">
                  <thead><tr className="text-zinc-400 border-b border-zinc-100 text-left">
                    <th className="pb-1">Firma</th>
                    <th className="pb-1">Budynek</th>
                    <th className="pb-1">Wyposażenie</th>
                    <th className="pb-1">Sprzęt med.</th>
                    <th className="pb-1">Elektronika</th>
                    <th className="pb-1 text-right">Suma łączna</th>
                    <th className="pb-1">Data</th>
                  </tr></thead>
                  <tbody>
                    {[...mienieWnioski].sort((a, b) => b.sumaLacznie - a.sumaLacznie).map(w => (
                      <tr key={w.id} className="border-b border-zinc-50 hover:bg-zinc-50 cursor-pointer" onClick={() => setSelectedWniosek(w)}>
                        <td className="py-1.5 font-medium text-zinc-700">{w.nazwaFirmy}</td>
                        <td className="py-1.5">{PLN(w.sumaBudynek)}</td>
                        <td className="py-1.5">{PLN(w.sumaWyposazenie)}</td>
                        <td className="py-1.5">{PLN(w.sumaSprzet)}</td>
                        <td className="py-1.5">{PLN(w.sumaElektronikaIt)}</td>
                        <td className="py-1.5 text-right font-bold text-pink-600">{PLN(w.sumaLacznie)}</td>
                        <td className="py-1.5 text-zinc-400">{fmtDate(w.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-zinc-200">
                    <tr className="font-bold text-xs">
                      <td className="pt-2 text-zinc-600">SUMA</td>
                      <td className="pt-2">{PLN(mienieWnioski.reduce((s,w)=>s+w.sumaBudynek,0))}</td>
                      <td className="pt-2">{PLN(mienieWnioski.reduce((s,w)=>s+w.sumaWyposazenie,0))}</td>
                      <td className="pt-2">{PLN(mienieWnioski.reduce((s,w)=>s+w.sumaSprzet,0))}</td>
                      <td className="pt-2">{PLN(mienieWnioski.reduce((s,w)=>s+w.sumaElektronikaIt,0))}</td>
                      <td className="pt-2 text-right text-pink-600">{PLN(totalSuma)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedWniosek && (
        <WniosekDrawer
          wniosek={selectedWniosek}
          company={companies.find(c => c.id === selectedWniosek.companyId)}
          onClose={() => setSelectedWniosek(null)}
        />
      )}
    </div>
  );
}
