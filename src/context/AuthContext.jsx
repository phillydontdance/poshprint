import { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Get the Firebase ID token
        const idToken = await firebaseUser.getIdToken();

        // Fetch role from our backend
        let role = 'customer';
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${idToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            role = data.role;
          }
        } catch {
          // Default to customer if backend is unreachable
        }

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
