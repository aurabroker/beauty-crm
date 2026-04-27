import { useState } from 'react';
import { useCRMStore } from '../store/useCRMStore';
import { supabase } from '../lib/supabase';

/*
  Google Sheets import — dwie metody:
  1. Published CSV URL (bez auth, sheet publiczny):
     File → Share → Publish to web → CSV → skopiuj URL
     https://docs.google.com/spreadsheets/d/ID/pub?gid=0&single=true&output=csv

  2. Export URL (sheet udostępniony "Anyone with link"):
     https://docs.google.com/spreadsheets/d/ID/export?format=csv&gid=0
*/

const COLUMN_MAP: Record<string, string> = {
  'firma': 'company', 'company': 'company', 'nazwa': 'company', 'name': 'company',
  'kontakt': 'contact', 'contact': 'contact', 'osoba': 'contact',
  'telefon': 'phone', 'phone': 'phone', 'tel': 'phone',
  'email': 'email', 'e-mail': 'email', 'mail': 'email',
  'miasto': 'city', 'city': 'city',
  'województwo': 'state', 'state': 'state', 'region': 'state',
  'branża': 'industry', 'industry': 'industry', 'branch': 'industry',
  'pracownicy': 'employees', 'employees': 'employees', 'zatrudnienie': 'employees',
  'www': 'url', 'url': 'url', 'strona': 'url', 'website': 'url',
  'nip': 'nip', 'regon': 'regon', 'notatki': 'notes', 'notes': 'notes',
  'stanowisko': 'title', 'title': 'title', 'position': 'title',
};

function mapHeader(h: string): string {
  return COLUMN_MAP[h.toLowerCase().trim()] ?? h.toLowerCase().trim();
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    // Handle quoted CSV properly
    const vals: string[] = [];
    let cur = '', inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    vals.push(cur.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[mapHeader(h)] = vals[i]?.replace(/^"|"$/g, '') ?? ''; });
    return obj;
  }).filter(r => r.company);
}

export function GoogleSheetsImport() {
  const { importCompanies, currentUser } = useCRMStore();
  const [sheetUrl, setSheetUrl] = useState('');
  const [savedUrl, setSavedUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ count: number; errors: string[] } | null>(null);
  const [error, setError] = useState('');

  const isAdmin = currentUser?.role === 'admin';

  const convertToCSVUrl = (url: string): string => {
    // Convert various GSheets URL formats to CSV export URL
    const match = url.match(/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) return url;
    const id = match[1];
    const gidMatch = url.match(/[#&?]gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : '0';
    // If it's already a pub URL, use as-is
    if (url.includes('/pub?')) return url;
    return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
  };

  const handleImport = async () => {
    if (!sheetUrl.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const csvUrl = convertToCSVUrl(sheetUrl.trim());
      // Use CORS proxy for non-public sheets
      const urls = [csvUrl, `https://corsproxy.io/?${encodeURIComponent(csvUrl)}`];
      let text = '';
      for (const url of urls) {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
          if (res.ok) { text = await res.text(); break; }
        } catch { continue; }
      }
      if (!text) throw new Error('Nie można pobrać arkusza. Sprawdź czy jest udostępniony publicznie.');
      const rows = parseCSV(text);
      if (rows.length === 0) throw new Error('Brak danych lub niepoprawny format. Sprawdź nagłówki kolumn.');
      await importCompanies(rows as Parameters<typeof importCompanies>[0]);
      setResult({ count: rows.length, errors: [] });
      // Save URL to settings
      if (savedUrl !== sheetUrl) {
        setSavedUrl(sheetUrl);
        await supabase.from('crm_settings').upsert({ key: 'gsheets_url', value: JSON.stringify(sheetUrl) as unknown as Record<string,unknown> });
      }
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin) return <div className="text-zinc-400 text-sm p-4">Tylko Admin może konfigurować import.</div>;

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <div className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-3">Import z Google Sheets</div>
        <div className="bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800 space-y-1 mb-4">
          <div className="font-medium">📋 Jak przygotować arkusz Google:</div>
          <div>1. Otwórz arkusz → <strong>Plik → Udostępnij → Opublikuj w internecie</strong></div>
          <div>2. Wybierz arkusz, format: <strong>Wartości rozdzielane przecinkami (.csv)</strong></div>
          <div>3. Skopiuj link i wklej poniżej</div>
          <div className="text-xs text-blue-600 mt-2">Obsługiwane nagłówki: <code>firma, kontakt, telefon, email, miasto, branża, pracownicy, www, nip, notatki</code></div>
        </div>
        <div className="flex gap-2">
          <input value={sheetUrl} onChange={e => setSheetUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="flex-1 h-9 text-sm border border-zinc-200 px-3 focus:outline-none focus:border-zinc-900 font-mono text-xs"/>
          <button onClick={handleImport} disabled={loading || !sheetUrl.trim()}
            className="px-4 h-9 text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 transition-colors whitespace-nowrap font-medium">
            {loading ? '⏳ Importuję...' : '↓ Importuj'}
          </button>
        </div>
        {error && <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 p-2">{error}</div>}
        {result && (
          <div className="mt-2 text-sm text-green-700 bg-green-50 border border-green-200 p-2">
            ✅ Zaimportowano <strong>{result.count}</strong> firm z Google Sheets!
          </div>
        )}
      </div>

      {savedUrl && (
        <div className="text-xs text-zinc-400 border border-zinc-100 p-3">
          <span className="font-medium text-zinc-600">Ostatni arkusz:</span> {savedUrl.slice(0, 60)}...
          <button onClick={handleImport} disabled={loading} className="ml-2 text-blue-500 hover:text-blue-700 underline">
            Odśwież dane
          </button>
        </div>
      )}
    </div>
  );
}
