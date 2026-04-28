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
  status: Status; assignedTo?: string; assignedUserId?: string;
  history: ContactHistory[]; reminders: Reminder[]; policies: Policy[];
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
