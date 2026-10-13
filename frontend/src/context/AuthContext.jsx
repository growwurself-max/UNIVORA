import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await authAPI.getProfile();
      setUser(response.data.data.user);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    const { user, session } = response.data.data;

    localStorage.setItem('accessToken', session.accessToken);
    localStorage.setItem('refreshToken', session.refreshToken);
    setUser(user);

    return user;
  };

  const register = async (name, email, password) => {
    const response = await authAPI.register({ name, email, password });
    const { user, session } = response.data.data;

    localStorage.setItem('accessToken', session.accessToken);
    localStorage.setItem('refreshToken', session.refreshToken);
    setUser(user);

    return user;
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
