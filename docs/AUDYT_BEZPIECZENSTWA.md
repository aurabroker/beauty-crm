# Audyt AuraBeauty CRM — 29.09.2026

Zakres: kod repozytorium, baza Supabase `BEAUTY` (dhuvykwecsxgchzxufxw), Edge Functions,
konfiguracja hostingu. Priorytet: baza danych i logowanie.

## 1. Stan przed audytem — krytyczne podatności

| # | Problem | Skutek |
|---|---------|--------|
| K1 | Polityka `crm_companies_select_anon` (`anon`, `USING true`) | **Każdy** z publicznym kluczem anon (jest w kodzie strony) mógł pobrać całą bazę 1364 firm: kontakty, e-maile, telefony, NIP-y, notatki i tokeny formularzy. |
| K2 | Polityki `auth_all_*` = `true` dla roli `authenticated` na wszystkich tabelach `crm_*` | Baza jest współdzielona z innymi aplikacjami (katalog salonów, Velora, panel mienie). Każde konto zalogowane w **dowolnej** z nich miało pełny odczyt/zapis/usuwanie CRM, łącznie z nadaniem sobie roli admin w `crm_users`. |
| K3 | Rola użytkownika ustalana w przeglądarce (`localStorage` + przełącznik „Przełącz konto”) | Każdy zalogowany mógł „zostać” adminem jednym kliknięciem. Panel admina chroniony tylko w UI. |
| K4 | Stały klucz `beauty2026secret` do Edge Function `lead-import` w kodzie frontendu | Anonimowe wstrzykiwanie dowolnych firm do CRM kluczem service_role, spam do GetResponse, modyfikacja istniejących firm po NIP. |
| K5 | `mienie-form` przyjmowała dowolne kolumny (`...payload`) | Posiadacz linku mógł nadpisać status wniosku, przypisanego agenta, ofertę, numer polisy, `company_id`. |
| K6 | Granty tabelowe dla `anon` (SELECT/INSERT/UPDATE/DELETE/TRUNCATE) na wszystkich tabelach CRM | Jedyną zaporą była RLS — brak obrony warstwowej. |
| K7 | Import z Google Sheets przez publiczne proxy `corsproxy.io` | Dane osobowe leadów przechodziły przez obcy serwer (RODO). |

## 2. Co zostało naprawione (wdrożone na produkcji)

### Baza danych — migracja `20260929200000_crm_security_lockdown`
- Usunięty odczyt anonimowy (K1) i wszystkie polityki `true` (K2).
- Nowe funkcje `crm_current_role()`, `is_crm_user()`, `is_crm_admin()` — dostęp ma **tylko aktywny
  użytkownik z `crm_users`**, dopasowany po potwierdzonym e-mailu konta Supabase (bez kont zbanowanych/usuniętych).
- Model uprawnień:
  - użytkownik CRM: odczyt i edycja firm, polis, historii, przypomnień;
  - **tylko admin**: usuwanie firm i polis, edycja/usuwanie historii, zarządzanie użytkownikami i ustawieniami.
- Granty: `anon` nie ma żadnych praw do tabel CRM poza `INSERT` wybranych kolumn `crm_lead_intake`
  (formularz publiczny: tylko nowe, niezrealizowane zgłoszenia z zgodą RODO, limity długości pól).
  `authenticated` nie ma `TRUNCATE`/`TRIGGER`/`REFERENCES`.
- Blokada utraty ostatniego administratora (trigger).
- **Dziennik audytowy `crm_audit_log`** (append-only, odczyt tylko admin): każda zmiana firm, polis,
  użytkowników, ustawień oraz edycja/usunięcie historii — kto, kiedy, stan przed i po.
- Naprawiona sekwencja ID firm (była 214 pozycji za `max(id)`; klient liczył ID jako max+1 → kolizje).

Zweryfikowane testami na produkcji (w transakcji wycofanej): anon → brak dostępu; konto spoza CRM →
0 wierszy, brak zapisu; admin → pełne dane; formularz publiczny działa; audyt i blokada admina działają.

### Formularz mienie — migracja `20260929203000_mienie_form_rpc`
- `mienie_form_load` / `mienie_form_save` (tylko `service_role`): walidacja tokenu i terminu ważności,
  **whitelista pól klienta**, `company_id`/`form_token` wymuszane z bazy, blokada edycji gdy wniosek jest
  już w obsłudze agenta, zapis wniosku z lokalizacjami **atomowo** (wcześniej: usunięcie lokalizacji,
  potem wstawianie — błąd w połowie = utrata danych).
- `crm_issue_form_token()` — link generowany po stronie bazy: 256-bitowy losowy token, ważny 30 dni.
  Istniejące linki bez terminu dostały 30 dni.

### Edge Functions
- `lead-import` v12: trzy tryby autoryzacji — sesja użytkownika CRM (JWT), jednorazowe `intake_id`
  z formularza publicznego (dane czytane z bazy, nie z żądania, ważne 30 min), klucz integracji z sekretu
  `LEAD_IMPORT_API_KEY`. Limity rozmiaru, czyszczenie pól, bez liczenia ID po stronie klienta, akcja
  `send_to_gr` (wcześniej „Wyślij do GR” tworzyło duplikat firmy bez NIP).
- `mienie-form` v8: cienka warstwa nad funkcjami SQL, bez przepuszczania dowolnych kolumn.

### Frontend
- Tożsamość i rola **wyłącznie z sesji** — usunięty przełącznik kont i `localStorage`. Konto spoza CRM
  widzi ekran „Brak dostępu”.
- Automatyczne wylogowanie po 60 min bezczynności; czyszczenie danych po wylogowaniu.
- Usunięty stały klucz API z kodu; wywołania przez `supabase.functions.invoke` (JWT sesji).
- Formularz leadów: jednorazowe `intake_id`, honeypot antybotowy, limity długości.
- Nagłówki bezpieczeństwa Cloudflare Pages (`public/_headers`): CSP, `frame-ancestors 'none'`,
  HSTS, `nosniff`, `Referrer-Policy: no-referrer`. Sprawdzone w Chromium — 0 naruszeń CSP.
- Usunięte proxy `corsproxy.io` (K7).

### Błędy danych znalezione przy okazji (naprawione)
- **Brak części danych w CRM**: PostgREST zwraca max 1000 wierszy — CRM nie widział 364 firm i ~1300
  wpisów historii. Dodane stronicowanie.
- **Edycja danych firmy nie zapisywała się** (nazwa, kontakt, telefon, e-mail, NIP, miasto, notatki) —
  znikała po odświeżeniu.
- **Formularz mienie: przesunięte kolumny sprzętu** — przy każdym zapisie „nazwa” dostawała producenta,
  „producent” model itd.
- **Formularz mienie: 5 z 10 sum ubezpieczenia ładowało się puste** przy ponownej edycji i było
  nadpisywane zerami.
- Formularz mienie z CRM nie działał od 22.09 (zablokowany dostęp anon do tabel) — przywrócony przez funkcję.
- Link demo otwierał się ze starym (unieważnionym) tokenem.
- Błędy zapisu były ignorowane po cichu — teraz komunikat + wycofanie zmiany.

## 3. Do zrobienia przez właściciela (wymaga dostępu do paneli)

1. **Wdrożyć frontend** (Cloudflare Pages, projekt `crm-polska`) z tej gałęzi. Do tego czasu stara wersja
   działa (baza ją obsługuje), poza generowaniem linków mienie.
2. **Rotacja klucza `lead-import`** — stary klucz jest publiczny i nadal działa (tryb przejściowy dla
   Google Apps Script):
   1. wygeneruj długi losowy klucz (np. `openssl rand -hex 32`);
   2. Supabase → Edge Functions → Secrets: `LEAD_IMPORT_API_KEY=<klucz>`;
   3. w Google Apps Script podmień nagłówek `x-api-key` na nowy klucz.
   Po kroku 2 stary klucz przestaje działać automatycznie.
   Po wdrożeniu sprawdź w logach, że wywołania Apps Script dostają 200 z wersji 12.
3. Supabase → Authentication:
   - włącz **Leaked password protection** (HaveIBeenPwned);
   - włącz **MFA (TOTP)** i wymagaj go dla administratorów;
   - minimalna długość hasła ≥ 12.
4. Usuń z historii git / zmień wszędzie, gdzie jeszcze występuje, klucz `beauty2026secret` (po rotacji).

## 4. Pozostałe ryzyka (poza zakresem tej zmiany)

**Inne aplikacje w tej samej bazie** (katalog, salony, Velora) — do przeglądu przez ich właściciela:
- 3 widoki `SECURITY DEFINER` (`public_catalog_*`, `public_salon_reviews`) — omijają RLS;
- 17 funkcji `SECURITY DEFINER` wykonywalnych przez `anon` (część to funkcje triggerów — należy odebrać `EXECUTE`);
- widok zmaterializowany `salon_search_index` dostępny przez API;
- funkcje bez ustalonego `search_path`; rozszerzenia w schemacie `public`.
- Zalecenie długoterminowe: osobny projekt Supabase dla CRM (izolacja danych ubezpieczeniowych od
  aplikacji z publiczną rejestracją).

**CRM:**
- Formularz mienie ładuje Tailwind z `cdn.tailwindcss.com` (skrypt zewnętrzny na stronie z danymi
  klienta) — zastąpić skompilowanym CSS.
- Brak izolacji danych między agentami (wszyscy użytkownicy CRM widzą wszystkie firmy). Filtr
  „przypisane do mnie” jest tylko w UI. Przy większym zespole: RLS po `assigned_to` (wymaga
  przejścia z imienia na `user_id`).
- Wydajność: cały CRM ładowany do pamięci przy starcie (1364 firmy + 2300 wpisów historii), bundle 673 kB.
  Kierunek: TanStack Query + stronicowanie po stronie serwera + code-splitting.
- Jakość: 82 błędy ESLint (istniejące wcześniej), brak testów. Priorytet: testy e2e ścieżek
  logowania, polis i formularzy.
- Import CSV zapisuje wiersz po wierszu (wolno przy dużych plikach).

## 5. Pliki

- `supabase/migrations/20260929200000_crm_security_lockdown.sql`
- `supabase/migrations/20260929203000_mienie_form_rpc.sql`
- `supabase/functions/lead-import/index.ts`, `supabase/functions/mienie-form/index.ts`
- `public/_headers`
