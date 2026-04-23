// ============================================================
// frontend/src/services/tableService.ts
//
// FIX: importaba TableInfo desde types/order.ts — ese tipo
// nunca existió ahí y causaba error de compilación TypeScript.
//
// FASE 6: reemplazado por Table de types/table.ts, que es el
// tipo correcto definido para el módulo mesero.
//
// Esta función sigue siendo usada por el flujo Con Mesero
// para validar mesas por número o QR.
// ============================================================

import { apiFetch } from './api';
import type { Table } from '../types/table';   // ← FIX: Table, no TableInfo

/**
 * Valida un código de mesa (número o QR) contra el backend.
 * Retorna la mesa con id, number, capacity, section, status.
 * Usado en el flujo Con Mesero para confirmar que la mesa existe.
 */
export async function validateTable(code: string): Promise<Table> {
  return apiFetch<Table>(`/tables/validate/${encodeURIComponent(code)}`);
}