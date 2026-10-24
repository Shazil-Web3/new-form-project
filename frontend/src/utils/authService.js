import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import apiClient, { API_BASE_URL } from '../api/apiClient';

axios.defaults.baseURL = API_BASE_URL;

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const isDev = process.env.NODE_ENV === 'development';
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tokens, setTokens] = useState(() => {
    // Initialize tokens from localStorage if available
    const savedTokens = localStorage.getItem('auth_tokens');
    return savedTokens ? JSON.parse(savedTokens) : null;
  });

  // Mock user override state strictly allowed ONLY in development
  const [mockUser, setMockUser] = useState(() => {
    if (!isDev) {
      try {
        localStorage.removeItem('mock_user_override');
      } catch (e) {}
      return null;
    }
    const saved = localStorage.getItem('mock_user_override');
    return saved ? JSON.parse(saved) : null;
  });

  const setMockUserOverride = (userData) => {
    if (!isDev) return;
    setMockUser(userData);
    if (userData) {
      localStorage.setItem('mock_user_override', JSON.stringify(userData));
    } else {
      localStorage.removeItem('mock_user_override');
    }
  };

  // Set up request interceptor for default global axios to attach bearer token
  useEffect(() => {
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        if (tokens?.accessToken) {
          config.headers.Authorization = `Bearer ${tokens.accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    return () => {
      axios.interceptors.request.eject(requestInterceptor);
    };
  }, [tokens]);

  // Check auth status on initial load and after explicit login only
  useEffect(() => {
    const validateSession = async () => {
      if (tokens?.accessToken) {
        try {
          const response = await apiClient.get('/api/users/me');
          setUser(response.data);
        } catch (error) {
          if (error.response?.status === 401) {
            clearAuth();
          }
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    // Only validate session on initial app load when user data is not yet set
    // Silent token refresh (handled by apiClient interceptor) will NOT trigger this
    // This prevents unnecessary component re-initialization and preserves editor state
    if (!user && tokens?.accessToken) {
      validateSession();
    } else if (!tokens?.accessToken) {
      setLoading(false);
    }
  }, [user]);

  // Save tokens to localStorage whenever they change
  useEffect(() => {
    if (tokens) {
      localStorage.setItem('auth_tokens', JSON.stringify(tokens));
    } else {
      localStorage.removeItem('auth_tokens');
    }
  }, [tokens]);

  // Handle explicit logout events from apiClient when token refresh fails
  useEffect(() => {
    const handleLogout = () => {
      clearAuth();
    };

    window.addEventListener('auth_logout', handleLogout);

    return () => {
      window.removeEventListener('auth_logout', handleLogout);
    };
  }, []);

  const setAuthTokens = (newTokens) => {
    setTokens(newTokens);
  };

  const setUserData = (userData) => {
    setUser(userData);
  };

  const clearAuth = () => {
    setTokens(null);
    setUser(null);
    setMockUser(null);
    try {
      localStorage.removeItem('mock_user_override');
      localStorage.removeItem('auth_tokens');
    } catch (e) {}
    setLoading(false);
  };

  const logout = async () => {
    try {
      if (tokens?.refreshToken) {
        // Invalidate the refresh token on the server
        await apiClient.post('/api/auth/logout', { refreshToken: tokens.refreshToken });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuth();
    }
  };

  // Effective user: mock override only active in development when a real authenticated user exists
  const effectiveUser = (isDev && user && mockUser) ? { ...user, ...mockUser } : user;

  return (
    <AuthContext.Provider 
      value={{ 
        user: effectiveUser, 
        tokens, 
        loading, 
        setAuthTokens, 
        setUserData, 
        clearAuth, 
        logout,
        isAuthenticated: !!user,
        mockUserOverride: isDev ? mockUser : null,
        setMockUserOverride: isDev ? setMockUserOverride : () => {}
      }}
    >
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