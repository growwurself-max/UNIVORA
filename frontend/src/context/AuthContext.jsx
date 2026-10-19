import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

const normalizeRole = (role) => {
  const normalized = role.trim().toLowerCase().replace(/[\s-]+/g, '_');
  const roleAliases = {
    college_admin: 'admin',
    teacher: 'faculty',
    accountant: 'staff',
  };
  return roleAliases[normalized] || normalized;
};

const normalizeUser = (user) => {
  if (!user?.profile) return user;

  const roleName = user.profile.role;
  return {
    ...user,
    profile: {
      ...user.profile,
      roleName,
      role: roleName ? normalizeRole(roleName) : null,
    },
  };
};

const requireAssignedRole = (user) => {
  const role = user?.profile?.role;
  if (!role || role === 'pending') {
    throw new Error('Your account does not have an active role yet. Contact your administrator.');
  }
  if (role !== 'super_admin' && !user?.profile?.institutionId) {
    throw new Error('Your account is not assigned to an institution. Contact your administrator.');
  }
  return user;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem('accessToken')));

  const fetchProfile = useCallback(async () => {
    try {
      const response = await authAPI.getProfile();
      const authenticatedUser = requireAssignedRole(normalizeUser(response.data.data.user));
      if (authenticatedUser.profile?.isDemo) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        return;
      }
      setUser(authenticatedUser);
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => {
      setUser(null);
      setLoading(false);
    };
    window.addEventListener('univora:auth-expired', handleSessionExpired);

    const token = localStorage.getItem('accessToken');
    if (token) {
      fetchProfile();
    }

    return () => window.removeEventListener('univora:auth-expired', handleSessionExpired);
  }, [fetchProfile]);

  const completeLogin = (authData) => {
    const { session } = authData;
    let user;
    try {
      user = requireAssignedRole(normalizeUser(authData.user));
    } catch (error) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
      throw error;
    }

    localStorage.setItem('accessToken', session.accessToken);
    localStorage.setItem('refreshToken', session.refreshToken);
    setUser(user);

    return user;
  };

  const login = async (email, password) => {
    const response = await authAPI.login({ email, password });
    return completeLogin(response.data.data);
  };

  const completeDemoLogin = async () => {
    const response = await authAPI.setupDemoUser();
    return completeLogin(response.data.data);
  };

  const register = async (name, email, password) => {
    const response = await authAPI.register({ name, email, password });
    const { session } = response.data.data;
    const user = requireAssignedRole(normalizeUser(response.data.data.user));

    localStorage.setItem('accessToken', session.accessToken);
    localStorage.setItem('refreshToken', session.refreshToken);
    setUser(user);

    return user;
  };

  const logout = async () => {
    try {
      if (localStorage.getItem('accessToken')) await authAPI.logout();
    } finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, completeDemoLogin, register, logout }}>
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
