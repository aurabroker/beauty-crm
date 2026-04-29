import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { Company, ContactHistory, Reminder, CRMUser, PipelineStage, Policy } from '../data/companies';
import { DEFAULT_STAGES } from '../data/companies';

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
    history, reminders, policies,
  };
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
  loadData: () => Promise<void>;
  setCurrentUser: (user: CRMUser) => void;
  addCompany: (data: Partial<Company>) => Promise<void>;
  deleteCompany: (id: number) => Promise<void>;
  updateCompanyStatus: (id: number, status: Company['status']) => void;
  updateCompany: (id: number, data: Partial<Company>) => void;
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

export const useCRMStore = create<CRMState>()((set, get) => ({
  companies: [], users: [], stages: DEFAULT_STAGES,
  currentUser: null, loading: true,

  setCurrentUser: (user) => { localStorage.setItem('crm-user-id', user.id); set({ currentUser: user }); },

  loadData: async () => {
    set({ loading: true });
    const [{ data: companiesData }, { data: historyData }, { data: remindersData }, { data: usersData }, { data: settingsData }, { data: policiesData }] = await Promise.all([
      supabase.from('crm_companies').select('*').order('company'),
      supabase.from('crm_history').select('*').order('created_at', { ascending: false }),
      supabase.from('crm_reminders').select('*').order('date'),
      supabase.from('crm_users').select('*').order('name'),
      supabase.from('crm_settings').select('*'),
      supabase.from('crm_policies').select('*').order('created_at', { ascending: false }),
    ]);
    const users: CRMUser[] = (usersData ?? []).map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, color: u.color, active: u.active }));
    const stages: PipelineStage[] = settingsData?.find(s => s.key === 'pipeline_stages')?.value ?? DEFAULT_STAGES;
    const companies = (companiesData ?? []).map(row => {
      const history = (historyData ?? []).filter(h => h.company_id === row.id).map(h => ({ id: h.id, type: h.type, date: h.created_at, note: h.note, author: h.author }));
      const reminders = (remindersData ?? []).filter(r => r.company_id === row.id).map(r => ({ id: r.id, date: r.date, text: r.text, done: r.done }));
      const policies = (policiesData ?? []).filter(p => p.company_id === row.id).map(p => dbRowToPolicy(p as Record<string,unknown>));
      return dbRowToCompany(row, history, reminders, policies);
    });
    const savedUserId = localStorage.getItem('crm-user-id');
    const currentUser = users.find(u => u.id === savedUserId) ?? users.find(u => u.role === 'admin') ?? users[0] ?? null;
    set({ companies, users, stages, currentUser, loading: false });
  },

  addCompany: async (data) => {
    const maxId = Math.max(0, ...get().companies.map(c => c.id));
    const newId = maxId + 1;
    const row = { id: newId, company: data.company ?? '', contact: data.contact ?? '', title: data.title ?? '',
      phone: data.phone ?? '', email: data.email ?? '', city: data.city ?? '', state: data.state ?? '',
      industry: data.industry ?? '', revenue: data.revenue ?? 0, employees: data.employees ?? '',
      url: data.url ?? '', nip: data.nip ?? '', status: data.status ?? 'lead', assigned_to: data.assignedTo ?? '',
      tag: data.tag ?? '', zainteresowania: data.zainteresowania ?? '' };
    const { error } = await supabase.from('crm_companies').insert(row);
    if (!error) set(state => ({ companies: [...state.companies, dbRowToCompany(row)] }));
  },

  deleteCompany: async (id) => {
    await supabase.from('crm_companies').delete().eq('id', id);
    set(state => ({ companies: state.companies.filter(c => c.id !== id) }));
  },

  updateCompanyStatus: (id, status) => {
    set(state => ({ companies: state.companies.map(c => c.id === id ? { ...c, status } : c) }));
    supabase.from('crm_companies').update({ status, updated_at: new Date().toISOString() }).eq('id', id).then();
  },

  updateCompany: (id, data) => {
    set(state => ({ companies: state.companies.map(c => c.id === id ? { ...c, ...data } : c) }));
    // Persist tag and zainteresowania changes
    const dbFields: Record<string,unknown> = {};
    if (data.tag !== undefined) dbFields.tag = data.tag;
    if (data.zainteresowania !== undefined) dbFields.zainteresowania = data.zainteresowania;
    if (data.leadSource !== undefined) dbFields.lead_source = data.leadSource;
    if (data.status !== undefined) dbFields.status = data.status;
    if (Object.keys(dbFields).length > 0) {
      supabase.from('crm_companies').update(dbFields).eq('id', id).then();
    }
  },

  addHistory: (companyId, entry) => {
    set(state => ({ companies: state.companies.map(c => c.id === companyId ? { ...c, history: [entry, ...c.history] } : c) }));
    supabase.from('crm_history').insert({ id: entry.id, company_id: companyId, type: entry.type, note: entry.note, author: entry.author }).then();
  },

  addReminder: (companyId, reminder) => {
    set(state => ({ companies: state.companies.map(c => c.id === companyId ? { ...c, reminders: [...c.reminders, reminder] } : c) }));
    supabase.from('crm_reminders').insert({ id: reminder.id, company_id: companyId, text: reminder.text, date: reminder.date, done: false }).then();
  },

  toggleReminder: (companyId, reminderId) => {
    const r = get().companies.find(c => c.id === companyId)?.reminders.find(r => r.id === reminderId);
    if (!r) return;
    const done = !r.done;
    set(state => ({ companies: state.companies.map(c => c.id === companyId ? { ...c, reminders: c.reminders.map(r => r.id === reminderId ? { ...r, done } : r) } : c) }));
    supabase.from('crm_reminders').update({ done }).eq('id', reminderId).then();
  },

  deleteReminder: (companyId, reminderId) => {
    set(state => ({ companies: state.companies.map(c => c.id === companyId ? { ...c, reminders: c.reminders.filter(r => r.id !== reminderId) } : c) }));
    supabase.from('crm_reminders').delete().eq('id', reminderId).then();
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

    if (!error && inserted) {
      const policy = dbRowToPolicy(inserted as Record<string,unknown>);
      if (przypomnienie) {
        const reminderId = crypto.randomUUID();
        const reminderText = `🛡️ Odnowienie polisy ${policyData.nrPolisy ? `(${policyData.nrPolisy}) ` : ''}: ${policyData.rodzaj} — kończy się ${policyData.dataDo ? new Date(policyData.dataDo).toLocaleDateString('pl-PL') : '?'}`;
        const reminderDate = `${przypomnienie}T09:00:00`;
        await supabase.from('crm_reminders').insert({ id: reminderId, company_id: companyId, text: reminderText, date: reminderDate, done: false });
        const reminder: Reminder = { id: reminderId, date: reminderDate, text: reminderText, done: false };
        set(state => ({ companies: state.companies.map(c => c.id === companyId ? { ...c, policies: [policy, ...c.policies], reminders: [...c.reminders, reminder], status: 'zamkniety' } : c) }));
      } else {
        set(state => ({ companies: state.companies.map(c => c.id === companyId ? { ...c, policies: [policy, ...c.policies], status: 'zamkniety' } : c) }));
      }
      supabase.from('crm_companies').update({ status: 'zamkniety' }).eq('id', companyId).then();
    }
  },

  updatePolicy: async (policyId, data) => {
    const dbData: Record<string,unknown> = {};
    if (data.nrPolisy !== undefined) dbData.nr_polisy = data.nrPolisy;
    if (data.rodzaj !== undefined) dbData.rodzaj = data.rodzaj;
    if (data.sumaUbezpieczenia !== undefined) dbData.suma_ubezpieczenia = data.sumaUbezpieczenia;
    if (data.skladka !== undefined) dbData.skladka = data.skladka;
    if (data.skladkaOkres !== undefined) dbData.skladka_okres = data.skladkaOkres;
    if (data.dataOd !== undefined) dbData.data_od = data.dataOd;
    if (data.dataDo !== undefined) { dbData.data_do = data.dataDo; dbData.przypomnienie = calcReminderDate(data.dataDo); }
    if (data.ochronaPrawna !== undefined) dbData.ochrona_prawna = data.ochronaPrawna;
    if (data.status !== undefined) dbData.status = data.status;
    if (data.notes !== undefined) dbData.notes = data.notes;
    await supabase.from('crm_policies').update(dbData).eq('id', policyId);
    set(state => ({ companies: state.companies.map(c => ({ ...c, policies: c.policies.map(p => p.id === policyId ? { ...p, ...data, przypomnienie: data.dataDo ? calcReminderDate(data.dataDo) : p.przypomnienie } : p) })) }));
  },

  deletePolicy: async (policyId, companyId) => {
    await supabase.from('crm_policies').delete().eq('id', policyId);
    set(state => ({ companies: state.companies.map(c => c.id === companyId ? { ...c, policies: c.policies.filter(p => p.id !== policyId) } : c) }));
  },

  addUser: async (data) => {
    const { data: row, error } = await supabase.from('crm_users').insert({ name: data.name ?? '', email: data.email ?? '', role: data.role ?? 'user', color: data.color ?? '#6b7280' }).select().single();
    if (!error && row) set(state => ({ users: [...state.users, row as CRMUser] }));
  },

  deleteUser: async (id) => {
    await supabase.from('crm_users').delete().eq('id', id);
    set(state => ({ users: state.users.filter(u => u.id !== id) }));
  },

  updateUser: async (id, data) => {
    await supabase.from('crm_users').update(data).eq('id', id);
    set(state => ({ users: state.users.map(u => u.id === id ? { ...u, ...data } : u) }));
  },

  updateStages: async (stages) => {
    set({ stages });
    await supabase.from('crm_settings').upsert({ key: 'pipeline_stages', value: stages as unknown as Record<string,unknown>, updated_at: new Date().toISOString() });
  },

  sendToGR: async (companyId) => {
    const co = get().companies.find(c => c.id === companyId);
    if (!co) return;
    const res = await fetch('https://dhuvykwecsxgchzxufxw.supabase.co/functions/v1/lead-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': 'beauty2026secret' },
      body: JSON.stringify({ company: co.company, contact: co.contact, email: co.email, phone: co.phone, nip: co.nip, ubezpieczenie: co.ubezpieczenie, przychod: co.przychod, tag: co.tag ?? '', lead_source: co.leadSource ?? '', send_to_gr: true }),
    }).catch(() => null);
    const ok = res?.ok ?? false;
    const now = new Date().toISOString();
    const status = ok ? 'ok' : 'error';
    await supabase.from('crm_companies').update({ gr_status: status, gr_sent_at: now }).eq('id', companyId);
    set(state => ({ companies: state.companies.map(c => c.id === companyId ? { ...c, grStatus: status, grSentAt: now } : c) }));
  },

  importCompanies: async (rows) => {
    const existing = get().companies;
    const maxId = Math.max(0, ...existing.map(c => c.id));
    let imported = 0, merged = 0, errors = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.company) continue;
      const nip = ((row as Record<string,unknown>).nip as string ?? '').trim();

      // Check for NIP duplicate
      const existingByNip = nip ? existing.find(c => c.nip === nip) : null;

      if (existingByNip) {
        // Merge: append zainteresowania
        const newZaint = (row as Record<string,unknown>).ubezpieczenie as string ?? '';
        const currentZaint = existingByNip.zainteresowania ?? '';
        const merged_str = currentZaint
          ? (currentZaint.includes(newZaint) ? currentZaint : `${currentZaint}, ${newZaint}`)
          : newZaint;
        await supabase.from('crm_companies').update({ zainteresowania: merged_str }).eq('id', existingByNip.id);
        set(state => ({ companies: state.companies.map(c => c.id === existingByNip.id ? { ...c, zainteresowania: merged_str } : c) }));
        merged++;
      } else {
        const newRow = {
          id: maxId + imported + 1,
          company: row.company ?? '', contact: row.contact ?? '', title: row.title ?? '',
          phone: row.phone ?? '', email: row.email ?? '', city: row.city ?? '',
          state: row.state ?? '', industry: row.industry ?? 'Beauty & Wellness',
          revenue: Number(row.revenue) || 0, employees: String(row.employees ?? ''),
          url: row.url ?? '', nip: nip,
          ubezpieczenie: (row as Record<string,unknown>).ubezpieczenie as string ?? '',
          przychod: (row as Record<string,unknown>).przychod as string ?? '',
          zainteresowania: (row as Record<string,unknown>).ubezpieczenie as string ?? '',
          status: 'lead' as const, assigned_to: '', tag: '',
        };
        const { error } = await supabase.from('crm_companies').insert(newRow);
        if (!error) {
          set(state => ({ companies: [...state.companies, dbRowToCompany(newRow)] }));
          imported++;
        } else { errors++; }
      }
    }
    return { imported, merged, errors };
  },
}));
