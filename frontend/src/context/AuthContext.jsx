import { createContext, useContext, useState, useCallback } from 'react';

function leerUsuario() {
  try { return JSON.parse(localStorage.getItem('acb_usuario')); } catch { return null; }
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(leerUsuario);

  const guardar = useCallback((u, token) => {
    localStorage.setItem('acb_token', token);
    localStorage.setItem('acb_usuario', JSON.stringify(u));
    setUsuario(u);
  }, []);

  const cerrar = useCallback(() => {
    localStorage.removeItem('acb_token');
    localStorage.removeItem('acb_usuario');
    setUsuario(null);
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, guardar, cerrar }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
