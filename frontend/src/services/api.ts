// ============================================================
// frontend/src/services/api.ts
//
// Cliente HTTP base centralizado.
// Todos los servicios (menu, order, caja) lo usan.
// VITE_API_URL viene del .env del frontend.
// ============================================================

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Wrapper sobre fetch con manejo de errores HTTP estándar.
 * Adjunta el token JWT si existe en localStorage.
 * Lanza ApiError con el status HTTP si la respuesta no es OK.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('rpwa-token');

  const res = await fetch(`${BASE_URL}${path}`, {  // ✅ BASE_URL — no API_BASE
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res
      .json()
      .catch(() => ({ message: 'Error desconocido' }));
    throw new ApiError(res.status, body.message ?? 'Error del servidor');
  }

  // 204 No Content — retorna undefined sin intentar parsear JSON
  if (res.status === 204) return undefined as T;

  return res.json() as Promise<T>;
}