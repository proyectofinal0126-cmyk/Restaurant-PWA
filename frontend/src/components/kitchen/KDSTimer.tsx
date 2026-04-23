// ============================================================
// frontend/src/components/kitchen/KDSTimer.tsx  —  Fase 5
//
// Contador de tiempo transcurrido desde created_at de la orden.
// Se actualiza internamente cada 10s sin propagar re-renders
// al componente padre (OrderPrep / KDS).
//
// COLORES:
//   🟢 Verde   → < 10 min   (dentro de tiempo normal)
//   🟡 Amarillo → 10-20 min (empieza a tardar)
//   🔴 Rojo    → > 20 min   (urgente)
//
// OPTIMIZACIÓN:
// El componente maneja su propio estado de minutos con useState.
// El padre NO re-renderiza cuando el timer cambia — solo KDSTimer
// se actualiza cada 10 segundos via su propio setInterval.
// ============================================================

import { useState, useEffect, memo } from 'react';

interface Props {
  createdAt: string;   // ISO string de created_at de la orden
  className?: string;
}

type TimerColor = 'green' | 'yellow' | 'red';

function getColor(minutes: number): TimerColor {
  if (minutes < 10) return 'green';
  if (minutes < 20) return 'yellow';
  return 'red';
}

function getEmoji(color: TimerColor): string {
  if (color === 'green')  return '🟢';
  if (color === 'yellow') return '🟡';
  return '🔴';
}

function formatTime(minutes: number): string {
  if (minutes < 1)  return '< 1 min';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function computeMinutes(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000);
}

// memo: evita re-renderizar si createdAt no cambió
const KDSTimer = memo(function KDSTimer({ createdAt, className }: Props) {
  const [minutes, setMinutes] = useState(() => computeMinutes(createdAt));

  // Actualiza cada 10 segundos — frecuencia suficiente para el KDS
  useEffect(() => {
    const interval = setInterval(() => {
      setMinutes(computeMinutes(createdAt));
    }, 10_000);
    return () => clearInterval(interval);
  }, [createdAt]);

  const color = getColor(minutes);

  return (
    <span
      className={`kds-timer kds-timer--${color} ${className ?? ''}`}
      aria-label={`Tiempo transcurrido: ${formatTime(minutes)}`}
    >
      <span aria-hidden="true">{getEmoji(color)}</span>
      {formatTime(minutes)}
    </span>
  );
});

export default KDSTimer;
