import { create } from 'zustand';

export type Role = 'patient' | 'soignant' | 'admin';

export interface AuthUser {
  id: number;
  email: string;
  nom: string;
  prenom: string;
  role: Role;
  patient?: any;
  soignant?: any;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem('vihepat_user') || 'null'),
  accessToken: localStorage.getItem('vihepat_access_token'),
  refreshToken: localStorage.getItem('vihepat_refresh_token'),
  isAuthenticated: !!localStorage.getItem('vihepat_access_token'),

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem('vihepat_user', JSON.stringify(user));
    localStorage.setItem('vihepat_access_token', accessToken);
    localStorage.setItem('vihepat_refresh_token', refreshToken);
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  logout: () => {
    // Discrétion : on efface les données médicales gardées pour le mode hors ligne
    if (typeof caches !== 'undefined') void caches.delete('vihepat-api');
    localStorage.removeItem('vihepat_user');

    localStorage.removeItem('vihepat_access_token');
    localStorage.removeItem('vihepat_refresh_token');
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },
}));