import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface LoginPageProps {
  onAuthenticated: () => void;
}

export const LoginPage = ({ onAuthenticated }: LoginPageProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signUpSuccess, setSignUpSuccess] = useState(false);
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (isSignUp) {
      const { error } = await signUp(email, password);
      if (error) {
        setError(error.message);
      } else {
        setSignUpSuccess(true);
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error.message);
      } else {
        onAuthenticated();
      }
    }
    setLoading(false);
  };

  if (signUpSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6" style={{ backgroundColor: '#111' }}>
        <h1 className="text-3xl font-extrabold tracking-tight font-mono" style={{ color: '#00cc13' }}>
          Eagle POS
        </h1>
        <div className="w-full max-w-sm p-6 rounded-lg" style={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}>
          <p className="text-center font-bold" style={{ color: '#00cc13' }}>
            Verificatie e-mail verzonden!
          </p>
          <p className="text-center text-sm mt-2" style={{ color: '#999' }}>
            Controleer je inbox en klik op de link om je account te activeren.
          </p>
          <button
            onClick={() => { setIsSignUp(false); setSignUpSuccess(false); }}
            className="w-full mt-4 py-3 font-extrabold uppercase text-sm"
            style={{ backgroundColor: '#2a2a2a', color: '#e5e5e5', border: '1px solid #333' }}
          >
            Terug naar login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6" style={{ backgroundColor: '#111' }}>
      <h1 className="text-3xl font-extrabold tracking-tight font-mono" style={{ color: '#00cc13' }}>
        Eagle POS
      </h1>
      <form onSubmit={handleSubmit} className="w-full max-w-sm p-6 rounded-lg flex flex-col gap-4" style={{ backgroundColor: '#1a1a1a', border: '1px solid #333' }}>
        <h2 className="text-xl font-extrabold uppercase text-center" style={{ color: '#e5e5e5' }}>
          {isSignUp ? 'Account aanmaken' : 'Inloggen'}
        </h2>

        {error && (
          <div className="text-sm font-bold text-center py-2 rounded" style={{ backgroundColor: '#ef444420', color: '#ef4444' }}>
            {error}
          </div>
        )}

        <input
          type="email"
          placeholder="E-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full py-3 px-4 font-bold text-sm rounded"
          style={{ backgroundColor: '#2a2a2a', color: '#e5e5e5', border: '1px solid #444', outline: 'none' }}
        />
        <input
          type="password"
          placeholder="Wachtwoord"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full py-3 px-4 font-bold text-sm rounded"
          style={{ backgroundColor: '#2a2a2a', color: '#e5e5e5', border: '1px solid #444', outline: 'none' }}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 font-extrabold uppercase text-sm disabled:opacity-50"
          style={{ backgroundColor: '#00cc13', color: '#fff', boxShadow: '0 0 20px #00cc1380', borderRadius: 4 }}
        >
          {loading ? '...' : isSignUp ? 'Registreren' : 'Login'}
        </button>

        <button
          type="button"
          onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
          className="text-sm font-bold text-center"
          style={{ color: '#888', background: 'none', border: 'none' }}
        >
          {isSignUp ? 'Al een account? Log in' : 'Nieuw? Maak een account'}
        </button>
      </form>
    </div>
  );
};
