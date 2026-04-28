import { useMemo } from 'react';
import { useCRMStore } from '../store/useCRMStore';

function fmtPLN(n: number) {
  return n.toLocaleString('pl-PL', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' zł';
}

export function Reports() {
  const { companies } = useCRMStore();

  const stats = useMemo(() => {
    const allPolicies = companies.flatMap(c => c.policies);

    // Składka total po data_od (rok kalendarzowy)
    const skladkaYear = (year: number) =>
      allPolicies
        .filter(p => p.status === 'aktywna' && p.dataOd && new Date(p.dataOd).getFullYear() === year)
        .reduce((s, p) => s + (p.skladka ?? 0) + (p.ochronaPrawna ? 92 : 0), 0);

    // Polisy wg rodzaju
    const byRodzaj = (keywords: string[]) => {
      const matching = allPolicies.filter(p =>
        p.status === 'aktywna' &&
        keywords.some(k => p.rodzaj?.toLowerCase().includes(k.toLowerCase()))
      );
      return {
        count: matching.length,
        skladka: matching.reduce((s, p) => s + (p.skladka ?? 0) + (p.ochronaPrawna ? 92 : 0), 0),
        companies: [...new Set(matching.map(p => p.companyId))].length,
      };
    };

    const oc  = byRodzaj(['OC', 'odpowiedzialności cywilnej']);
    const tax = byRodzaj(['karno', 'skarbowa', 'tax', 'podatkow']);
    const l4  = byRodzaj(['utrata', 'dochodu', 'l4', 'chorobow']);

    // Aktywne polisy ogółem
    const aktywne = allPolicies.filter(p => p.status === 'aktywna');
    const wygasajace = aktywne.filter(p => {
      if (!p.dataDo) return false;
      const days = Math.ceil((new Date(p.dataDo).getTime() - Date.now()) / 86400000);
      return days >= 0 && days <= 45;
    });

    // Klienci z polisami
    const klienciZPolisami = companies.filter(c => c.policies.some(p => p.status === 'aktywna')).length;

    return {
      skladka2025: skladkaYear(2025),
      skladka2026: skladkaYear(2026),
      oc, tax, l4,
      aktywne: aktywne.length,
      wygasajace: wygasajace.length,
      klienciZPolisami,
      totalAll: aktywne.reduce((s, p) => s + (p.skladka ?? 0) + (p.ochronaPrawna ? 92 : 0), 0),
    };
  }, [companies]);

  const KPI = ({ label, value, sub, color='text-zinc-900', bg='bg-white border-zinc-200' }: { label: string; value: string; sub?: string; color?: string; bg?: string }) => (
    <div className={`border p-5 ${bg}`}>
      <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">{label}</div>
      <div className={`text-3xl font-black font-mono ${color}`}>{value}</div>
      {sub && <div className="text-xs text-zinc-400 mt-1">{sub}</div>}
    </div>
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-zinc-900">Raporty — BeautyPolisa</h2>
        <div className="text-sm text-zinc-500">{companies.length} salonów · {stats.klienciZPolisami} z aktywną polisą</div>
      </div>

      {/* Składki TOTAL wg roku */}
      <div className="mb-4">
        <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">💰 Składki TOTAL (rok kalendarzowy)</div>
        <div className="grid grid-cols-3 gap-3">
          <KPI label="Składki 2025" value={fmtPLN(stats.skladka2025)} sub="polisy z data_od w 2025" color="text-zinc-600" bg="bg-zinc-50 border-zinc-200"/>
          <KPI label="Składki 2026" value={fmtPLN(stats.skladka2026)} sub="polisy z data_od w 2026" color="text-emerald-700" bg="bg-emerald-50 border-emerald-200"/>
          <KPI label="Wszystkie aktywne" value={fmtPLN(stats.totalAll)} sub={`${stats.aktywne} aktywnych polis`} color="text-zinc-900" bg="bg-white border-zinc-300"/>
        </div>
      </div>

      {/* Polisy wg rodzaju */}
      <div className="mb-4">
        <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">🛡️ Polisy wg rodzaju</div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 border border-blue-200 p-5">
            <div className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Polisy OC</div>
            <div className="text-3xl font-black font-mono text-blue-700 mb-1">{stats.oc.count}</div>
            <div className="text-sm font-mono font-bold text-blue-600">{fmtPLN(stats.oc.skladka)}</div>
            <div className="text-xs text-blue-400 mt-1">{stats.oc.companies} salonów</div>
          </div>
          <div className="bg-amber-50 border border-amber-200 p-5">
            <div className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-2">Polisy TAX (karno-skarbowa)</div>
            <div className="text-3xl font-black font-mono text-amber-700 mb-1">{stats.tax.count}</div>
            <div className="text-sm font-mono font-bold text-amber-600">{fmtPLN(stats.tax.skladka)}</div>
            <div className="text-xs text-amber-400 mt-1">{stats.tax.companies} salonów</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 p-5">
            <div className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-2">Polisy L4 (utrata dochodu)</div>
            <div className="text-3xl font-black font-mono text-purple-700 mb-1">{stats.l4.count}</div>
            <div className="text-sm font-mono font-bold text-purple-600">{fmtPLN(stats.l4.skladka)}</div>
            <div className="text-xs text-purple-400 mt-1">{stats.l4.companies} salonów</div>
          </div>
        </div>
      </div>

      {/* Alerty */}
      <div className="mb-4">
        <div className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">⚠️ Alerty</div>
        <div className="grid grid-cols-3 gap-3">
          <KPI label="Wygasa w ciągu 45 dni" value={String(stats.wygasajace)} sub="wymaga kontaktu" color={stats.wygasajace > 0 ? 'text-red-600' : 'text-zinc-400'} bg={stats.wygasajace > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-zinc-200'}/>
          <KPI label="Klienci z polisą" value={String(stats.klienciZPolisami)} sub={`z ${companies.length} salonów`} color="text-emerald-700" bg="bg-emerald-50 border-emerald-200"/>
          <KPI label="Bez polisy" value={String(companies.filter(c=>c.status==='zamkniety'&&c.policies.length===0).length)} sub="status Klient, brak polisy" color="text-amber-700" bg="bg-amber-50 border-amber-200"/>
        </div>
      </div>
    </div>
  );
}
