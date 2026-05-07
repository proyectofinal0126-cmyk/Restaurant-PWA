// ============================================================
// frontend/src/types/shift.ts  —  Fase 10
// Tipos del mini-inventario del turno del cocinero
// ============================================================

export type MiniStatus = 'OK' | 'BAJO' | 'CRITICO' | 'AGOTADO';

export interface ShiftItem {
  id:                 string;
  ingredient_id:      string;
  ingredient_name:    string;
  unit:               string;
  quantity_withdrawn: number;  // cantidad inicial retirada
  quantity_remaining: number;  // stock actual disponible en el turno
  quantity_consumed:  number;  // calculado: withdrawn - remaining
  mini_status:        MiniStatus;
}

export interface ShiftHistory {
  id:               string;
  status:           'abierto' | 'cerrado';
  started_at:       string;
  closed_at:        string | null;
  cook_name:        string;
  ingredient_count: number;
  duration_hours:   number;
}

export interface RestockItem {
  ingredient_id: string;
  quantity:      number;
}

export interface MermaItem {
  ingredient_id: string;
  quantity:      number;
  notes:         string;
}

export interface ReturnItem {
  ingredient_id: string;
  quantity:      number;
}