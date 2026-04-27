// GUS/MF lookup via Biała Lista podatników VAT (free, no auth needed)
// Returns: NIP, name, address, REGON, KRS
// REGON API (full GUS data) requires separate registration at api.regon.gov.pl

export interface GUSCompany {
  name: string;
  nip: string;
  regon: string;
  krs?: string;
  address: string;
  city: string;
  postalCode: string;
}

export async function lookupByNIP(nip: string): Promise<GUSCompany | null> {
  const cleaned = nip.replace(/[-\s]/g, '');
  if (cleaned.length !== 10) throw new Error('NIP musi mieć 10 cyfr');
  const today = new Date().toISOString().split('T')[0];
  const res = await fetch(`https://wl-api.mf.gov.pl/api/search/nip/${cleaned}?date=${today}`);
  if (!res.ok) throw new Error(`Błąd API: ${res.status}`);
  const json = await res.json();
  const s = json?.result?.subject;
  if (!s) return null;
  // Parse address
  const addr = s.workingAddress || s.residenceAddress || '';
  const cityMatch = addr.match(/\d{2}-\d{3}\s+(.+?)(?:,|$)/);
  const city = cityMatch ? cityMatch[1].trim() : '';
  return {
    name: s.name ?? '',
    nip: s.nip ?? cleaned,
    regon: s.regon ?? '',
    krs: s.krs ?? undefined,
    address: addr,
    city,
    postalCode: addr.match(/(\d{2}-\d{3})/)?.[1] ?? '',
  };
}

export async function lookupByREGON(_regon: string): Promise<GUSCompany | null> {
  // REGON API wymaga rejestracji na api.regon.gov.pl — tu tylko komunikat
  throw new Error('Wyszukiwanie po REGON wymaga klucza API z api.regon.gov.pl. Użyj NIP.');
}
