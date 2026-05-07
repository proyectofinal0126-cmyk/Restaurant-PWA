// ============================================================
// frontend/src/components/waiter/OrderStatus.tsx  —  Fase 6
//
// Badge de estado de la orden activa en una mesa.
// Se usa dentro de TableCard para mostrar el progreso
// sin re-renderizar toda la tarjeta.
//
// PROPÓSITO: Dar visibilidad rápida al mesero del estado
// de cada mesa de un vistazo (listo para entregar, en cocina, etc.)
// ============================================================

import { memo } from 'react';
import type { OrderStatus as OrderStatusType } from '../../types/order';

interface Props {
  status: OrderStatusType | string | null | undefined;
  className?: string;
}

// Mapa de status → label + color CSS class
const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  pending_payment:    { label: 'Esperando pago',    cls: 'os-gray'   },
  payment_confirmed:  { label: 'Pago confirmado',   cls: 'os-blue'   },
  pending_validation: { label: 'En validación',     cls: 'os-yellow' },
  sent_to_kitchen:    { label: 'En cocina',          cls: 'os-orange' },
  in_preparation:     { label: 'Preparando',         cls: 'os-orange' },
  ready_for_pickup:   { label: '¡Listo!',            cls: 'os-green'  },
  delivered:          { label: 'Entregado',          cls: 'os-teal'   },
  waiting_bill: { label: 'Esperando cobro', cls: 'os-yellow' },
  completed:          { label: 'Completado',         cls: 'os-gray'   },
  cancelled:          { label: 'Cancelado',          cls: 'os-red'    },
};

const OrderStatus = memo(function OrderStatus({ status, className }: Props) {
  if (!status) return null;
  const config = STATUS_MAP[status] ?? { label: status, cls: 'os-gray' };

  return (
    <span
      className={`order-status-badge ${config.cls} ${className ?? ''}`}
      aria-label={`Estado de la orden: ${config.label}`}
    >
      {config.label}
    </span>
  );
});

export default OrderStatus;