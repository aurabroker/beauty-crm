# AuraBeauty CRM

System CRM dla branży beauty — zarządzanie firmami, pipeline sprzedażowy, polisy ubezpieczeniowe i kalendarze przypomnień.

## Stack

- **Frontend:** React 19 + TypeScript + Vite
- **UI:** Radix UI + Tailwind CSS
- **Stan:** Zustand
- **Backend / baza:** Supabase (PostgreSQL)
- **Hosting:** Cloudflare Pages

## Funkcje

- **Dashboard** — lista firm z filtrowaniem, sortowaniem i wyszukiwaniem
- **Pipeline** — kanban ze statusami: Lead → Kontakt → Oferta → Negocjacje → Klient / Rezygnacja
- **Klienci** — widok aktywnych klientów z polisami
- **Polisy** — zarządzanie ubezpieczeniami przypisanymi do firm (OC, utrata dochodu, ochrona prawna, pakiety zdrowotne)
- **Kalendarz** — przypomnienia z widokiem tygodniowym/miesięcznym
- **Raporty** — statystyki sprzedaży, konwersji i aktywności
- **Admin** — zarządzanie użytkownikami i etapami pipeline
- **Publiczny formularz leadów** — dostępny pod `/formularz` bez logowania
- **Import z Google Sheets** — masowy import firm

## Uruchomienie lokalne

```bash
pnpm install
pnpm dev
```

## Zmienne środowiskowe

Klient Supabase jest skonfigurowany bezpośrednio w `src/lib/supabase.ts`. W razie potrzeby podmień URL i klucz `anon` na własny projekt.

## Baza danych

Tabele Supabase:

| Tabela | Opis |
|--------|------|
| `crm_companies` | Firmy / kontakty |
| `crm_history` | Historia kontaktów (notatki, telefony, emaile, spotkania) |
| `crm_reminders` | Przypomnienia |
| `crm_policies` | Polisy ubezpieczeniowe |
| `crm_users` | Użytkownicy CRM |
| `crm_settings` | Ustawienia (m.in. konfiguracja etapów pipeline) |

## Deployment

```bash
pnpm build
# Cloudflare Pages — konfiguracja w wrangler.toml
```
