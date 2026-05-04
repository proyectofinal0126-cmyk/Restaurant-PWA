export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';

export const ROLES = {
  ADMIN: 'admin',
  CASHIER: 'cashier',
  WAITER: 'waiter',
  KITCHEN: 'kitchen',
  CUSTOMER: 'customer',
} as const;

export const ORDER_STATUS = {
  PENDING: 'pending',
  PENDING_PAYMENT: 'pending_payment',
  PAYMENT_CONFIRMED: 'payment_confirmed',
  PENDING_VALIDATION: 'pending_validation',
  SENT_TO_KITCHEN: 'sent_to_kitchen',
  IN_PREPARATION: 'in_preparation',
  READY_FOR_PICKUP: 'ready_for_pickup',
  DELIVERED: 'delivered',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const MODES = {
  AUTOSERVICIO: 'autoservicio',
  CON_MESERO: 'con_mesero',
} as const;

/**
 * Formatea un número como pesos colombianos (COP).
 * Ejemplo: 12000 → "$ 12.000"
 */
export const formatCOP = (value: number | string): string => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '$ 0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
};
