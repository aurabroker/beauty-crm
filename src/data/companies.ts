export type Status = 'lead' | 'kontakt' | 'oferta' | 'negocjacje' | 'zamkniety' | 'stracony';

export interface ContactHistory {
  id: string; type: 'notatka'|'telefon'|'email'|'spotkanie';
  date: string; note: string; author: string;
}
export interface Reminder {
  id: string; date: string; text: string; done: boolean;
}
export interface Policy {
  id: string;
  companyId: number;
  nrPolisy: string;
  rodzaj: string;
  sumaUbezpieczenia: string;
  skladka: number | null;
  skladkaOkres: 'miesięczna' | 'kwartalna' | 'roczna' | 'jednorazowa';
  dataOd: string;
  dataDo: string;
  przypomnienie: string;
  ochronaPrawna: boolean;
  status: 'aktywna' | 'wygasła' | 'anulowana';
  notes: string;
  createdAt: string;
  createdBy: string;
}
export interface CRMUser {
  id: string; name: string; email: string; role: 'admin'|'user'; color: string; active: boolean;
}
export interface PipelineStage {
  key: Status; label: string; color: string;
}
export interface Company {
  id: number; company: string; contact: string; title: string;
  phone: string; email: string; city: string; state: string;
  industry: string; revenue: number; employees: string; url: string;
  nip?: string; regon?: string; notes?: string;
  ubezpieczenie?: string; przychod?: string;
  tag?: string;
  zainteresowania?: string;
  leadSource?: string;
  grStatus?: string;
  grSentAt?: string;
  status: Status; assignedTo?: string; assignedUserId?: string;
  history: ContactHistory[]; reminders: Reminder[]; policies: Policy[];
  formToken?: string;
}

export interface MienieSprzet {
  lp: number; nazwa: string; producent: string; model: string;
  nrSeryjny: string; rokZakupu: string; wartosc: number; certCE: boolean; uwagi: string;
}

export interface MienieElektronika {
  lp: number; nazwa: string; producent: string; model: string;
  rokZakupu: string; wartosc: number; nrSeryjny: string; uwagi: string;
}

export interface MienieSzkoda {
  data: string; przyczyna: string; kwota: number; odszkodowanie: number; ubezpieczyciel: string;
}

export interface MienieLokalizacja {
  id: string;
  wniosekId: string;
  companyId: number | null;
  nr: number;
  nazwa: string;
  adres: string; typLokalu: string; pietro: string; powierzchnia: number | null;
  rokBudowy: string; rokRemontu: string; budynekWlasny: boolean;
  materialScian: string; pokrycieDachu: string; stanTechniczny: string;
  ogrzewanie: string; materialyPalne: boolean;
  gasniceSzt: string; hydranty: boolean; dataPrzegladuGasnic: string; sap: boolean;
  tryskacze: boolean; drogiEwakuacyjne: boolean; odlegloscPsp: string; zakazPalenia: boolean;
  alarmTyp: string; ogrodzenie: boolean; agencjaOchrony: string; agencja24h: boolean;
  cctv: boolean; kraty: boolean; rolety: boolean; zamkiAtestowane: boolean;
  drzwiAtestowane: boolean; szybyAntywlamaniowe: boolean; sejfKlasa: string; systemAlarmowy: boolean;
  sumaBudynek: number; sumaWyposazenie: number; sumaMaszyny: number;
  sumaSrodkiObrotowe: number; sumaElektronikaIt: number; sumaSprzet: number;
  sumaGotowkaLokal: number; sumaGotowkaTransport: number; sumaSzyby: number;
  sumaMieniePracownikow: number; sumaLacznie: number;
  sprzet: MienieSprzet[];
  elektronika: MienieElektronika[];
  createdAt: string;
}

export interface MienieWniosek {
  id: string;
  companyId: number | null;
  formToken: string;
  nazwaFirmy: string; nip: string; regon: string; krs: string;
  adresSiedziby: string; formaPrawna: string; numerPkd: string;
  emailKontaktowy: string; telefon: string; osobaKontaktu: string; stanowisko: string;
  adresLokalizacji: string; typLokalu: string; pietro: string; powierzchnia: number | null;
  rokBudowy: string; rokRemontu: string; budynekWlasny: boolean;
  materialScian: string; pokrycieDachu: string; stanTechniczny: string;
  ogrzewanie: string; materialyPalne: boolean;
  rodzajDzialalnosci: string; liczbaPracownikow: string; rocznyObrot: string;
  zabiegi: string[];
  gasniceSzt: string; hydranty: boolean; dataPrzegladuGasnic: string; sap: boolean;
  tryskacze: boolean; drogiEwakuacyjne: boolean; odlegloscPsp: string; zakazPalenia: boolean;
  alarmTyp: string; ogrodzenie: boolean; agencjaOchrony: string; agencja24h: boolean;
  cctv: boolean; kraty: boolean; rolety: boolean; zamkiAtestowane: boolean;
  drzwiAtestowane: boolean; szybyAntywlamaniowe: boolean; sejfKlasa: string; systemAlarmowy: boolean;
  zakres: string[];
  sumaBudynek: number; sumaWyposazenie: number; sumaMaszyny: number;
  sumaSrodkiObrotowe: number; sumaElektronikaIt: number; sumaSprzet: number;
  sumaGotowkaLokal: number; sumaGotowkaTransport: number; sumaSzyby: number;
  sumaMieniePracownikow: number; sumaLacznie: number;
  brakSzkod: boolean; szkody: MienieSzkoda[];
  posiadaPolise: boolean; towarzystwoObecne: string; nrPolisyObecny: string;
  waznoscDo: string; rocznaSlkadkaObecna: number | null;
  uwagi: string; zgodaPrawdziwosc: boolean; zgodaRodo: boolean;
  sprzet: MienieSprzet[];
  elektronika: MienieElektronika[];
  createdAt: string; updatedAt: string;
}

export const DEFAULT_STAGES: PipelineStage[] = [
  { key:'lead',       label:'Lead',       color:'#6b7280' },
  { key:'kontakt',    label:'Kontakt',    color:'#db2777' },
  { key:'oferta',     label:'Oferta',     color:'#f59e0b' },
  { key:'negocjacje', label:'Negocjacje', color:'#8b5cf6' },
  { key:'zamkniety',  label:'Klient',     color:'#10b981' },
  { key:'stracony',   label:'Rezygnacja', color:'#ef4444' },
];

export const RODZAJE_UBEZPIECZEN = [
  'Ubezpieczenie OC',
  'Ubezpieczenie utraty dochodu',
  'Ochrona karno-skarbowa',
  'Pakiety zdrowotne',
  'Inne',
];

export const TAGI_ZADANIOWE = [
  'Do kontaktu',
  'Oferta wysłana',
  'Czeka na decyzję',
  'Umówione spotkanie',
  'Brak kontaktu',
  'Nie zainteresowany',
  'VIP',
];
