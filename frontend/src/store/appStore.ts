// ============================================================
// frontend/src/store/appStore.ts
//
// operationMode → configuración del restaurante (viene del servidor).
//   'autoservicio' = solo kiosco QR
//   'mesero'       = solo servicio con mesero
//   'ambos'        = los dos modos disponibles
//
// mode → selección de sesión del usuario (autoservicio | mesero).
//   Si operationMode !== 'ambos', se auto-establece al iniciar.
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type OperationMode = 'autoservicio' | 'mesero' | 'ambos';
export type Mode = 'autoservicio' | 'mesero' | null;

export type Role =
  | 'cliente'
  | 'mesero'
  | 'cocina'
  | 'caja'
  | 'admin'
  | null;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  token: string;
}

// Misma base URL que usa api.ts
const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

interface AppState {
  /** Modo de operación configurado en el restaurante (desde BD) */
  operationMode: OperationMode;
  /** Modo de sesión seleccionado por el usuario */
  mode: Mode;
  role: Role;
  user: AuthUser | null;
  isAuthenticated: boolean;
  configLoaded: boolean;

  // actions
  setOperationMode: (m: OperationMode) => void;
  setMode: (mode: Mode) => void;
  setRole: (role: Role) => void;
  setUser: (user: AuthUser) => void;
  logout: () => void;
  loadConfig: () => Promise<void>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      operationMode: 'ambos',
      mode: null,
      role: null,
      user: null,
      isAuthenticated: false,
      configLoaded: false,

      setOperationMode: (operationMode) => {
        const update: Partial<AppState> = { operationMode };
        // Si el modo no es 'ambos', forzar la selección de sesión
        if (operationMode !== 'ambos') {
          update.mode = operationMode as Mode;
        }
        set(update);
      },

      setMode: (mode) => set({ mode, role: null }),
      setRole: (role) => set({ role }),
      setUser: (user) => set({ user, isAuthenticated: true }),
      logout: () =>
        set((s) => ({
          user: null,
          isAuthenticated: false,
          role: null,
          // Si operationMode es único, mantener mode; si es 'ambos', limpiar
          mode: s.operationMode === 'ambos' ? null : s.mode,
        })),

      loadConfig: async () => {
        if (get().configLoaded) return;
        try {
          const res = await fetch(`${API_BASE}/config`);
          if (!res.ok) throw new Error('config fetch failed');
          const data = await res.json() as { operationMode: OperationMode };
          get().setOperationMode(data.operationMode);
          set({ configLoaded: true });
        } catch {
          // Fallback seguro si el servidor no responde
          set({ operationMode: 'ambos', configLoaded: true });
        }
      },
    }),
    {
      name: 'rpwa-app-store',
      // operationMode NO se persiste — siempre viene del servidor.
      // El servidor es la única fuente de verdad para el modo de operación.
      partialize: (s) => ({
        mode: s.mode,
        role: s.role,
        user: s.user,
        isAuthenticated: s.isAuthenticated,
      }),
    }
  )
);