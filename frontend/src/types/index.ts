// frontend/src/types/index.ts
// Re-exporta todos los tipos para imports limpios:
// import type { MenuItem, Order, CartItem } from '../types';

export type * from './menu';
export type * from './order';
export type * from './table'; // ← NUEVO: Table, TableStatus, WaiterOrderPayload, etc.