export function PrivacyPolicy({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 flex-shrink-0">
          <h2 className="text-base font-bold text-zinc-900">Polityka Prywatności</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 text-xl">✕</button>
        </div>
        <div className="overflow-y-auto px-6 py-5 text-sm text-zinc-700 space-y-4 leading-relaxed">

          <p className="text-xs text-zinc-400">Ostatnia aktualizacja: {new Date().toLocaleDateString('pl-PL', {day:'2-digit', month:'long', year:'numeric'})}</p>

          <section>
            <h3 className="font-bold text-zinc-900 mb-2">1. Administrator danych</h3>
            <p>Administratorem Twoich danych osobowych jest <strong>Aura Consulting</strong>, świadcząca usługi pośrednictwa ubezpieczeniowego. Dane przetwarzane są zgodnie z Rozporządzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 (RODO).</p>
          </section>

          <section>
            <h3 className="font-bold text-zinc-900 mb-2">2. Cel i podstawa przetwarzania</h3>
            <p>Twoje dane osobowe przetwarzamy w celu:</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-zinc-600">
              <li>Przedstawienia oferty ubezpieczeniowej dopasowanej do Twojego salonu beauty</li>
              <li>Kontaktu telefonicznego lub mailowego w celu omówienia oferty</li>
              <li>Wykonania umowy ubezpieczeniowej (jeśli zostanie zawarta)</li>
              <li>Wypełnienia obowiązków prawnych wynikających z ustawy o dystrybucji ubezpieczeń</li>
            </ul>
            <p className="mt-2">Podstawą przetwarzania jest Twoja <strong>dobrowolna zgoda</strong> (art. 6 ust. 1 lit. a RODO) wyrażona poprzez zaznaczenie odpowiedniego pola w formularzu.</p>
          </section>

          <section>
            <h3 className="font-bold text-zinc-900 mb-2">3. Zakres przetwarzanych danych</h3>
            <p>Przetwarzamy wyłącznie dane podane przez Ciebie w formularzu:</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-zinc-600">
              <li>Imię i nazwisko</li>
              <li>Numer telefonu</li>
              <li>Adres e-mail</li>
              <li>Nazwa firmy / salonu</li>
              <li>NIP firmy</li>
              <li>Informacje o poszukiwanym ubezpieczeniu i przychodach</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-zinc-900 mb-2">4. Odbiorcy danych</h3>
            <p>Twoje dane mogą być przekazywane:</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-zinc-600">
              <li>Towarzystwom ubezpieczeniowym — wyłącznie w celu przygotowania oferty</li>
              <li>Dostawcom systemów IT obsługujących naszą działalność (przetwarzanie w imieniu administratora na podstawie umowy powierzenia)</li>
              <li>Organom nadzoru ubezpieczeniowego (KNF) — jeśli wymagają tego przepisy prawa</li>
            </ul>
            <p className="mt-2">Nie sprzedajemy Twoich danych osobom trzecim.</p>
          </section>

          <section>
            <h3 className="font-bold text-zinc-900 mb-2">5. Okres przechowywania</h3>
            <p>Dane przechowujemy przez okres niezbędny do realizacji celu, w jakim zostały zebrane — nie dłużej niż <strong>5 lat</strong> od ostatniego kontaktu lub zawarcia umowy. Po tym czasie dane są trwale usuwane.</p>
          </section>

          <section>
            <h3 className="font-bold text-zinc-900 mb-2">6. Twoje prawa</h3>
            <p>W związku z przetwarzaniem Twoich danych masz prawo do:</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-zinc-600">
              <li><strong>Dostępu</strong> do swoich danych</li>
              <li><strong>Sprostowania</strong> nieprawidłowych danych</li>
              <li><strong>Usunięcia</strong> danych („prawo do bycia zapomnianym")</li>
              <li><strong>Ograniczenia</strong> przetwarzania</li>
              <li><strong>Przenoszenia</strong> danych</li>
              <li><strong>Cofnięcia zgody</strong> w dowolnym momencie (bez wpływu na zgodność z prawem przetwarzania przed cofnięciem)</li>
              <li><strong>Wniesienia skargi</strong> do Prezesa Urzędu Ochrony Danych Osobowych (PUODO), ul. Stawki 2, 00-193 Warszawa</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-zinc-900 mb-2">7. Kontakt</h3>
            <p>W sprawach dotyczących ochrony danych osobowych skontaktuj się z nami:</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-zinc-600">
              <li>E-mail: <a href="mailto:rodo@auraconsulting.pl" className="text-pink-600 hover:underline">rodo@auraconsulting.pl</a></li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-zinc-900 mb-2">8. Cookies i dane techniczne</h3>
            <p>Formularz nie stosuje plików cookies ani nie zbiera danych technicznych (adres IP, dane przeglądarki). Jedyne dane przetwarzane to te wpisane przez Ciebie dobrowolnie.</p>
          </section>

        </div>
        <div className="px-6 py-4 border-t border-zinc-100 flex-shrink-0">
          <button onClick={onClose} className="w-full py-2.5 bg-pink-600 text-white text-sm font-semibold hover:bg-pink-500 transition-colors">
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
}
