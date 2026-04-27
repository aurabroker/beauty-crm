import { useState } from 'react';
import { supabase } from '../lib/supabase';

export function LoginPage({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError('Nieprawidłowy email lub hasło'); setLoading(false); }
    else onLogin();
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-10 h-10 bg-pink-500 flex items-center justify-center">
              <span className="text-white font-black text-lg">B</span>
            </div>
            <div>
              <div className="text-white font-black text-xl tracking-tight">BeautyPolisa</div>
              <div className="text-zinc-500 text-xs uppercase tracking-widest">System CRM</div>
            </div>
          </div>
        </div>

        <form onSubmit={handleLogin} className="bg-zinc-900 border border-zinc-800 p-6 space-y-4">
          <div className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-4">Logowanie</div>

          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Adres e-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="email@firma.pl"
              className="w-full h-10 bg-zinc-800 border border-zinc-700 text-white px-3 text-sm focus:outline-none focus:border-pink-500 placeholder:text-zinc-600"/>
          </div>

          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Hasło</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              placeholder="••••••••"
              className="w-full h-10 bg-zinc-800 border border-zinc-700 text-white px-3 text-sm focus:outline-none focus:border-pink-500 placeholder:text-zinc-600"/>
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-950 border border-red-800 px-3 py-2">{error}</div>
          )}

          <button type="submit" disabled={loading}
            className="w-full h-10 bg-pink-600 text-white text-sm font-semibold hover:bg-pink-500 disabled:opacity-50 transition-colors">
            {loading ? 'Logowanie...' : 'Zaloguj się'}
          </button>
        </form>

        <div className="mt-4 text-center text-zinc-600 text-xs">
          Dostęp tylko dla uprawnionych użytkowników
        </div>
      </div>
    </div>
  );
}
