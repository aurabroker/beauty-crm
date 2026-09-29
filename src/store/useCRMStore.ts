import { create } from 'zustand';
import { toast } from 'sonner';
import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Company, ContactHistory, Reminder, CRMUser, PipelineStage, Policy, MienieWniosek, MienieLokalizacja } from '../data/companies';
import { DEFAULT_STAGES } from '../data/companies';

// Niektóre pola tablicowe (sprzet_medyczny, elektronika_eei) są zapisywane przez
// formularz jako string JSON (double-encoded). Normalizujemy je zawsze do tablicy,
// inaczej .filter/.length/.map wybucha na stringu/obiekcie.
function toArray<T = unknown>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return Array.isArray(p) ? (p as T[]) : []; }
    catch { return []; }
  }
  return [];
}

// PostgREST zwraca maksymalnie 1000 wierszy na zapytanie — bez stronicowania
// część firm i historii po prostu znikała z CRM.
const PAGE_SIZE = 1000;
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

function groupBy<T>(rows: T[], key: (row: T) => number): Map<number, T[]> {
  const map = new Map<number, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row); else map.set(k, [row]);
  }
  return map;
}

function reportError(action: string, error: { message?: string } | null | undefined): boolean {
  if (!error) return false;
  console.error(action, error);
  toast.error(`${action}: ${error.message ?? 'nieznany błąd'}`);
  return true;
}

function denied(action: string): void {
  toast.error(`${action}: brak uprawnień`);
}

function calcReminderDate(dataDo: string): string {
  if (!dataDo) return '';
  const d = new Date(dataDo);
  d.setDate(d.getDate() - 45);
  return d.toISOString().split('T')[0];
}

function dbRowToCompany(row: Record<string,unknown>, history: ContactHistory[]=[], reminders: Reminder[]=[], policies: Policy[]=[]): Company {
  return {
    id: row.id as number, company: row.company as string,
    contact: (row.contact as string) ?? '', title: (row.title as string) ?? '',
    phone: (row.phone as string) ?? '', email: (row.email as string) ?? '',
    city: (row.city as string) ?? '', state: (row.state as string) ?? '',
    industry: (row.industry as string) ?? '', revenue: (row.revenue as number) ?? 0,
    employees: (row.employees as string) ?? '', url: (row.url as string) ?? '',
    nip: (row.nip as string) ?? '', notes: (row.notes as string) ?? '',
    ubezpieczenie: (row.ubezpieczenie as string) ?? '',
    przychod: (row.przychod as string) ?? '',
    tag: (row.tag as string) ?? '',
    zainteresowania: (row.zainteresowania as string) ?? '',
    leadSource: (row.lead_source as string) ?? '',
    grStatus: (row.gr_status as string) ?? '',
    grSentAt: (row.gr_sent_at as string) ?? '',
    status: (row.status as Company['status']) ?? 'lead',
    assignedTo: (row.assigned_to as string) ?? '',
    formToken: (row.form_token as string) ?? undefined,
    history, reminders, policies,
  };
}

const COMPANY_COLUMNS: Partial<Record<keyof Company, string>> = {
  company: 'company', contact: 'contact', title: 'title', phone: 'phone', email: 'email',
  city: 'city', state: 'state', industry: 'industry', revenue: 'revenue', employees: 'employees',
  url: 'url', nip: 'nip', notes: 'notes', ubezpieczenie: 'ubezpieczenie', przychod: 'przychod',
  tag: 'tag', zainteresowania: 'zainteresowania', leadSource: 'lead_source', status: 'status',
  assignedTo: 'assigned_to',
};

function companyToDb(data: Partial<Company>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(COMPANY_COLUMNS)) {
    const value = data[key as keyof Company];
    if (value !== undefined) row[column] = value;
  }
  return row;
}

function dbRowToPolicy(row: Record<string,unknown>): Policy {
  return {
    id: row.id as string,
    companyId: row.company_id as number,
    nrPolisy: (row.nr_polisy as string) ?? '',
    rodzaj: (row.rodzaj as string) ?? '',
    sumaUbezpieczenia: (row.suma_ubezpieczenia as string) ?? '',
    skladka: row.skladka != null ? Number(row.skladka) : null,
    skladkaOkres: ((row.skladka_okres as string) ?? 'jednorazowa') as Policy['skladkaOkres'],
    dataOd: (row.data_od as string) ?? '',
    dataDo: (row.data_do as string) ?? '',
    przypomnienie: (row.przypomnienie as string) ?? '',
    ochronaPrawna: (row.ochrona_prawna as boolean) ?? false,
    status: ((row.status as string) ?? 'aktywna') as Policy['status'],
    notes: (row.notes as string) ?? '',
    createdAt: (row.created_at as string) ?? '',
    createdBy: (row.created_by as string) ?? '',
  };
}

interface CRMState {
  companies: Company[];
  users: CRMUser[];
  stages: PipelineStage[];
  currentUser: CRMUser | null;
  loading: boolean;
  loadError: string | null;
  mienieWnioski: MienieWniosek[];
  mienieLokalizacje: MienieLokalizacja[];
  mienieLoading: boolean;
  loadData: () => Promise<void>;
  reset: () => void;
  loadMienieWnioski: () => Promise<void>;
  generateFormToken: (companyId: number) => Promise<string>;
  resetFormToken: (companyId: number) => Promise<string>;
  addCompany: (data: Partial<Company>) => Promise<void>;
  deleteCompany: (id: number) => Promise<void>;
  updateCompanyStatus: (id: number, status: Company['status']) => void;
  updateCompany: (id: number, data: Partial<Company>) => Promise<void>;
  addHistory: (companyId: number, entry: ContactHistory) => void;
  addReminder: (companyId: number, reminder: Reminder) => void;
  toggleReminder: (companyId: number, reminderId: string) => void;
  deleteReminder: (companyId: number, reminderId: string) => void;
  addPolicy: (companyId: number, policy: Omit<Policy,'id'|'companyId'|'createdAt'|'createdBy'>) => Promise<void>;
  updatePolicy: (policyId: string, data: Partial<Policy>) => Promise<void>;
  deletePolicy: (policyId: string, companyId: number) => Promise<void>;
  addUser: (data: Partial<CRMUser>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  updateUser: (id: string, data: Partial<CRMUser>) => Promise<void>;
  updateStages: (stages: PipelineStage[]) => Promise<void>;
  sendToGR: (companyId: number) => Promise<void>;
  importCompanies: (rows: Partial<Company>[]) => Promise<{ imported: number; merged: number; errors: number }>;
}

const INITIAL = {
  companies: [] as Company[], users: [] as CRMUser[], stages: DEFAULT_STAGES,
  currentUser: null as CRMUser | null, loading: true, loadError: null as string | null,
  mienieWnioski: [] as MienieWniosek[], mienieLokalizacje: [] as MienieLokalizacja[], mienieLoading: false,
};

export const useCRMStore = create<CRMState>()((set, get) => ({
  ...INITIAL,

  reset: () => set({ ...INITIAL }),

  loadData: async () => {
    set({ loading: true, loadError: null });
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user?.email) throw authError ?? new Error('Brak sesji');

      const [companiesData, historyData, remindersData, usersData, settingsData, policiesData] = await Promise.all([
        fetchAll((a, b) => supabase.from('crm_companies').select('*').order('company').order('id').range(a, b)),
        fetchAll((a, b) => supabase.from('crm_history').select('*').order('created_at', { ascending: false }).order('id').range(a, b)),
        fetchAll((a, b) => supabase.from('crm_reminders').select('*').order('date').order('id').range(a, b)),
        fetchAll((a, b) => supabase.from('crm_users').select('*').order('name').order('id').range(a, b)),
        fetchAll((a, b) => supabase.from('crm_settings').select('*').order('key').range(a, b)),
        fetchAll((a, b) => supabase.from('crm_policies').select('*').order('created_at', { ascending: false }).order('id').range(a, b)),
      ]);

      const users: CRMUser[] = usersData.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, color: u.color, active: u.active }));
      const email = user.email.toLowerCase();
      const currentUser = users.find(u => u.active && u.email.toLowerCase() === email) ?? null;
      const stages: PipelineStage[] = settingsData.find(s => s.key === 'pipeline_stages')?.value ?? DEFAULT_STAGES;

      const historyBy = groupBy(historyData, h => h.company_id);
      const remindersBy = groupBy(remindersData, r => r.company_id);
      const policiesBy = groupBy(policiesData, p => p.company_id);
      const companies = companiesData.map(row => dbRowToCompany(
        row,
        (historyBy.get(row.id) ?? []).map(h => ({ id: h.id, type: h.type, date: h.created_at, note: h.note, author: h.author })),
        (remindersBy.get(row.id) ?? []).map(r => ({ id: r.id, date: r.date, text: r.text, done: r.done })),
        (policiesBy.get(row.id) ?? []).map(p => dbRowToPolicy(p as Record<string,unknown>)),
      ));

      set({ companies, users, stages, currentUser, loading: false });
    } catch (e) {
      console.error('loadData', e);
      set({ loading: false, loadError: (e as Error).message ?? 'Nie udało się wczytać danych' });
    }
  },

  addCompany: async (data) => {
    const row = companyToDb({ industry: '', revenue: 0, status: 'lead', assignedTo: '', ...data, company: data.company ?? '' });
    const { data: inserted, error } = await supabase.from('crm_companies').insert(row).select().single();
    if (reportError('Dodawanie firmy', error) || !inserted) return;
    set(state => ({ companies: [...state.companies, dbRowToCompany(inserted)] }));
  },

  deleteCompany: async (id) => {
    const { data, error } = await supabase.from('crm_companies').delete().eq('id', id).select('id');
    if (reportError('Usuwanie firmy', error)) return;
    if (!data?.length) return denied('Usuwanie firmy');
    set(state => ({ companies: state.companies.filter(c => c.id !== id) }));
  },

  updateCompanyStatus: (id, status) => {
    set(state => ({ companies: state.companies.map(c => c.id === id ? { ...c, status } : c) }));
    supabase.from('crm_companies').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
      .then(({ error }) => reportError('Zmiana statusu', error));
  },

  updateCompany: async (id, data) => {
    const previous = get().companies.find(c => c.id === id);
    set(state => ({ companies: state.companies.map(c => c.id === id ? { ...c, ...data } : c) }));
    const row = companyToDb(data);
    if (Object.keys(row).length === 0) return;
    const { error } = await supabase.from('crm_companies').update({ ...row, updated_at: new Date().toISOString() }).eq('id', id);
    if (reportError('Zapis firmy', error) && previous) {
      set(state => ({ companies: state.companies.map(c => c.id === id ? previous : c) }));
    }
  },

  addHistory: (companyId, entry) => {
    set(state => ({ companies: state.companies.map(c => c.id === companyId ? { ...c, history: [entry, ...c.history] } : c) }));
    supabase.from('crm_history').insert({
      id: entry.id,
      company_id: companyId,
      type: entry.type,
      note: entry.note,
      author: entry.author,
      created_at: entry.date,
    }).then(({ error }) => reportError('Zapis historii', error));
  },

  addReminder: (companyId, reminder) => {
    set(state => ({ companies: state.companies.map(c => c.id === companyId ? { ...c, reminders: [...c.reminders, reminder] } : c) }));
    supabase.from('crm_reminders').insert({ id: reminder.id, company_id: companyId, text: reminder.text, date: reminder.date, done: false })
      .then(({ error }) => reportError('Zapis przypomnienia', error));
  },

  toggleReminder: (companyId, reminderId) => {
    const r = get().companies.find(c => c.id === companyId)?.reminders.find(r => r.id === reminderId);
    if (!r) return;
    const done = !r.done;
    set(state => ({ companies: state.companies.map(c => c.id === companyId ? { ...c, reminders: c.reminders.map(r => r.id === reminderId ? { ...r, done } : r) } : c) }));
    supabase.from('crm_reminders').update({ done }).eq('id', reminderId)
      .then(({ error }) => reportError('Zmiana przypomnienia', error));
  },

  deleteReminder: (companyId, reminderId) => {
    set(state => ({ companies: state.companies.map(c => c.id === companyId ? { ...c, reminders: c.reminders.filter(r => r.id !== reminderId) } : c) }));
    supabase.from('crm_reminders').delete().eq('id', reminderId)
      .then(({ error }) => reportError('Usuwanie przypomnienia', error));
  },

  addPolicy: async (companyId, policyData) => {
    const currentUser = get().currentUser;
    const przypomnienie = policyData.dataDo ? calcReminderDate(policyData.dataDo) : '';
    const { data: inserted, error } = await supabase.from('crm_policies').insert({
      company_id: companyId,
      nr_polisy: policyData.nrPolisy,
      rodzaj: policyData.rodzaj,
      suma_ubezpieczenia: policyData.sumaUbezpieczenia,
      skladka: policyData.skladka,
      skladka_okres: policyData.skladkaOkres,
      data_od: policyData.dataOd || null,
      data_do: policyData.dataDo || null,
      przypomnienie: przypomnienie || null,
      ochrona_prawna: policyData.ochronaPrawna ?? false,
      status: policyData.status,
      notes: policyData.notes,
      created_by: currentUser?.name ?? '',
    }).select().single();
    if (reportError('Dodawanie polisy', error) || !inserted) return;

    const policy = dbRowToPolicy(inserted as Record<string,unknown>);
    let reminder: Reminder | null = null;
    if (przypomnienie) {
      const reminderId = crypto.randomUUID();
      const reminderText = `🛡️ Odnowienie polisy ${policyData.nrPolisy ? `(${policyData.nrPolisy}) ` : ''}: ${policyData.rodzaj} — kończy się ${policyData.dataDo ? new Date(policyData.dataDo).toLocaleDateString('pl-PL') : '?'}`;
      const reminderDate = `${przypomnienie}T09:00:00`;
      const { error: remErr } = await supabase.from('crm_reminders').insert({ id: reminderId, company_id: companyId, text: reminderText, date: reminderDate, done: false });
      if (!reportError('Przypomnienie o odnowieniu', remErr)) reminder = { id: reminderId, date: reminderDate, text: reminderText, done: false };
    }
    set(state => ({ companies: state.companies.map(c => c.id === companyId
      ? { ...c, policies: [policy, ...c.policies], reminders: reminder ? [...c.reminders, reminder] : c.reminders, status: 'zamkniety' }
      : c) }));
    supabase.from('crm_companies').update({ status: 'zamkniety' }).eq('id', companyId)
      .then(({ error: stErr }) => reportError('Zmiana statusu', stErr));
  },

  updatePolicy: async (policyId, data) => {
    const dbData: Record<string,unknown> = {};
    if (data.nrPolisy !== undefined) dbData.nr_polisy = data.nrPolisy;
    if (data.rodzaj !== undefined) dbData.rodzaj = data.rodzaj;
    if (data.sumaUbezpieczenia !== undefined) dbData.suma_ubezpieczenia = data.sumaUbezpieczenia;
    if (data.skladka !== undefined) dbData.skladka = data.skladka;
    if (data.skladkaOkres !== undefined) dbData.skladka_okres = data.skladkaOkres;
    if (data.dataOd !== undefined) dbData.data_od = data.dataOd || null;
    if (data.dataDo !== undefined) { dbData.data_do = data.dataDo || null; dbData.przypomnienie = calcReminderDate(data.dataDo) || null; }
    if (data.ochronaPrawna !== undefined) dbData.ochrona_prawna = data.ochronaPrawna;
    if (data.status !== undefined) dbData.status = data.status;
    if (data.notes !== undefined) dbData.notes = data.notes;
    const { error } = await supabase.from('crm_policies').update(dbData).eq('id', policyId);
    if (reportError('Zapis polisy', error)) return;
    set(state => ({ companies: state.companies.map(c => ({ ...c, policies: c.policies.map(p => p.id === policyId ? { ...p, ...data, przypomnienie: data.dataDo ? calcReminderDate(data.dataDo) : p.przypomnienie } : p) })) }));
  },

  deletePolicy: async (policyId, companyId) => {
    const { data, error } = await supabase.from('crm_policies').delete().eq('id', policyId).select('id');
    if (reportError('Usuwanie polisy', error)) return;
    if (!data?.length) return denied('Usuwanie polisy');
    set(state => ({ companies: state.companies.map(c => c.id === companyId ? { ...c, policies: c.policies.filter(p => p.id !== policyId) } : c) }));
  },

  addUser: async (data) => {
    const { data: row, error } = await supabase.from('crm_users').insert({
      name: data.name?.trim() ?? '', email: data.email?.trim().toLowerCase() ?? '',
      role: data.role ?? 'user', color: data.color ?? '#6b7280',
    }).select().single();
    if (reportError('Dodawanie użytkownika', error) || !row) return;
    set(state => ({ users: [...state.users, row as CRMUser] }));
  },

  deleteUser: async (id) => {
    const { data, error } = await supabase.from('crm_users').delete().eq('id', id).select('id');
    if (reportError('Usuwanie użytkownika', error)) return;
    if (!data?.length) return denied('Usuwanie użytkownika');
    set(state => ({ users: state.users.filter(u => u.id !== id) }));
  },

  updateUser: async (id, data) => {
    const { data: rows, error } = await supabase.from('crm_users').update(data).eq('id', id).select('id');
    if (reportError('Zapis użytkownika', error)) return;
    if (!rows?.length) return denied('Zapis użytkownika');
    set(state => ({ users: state.users.map(u => u.id === id ? { ...u, ...data } : u) }));
  },

  updateStages: async (stages) => {
    const { data, error } = await supabase.from('crm_settings')
      .upsert({ key: 'pipeline_stages', value: stages as unknown as Record<string,unknown>, updated_at: new Date().toISOString() })
      .select('key');
    if (reportError('Zapis etapów', error)) return;
    if (!data?.length) return denied('Zapis etapów');
    set({ stages });
  },

  sendToGR: async (companyId) => {
    const { data, error } = await supabase.functions.invoke('lead-import', { body: { action: 'send_to_gr', company_id: companyId } });
    if (reportError('Wysyłka do GetResponse', error)) return;
    const grStatus = data?.gr_status ?? 'error';
    const grSentAt = data?.gr_sent_at ?? new Date().toISOString();
    if (grStatus !== 'ok') toast.error('GetResponse odrzucił kontakt');
    set(state => ({ companies: state.companies.map(c => c.id === companyId ? { ...c, grStatus, grSentAt } : c) }));
  },

  loadMienieWnioski: async () => {
    set({ mienieLoading: true });
    const [{ data, error }, { data: lokData }] = await Promise.all([
      supabase.from('mienie_wnioski').select('*').order('created_at', { ascending: false }),
      supabase.from('mienie_lokalizacje').select('*').order('nr'),
    ]);
    const lokalizacje: MienieLokalizacja[] = (lokData ?? []).map(r => ({
      id: r.id, wniosekId: r.wniosek_id, companyId: r.company_id, nr: r.nr,
      nazwa: r.nazwa ?? 'Lokalizacja 1', adres: r.adres ?? '',
      typLokalu: r.typ_lokalu ?? '', pietro: r.pietro ?? '',
      powierzchnia: r.powierzchnia ? Number(r.powierzchnia) : null,
      rokBudowy: r.rok_budowy ?? '', rokRemontu: r.rok_remontu ?? '',
      budynekWlasny: r.budynek_wlasny ?? false, materialScian: r.material_scian ?? '',
      pokrycieDachu: r.pokrycie_dachu ?? '', stanTechniczny: r.stan_techniczny ?? '',
      ogrzewanie: r.ogrzewanie ?? '', materialyPalne: r.materialy_palne ?? false,
      gasniceSzt: r.gasnice_szt ?? '', hydranty: r.hydranty ?? false,
      dataPrzegladuGasnic: r.data_przegladu_gasnic ?? '', sap: r.sap ?? false,
      tryskacze: r.tryskacze ?? false, drogiEwakuacyjne: r.drogi_ewakuacyjne ?? false,
      odlegloscPsp: r.odleglosc_psp ?? '', zakazPalenia: r.zakaz_palenia ?? false,
      alarmTyp: r.alarm_typ ?? '', ogrodzenie: r.ogrodzenie ?? false,
      agencjaOchrony: r.agencja_ochrony ?? '', agencja24h: r.agencja_24h ?? false,
      cctv: r.cctv ?? false, kraty: r.kraty ?? false, rolety: r.rolety ?? false,
      zamkiAtestowane: r.zamki_atestowane ?? false, drzwiAtestowane: r.drzwi_atestowane ?? false,
      szybyAntywlamaniowe: r.szyby_antywlamaniowe ?? false, sejfKlasa: r.sejf_klasa ?? '',
      systemAlarmowy: r.system_alarmowy ?? false,
      sumaBudynek: Number(r.suma_budynek ?? 0), sumaWyposazenie: Number(r.suma_wyposazenie ?? 0),
      sumaMaszyny: Number(r.suma_maszyny ?? 0), sumaSrodkiObrotowe: Number(r.suma_srodki_obrotowe ?? 0),
      sumaElektronikaIt: Number(r.suma_elektronika_it ?? 0), sumaSprzet: Number(r.suma_sprzet_medyczny ?? 0),
      sumaGotowkaLokal: Number(r.suma_gotowka_lokal ?? 0), sumaGotowkaTransport: Number(r.suma_gotowka_transport ?? 0),
      sumaSzyby: Number(r.suma_szyby ?? 0), sumaMieniePracownikow: Number(r.suma_mienie_pracownikow ?? 0),
      sumaLacznie: Number(r.suma_lacznie ?? 0),
      sprzet: toArray(r.sprzet_medyczny), elektronika: toArray(r.elektronika_eei),
      createdAt: r.created_at,
    }));
    if (!error && data) {
      const lokByWniosek = new Map<string, MienieLokalizacja[]>();
      lokalizacje.forEach(l => {
        if (!lokByWniosek.has(l.wniosekId)) lokByWniosek.set(l.wniosekId, []);
        lokByWniosek.get(l.wniosekId)!.push(l);
      });
      const wnioski: MienieWniosek[] = data.map(r => {
        const loks = lokByWniosek.get(r.id) ?? [];
        const sumaLacznie = loks.length > 0 ? loks.reduce((s, l) => s + l.sumaLacznie, 0) : Number(r.suma_lacznie ?? 0);
        return ({
        id: r.id, companyId: r.company_id, formToken: r.form_token,
        nazwaFirmy: r.nazwa_firmy ?? '', nip: r.nip ?? '', regon: r.regon ?? '', krs: r.krs ?? '',
        adresSiedziby: r.adres_siedziby ?? '', formaPrawna: r.forma_prawna ?? '', numerPkd: r.numer_pkd ?? '',
        emailKontaktowy: r.email_kontaktowy ?? '', telefon: r.telefon ?? '',
        osobaKontaktu: r.osoba_kontaktu ?? '', stanowisko: r.stanowisko ?? '',
        adresLokalizacji: r.adres_lokalizacji ?? '', typLokalu: r.typ_lokalu ?? '',
        pietro: r.pietro ?? '', powierzchnia: r.powierzchnia ? Number(r.powierzchnia) : null,
        rokBudowy: r.rok_budowy ?? '', rokRemontu: r.rok_remontu ?? '',
        budynekWlasny: r.budynek_wlasny ?? false, materialScian: r.material_scian ?? '',
        pokrycieDachu: r.pokrycie_dachu ?? '', stanTechniczny: r.stan_techniczny ?? '',
        ogrzewanie: r.ogrzewanie ?? '', materialyPalne: r.materialy_palne ?? false,
        rodzajDzialalnosci: r.rodzaj_dzialalnosci ?? '', liczbaPracownikow: r.liczba_pracownikow ?? '',
        rocznyObrot: r.roczny_obrot ?? '', zabiegi: toArray(r.zabiegi),
        gasniceSzt: r.gasnice_szt ?? '', hydranty: r.hydranty ?? false,
        dataPrzegladuGasnic: r.data_przegladu_gasnic ?? '', sap: r.sap ?? false,
        tryskacze: r.tryskacze ?? false, drogiEwakuacyjne: r.drogi_ewakuacyjne ?? false,
        odlegloscPsp: r.odleglosc_psp ?? '', zakazPalenia: r.zakaz_palenia ?? false,
        alarmTyp: r.alarm_typ ?? 'brak', ogrodzenie: r.ogrodzenie ?? false,
        agencjaOchrony: r.agencja_ochrony ?? '', agencja24h: r.agencja_24h ?? false,
        cctv: r.cctv ?? false, kraty: r.kraty ?? false, rolety: r.rolety ?? false,
        zamkiAtestowane: r.zamki_atestowane ?? false, drzwiAtestowane: r.drzwi_atestowane ?? false,
        szybyAntywlamaniowe: r.szyby_antywlamaniowe ?? false, sejfKlasa: r.sejf_klasa ?? 'brak',
        systemAlarmowy: r.system_alarmowy ?? false,
        zakres: toArray(r.zakres),
        sumaBudynek: Number(r.suma_budynek ?? 0), sumaWyposazenie: Number(r.suma_wyposazenie ?? 0),
        sumaMaszyny: Number(r.suma_maszyny ?? 0), sumaSrodkiObrotowe: Number(r.suma_srodki_obrotowe ?? 0),
        sumaElektronikaIt: Number(r.suma_elektronika_it ?? 0), sumaSprzet: Number(r.suma_sprzet_medyczny ?? 0),
        sumaGotowkaLokal: Number(r.suma_gotowka_lokal ?? 0), sumaGotowkaTransport: Number(r.suma_gotowka_transport ?? 0),
        sumaSzyby: Number(r.suma_szyby ?? 0), sumaMieniePracownikow: Number(r.suma_mienie_pracownikow ?? 0),
        sumaLacznie,
        brakSzkod: r.brak_szkod ?? true, szkody: toArray(r.szkody),
        posiadaPolise: r.posiada_polise ?? false, towarzystwoObecne: r.towarzystwo_obecne ?? '',
        nrPolisyObecny: r.nr_polisy_obecny ?? '', waznoscDo: r.waznosc_do ?? '',
        rocznaSlkadkaObecna: r.roczna_skladka_obecna ? Number(r.roczna_skladka_obecna) : null,
        uwagi: r.uwagi ?? '', zgodaPrawdziwosc: r.zgoda_prawdziwosc ?? false, zgodaRodo: r.zgoda_rodo ?? false,
        sprzet: loks[0]?.sprzet ?? toArray(r.sprzet_medyczny),
        elektronika: loks[0]?.elektronika ?? toArray(r.elektronika_eei),
        createdAt: r.created_at, updatedAt: r.updated_at,
      });
      });
      set({ mienieWnioski: wnioski, mienieLokalizacje: lokalizacje, mienieLoading: false });
    } else {
      reportError('Wczytywanie wniosków', error);
      set({ mienieLoading: false });
    }
  },

  generateFormToken: async (companyId) => {
    const { data, error } = await supabase.rpc('crm_issue_form_token', { p_company_id: companyId });
    if (reportError('Generowanie linku', error)) return '';
    const token: string = data?.[0]?.form_token ?? '';
    set(state => ({ companies: state.companies.map(c => c.id === companyId ? { ...c, formToken: token } : c) }));
    return token;
  },

  resetFormToken: async (companyId) => get().generateFormToken(companyId),

  importCompanies: async (rows) => {
    const existing = get().companies;
    let imported = 0, merged = 0, errors = 0;

    for (const row of rows) {
      if (!row.company) continue;
      const extra = row as Record<string, unknown>;
      const nip = String(extra.nip ?? '').trim();
      const existingByNip = nip ? existing.find(c => c.nip === nip) : null;

      if (existingByNip) {
        const newZaint = String(extra.ubezpieczenie ?? '');
        const currentZaint = existingByNip.zainteresowania ?? '';
        const mergedStr = currentZaint
          ? (!newZaint || currentZaint.includes(newZaint) ? currentZaint : `${currentZaint}, ${newZaint}`)
          : newZaint;
        const { error } = await supabase.from('crm_companies').update({ zainteresowania: mergedStr }).eq('id', existingByNip.id);
        if (error) { errors++; continue; }
        set(state => ({ companies: state.companies.map(c => c.id === existingByNip.id ? { ...c, zainteresowania: mergedStr } : c) }));
        merged++;
      } else {
        const newRow = {
          company: row.company ?? '', contact: row.contact ?? '', title: row.title ?? '',
          phone: row.phone ?? '', email: row.email ?? '', city: row.city ?? '',
          state: row.state ?? '', industry: row.industry ?? 'Beauty & Wellness',
          revenue: Number(row.revenue) || 0, employees: String(row.employees ?? ''),
          url: row.url ?? '', nip,
          ubezpieczenie: String(extra.ubezpieczenie ?? ''),
          przychod: String(extra.przychod ?? ''),
          zainteresowania: String(extra.ubezpieczenie ?? ''),
          status: 'lead' as const, assigned_to: '', tag: '',
        };
        const { data: inserted, error } = await supabase.from('crm_companies').insert(newRow).select().single();
        if (error || !inserted) { errors++; continue; }
        set(state => ({ companies: [...state.companies, dbRowToCompany(inserted)] }));
        imported++;
      }
    }
    if (errors) toast.error(`Import: ${errors} wierszy nie zapisano`);
    return { imported, merged, errors };
  },
}));
