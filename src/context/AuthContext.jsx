import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async (idToken, retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${idToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            return data.role;
          }
        } catch {
          // Server might be waking up (Render cold start), retry
        }
        if (i < retries - 1) await new Promise(r => setTimeout(r, 2000));
      }
      return 'customer';
    };

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const idToken = await firebaseUser.getIdToken();
        const role = await fetchRole(idToken);

        const userData = {
          id: firebaseUser.uid,
          email: firebaseUser.email,
          name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          role,
        };

        setUser(userData);
        setToken(idToken);
      } else {
        setUser(null);
        setToken(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setToken(null);
  };

  // Refresh token periodically (Firebase tokens expire in 1 hour)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        const newToken = await currentUser.getIdToken(true);
        setToken(newToken);
      }
    }, 45 * 60 * 1000); // Refresh every 45 minutes
    return () => clearInterval(interval);
  }, [user]);

  // Dev login via browser console: window.__devLogin('YOUR_UID')
  useEffect(() => {
    if (import.meta.env.DEV) {
      window.__devLogin = async (uid) => {
        try {
          const res = await fetch('/api/dev/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid }),
          });
          if (!res.ok) {
            const err = await res.json();
            console.error('❌ Dev login failed:', err.error);
            return;
          }
          const data = await res.json();
          setUser({ id: data.id, email: data.email, name: data.name, role: data.role });
          setToken(data.token);
          setLoading(false);
          console.log(`✅ Logged in as ${data.name} (${data.role})`);
          console.log(`   Email: ${data.email}`);
          console.log(`   UID: ${data.id}`);
          console.log('   Navigate to /admin for admin dashboard');
        } catch (err) {
          console.error('❌ Dev login error:', err);
        }
      };

      window.__devLogout = () => {
        setUser(null);
        setToken(null);
        console.log('✅ Logged out');
      };

      // Show help on load
      console.log(
        '%c🔧 Posh Print Dev Mode',
        'color: #22c55e; font-size: 14px; font-weight: bold;'
      );
      console.log('  Login as admin:  window.__devLogin("ZuqzgBP4h2MG2bi2Qau7KCjNsSU2")');
      console.log('  Logout:          window.__devLogout()');
    }
    return () => {
      if (import.meta.env.DEV) {
        delete window.__devLogin;
        delete window.__devLogout;
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
