import axios from 'axios';

export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to attach authorization header from storage
const attachAuthToken = (config) => {
  const savedTokens = localStorage.getItem('auth_tokens');
  if (savedTokens) {
    try {
      const tokens = JSON.parse(savedTokens);
      if (tokens?.accessToken) {
        config.headers.Authorization = `Bearer ${tokens.accessToken}`;
      }
    } catch (err) {
      console.error('Error parsing auth tokens for request', err);
    }
  }

  try {
    const mockOverride = localStorage.getItem('mock_user_override');
    if (mockOverride) {
      const parsedMock = JSON.parse(mockOverride);
      if (parsedMock?.role) {
        config.headers['x-mock-role'] = parsedMock.role;
      }
      if (parsedMock?.id) {
        config.headers['x-mock-user-id'] = parsedMock.id;
      }
      if (parsedMock?.email) {
        config.headers['x-mock-email'] = parsedMock.email;
      }
    }
  } catch (e) {}

  return config;
};

// Request interceptor attached to both apiClient and global axios
apiClient.interceptors.request.use(attachAuthToken, (error) => Promise.reject(error));
axios.interceptors.request.use(attachAuthToken, (error) => Promise.reject(error));

// Response interceptor to handle 401 token refreshing and logout via singleton queue
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const createAuthResponseInterceptor = (executor) => {
  return async (error) => {
    const originalRequest = error.config;

    // Check if error is 401 and request has not already been retried
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Don't retry refresh requests themselves or password verification
      if (
        originalRequest.url?.includes('/api/auth/refresh') ||
        originalRequest.url?.includes('/api/auth/logout') ||
        originalRequest.url?.includes('/api/verify-password')
      ) {
        return Promise.reject(error);
      }

      const savedTokensStr = localStorage.getItem('auth_tokens');
      if (savedTokensStr) {
        try {
          const tokens = JSON.parse(savedTokensStr);
          if (tokens?.refreshToken) {
            if (isRefreshing) {
              return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject });
              })
                .then((token) => {
                  originalRequest.headers.Authorization = `Bearer ${token}`;
                  return executor(originalRequest);
                })
                .catch((err) => {
                  return Promise.reject(err);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
              // Call the refresh endpoint using a standalone axios call to avoid interceptor recursion
              const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
                refreshToken: tokens.refreshToken,
              });

              const newAccessToken = response.data.accessToken;
              const newRefreshToken = response.data.refreshToken || tokens.refreshToken;
              const newTokens = {
                ...tokens,
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
              };

              localStorage.setItem('auth_tokens', JSON.stringify(newTokens));
              
              // Dispatch events to notify AuthProvider or other components of token updates
              window.dispatchEvent(new CustomEvent('auth_tokens_changed', { detail: newTokens }));

              apiClient.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
              axios.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
              originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

              processQueue(null, newAccessToken);
              return executor(originalRequest);
            } catch (refreshError) {
              processQueue(refreshError, null);
              console.error('Token refresh failed:', refreshError);
              localStorage.removeItem('auth_tokens');
              window.dispatchEvent(new Event('auth_logout'));
              return Promise.reject(refreshError);
            } finally {
              isRefreshing = false;
            }
          }
        } catch (parseError) {
          console.error('Failed to parse tokens during 401 handling', parseError);
        }
      }
      
      // If we got a 401 and could not refresh, clear auth
      localStorage.removeItem('auth_tokens');
      window.dispatchEvent(new Event('auth_logout'));
    }

    return Promise.reject(error);
  };
};

apiClient.interceptors.response.use((response) => response, createAuthResponseInterceptor(apiClient));
axios.interceptors.response.use((response) => response, createAuthResponseInterceptor(axios));

export default apiClient;
