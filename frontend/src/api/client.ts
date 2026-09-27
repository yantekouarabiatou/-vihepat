import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env['VITE_API_URL'] || 'http://localhost:4000/api',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Ajoute le token à chaque requête
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vihepat_access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Gère les 401 (token expiré) — pour l'instant, on déconnecte
api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('vihepat_access_token');
      localStorage.removeItem('vihepat_refresh_token');
      localStorage.removeItem('vihepat_user');
      // Rediriger vers login si on n'y est pas déjà
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);