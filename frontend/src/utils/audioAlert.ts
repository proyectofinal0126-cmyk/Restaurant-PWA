// ============================================================
// frontend/src/utils/audioAlert.ts
//
// Genera alertas sonoras con Web Audio API sin archivos externos.
// Evita el bloqueo de autoplay usando un AudioContext que se
// crea solo después de un gesto del usuario (la política del
// navegador lo permite si se inicia desde un event handler o
// un timeout post-interacción, que es como lo invoca el KDS).
//
// PATRONES DISPONIBLES:
//   alertNewOrder()   — orden nueva en cocina (2 beeps ascendentes)
//   alertOrderReady() — pedido listo para entregar (acorde suave)
//   alertUrgent()     — orden urgente >20min (3 beeps rápidos agudos)
// ============================================================

/** Contexto compartido para no crear uno por cada alerta */
let _ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!_ctx || _ctx.state === 'closed') {
      _ctx = new AudioContext();
    }
    // Reanudar si el navegador lo suspendió (política de autoplay)
    if (_ctx.state === 'suspended') {
      _ctx.resume();
    }
    return _ctx;
  } catch {
    return null;
  }
}

/**
 * Reproduce un tono simple con parámetros controlados.
 * @param freq      Frecuencia en Hz
 * @param duration  Duración en segundos
 * @param gain      Volumen 0-1
 * @param delay     Retraso de inicio en segundos
 * @param type      Forma de onda
 */
function playTone(
  freq: number,
  duration: number,
  gain = 0.3,
  delay = 0,
  type: OscillatorType = 'sine'
): void {
  const ctx = getCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);

  gainNode.gain.setValueAtTime(0, ctx.currentTime + delay);
  gainNode.gain.linearRampToValueAtTime(gain, ctx.currentTime + delay + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(
    0.001,
    ctx.currentTime + delay + duration
  );

  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration);
}

/**
 * Alerta de nueva orden en cocina.
 * Patrón: dos beeps ascendentes (sol → si) — suave pero audible.
 */
export function alertNewOrder(): void {
  playTone(392, 0.18, 0.28, 0.0);   // G4
  playTone(494, 0.22, 0.30, 0.22);  // B4
}

/**
 * Alerta de pedido listo para entregar.
 * Patrón: acorde mayor corto (do-mi-sol) — positivo y claro.
 */
export function alertOrderReady(): void {
  playTone(523, 0.25, 0.25, 0.00);  // C5
  playTone(659, 0.25, 0.22, 0.10);  // E5
  playTone(784, 0.35, 0.28, 0.20);  // G5
}

/**
 * Alerta de urgencia (orden >20 min sin avanzar).
 * Patrón: tres beeps agudos rápidos — llamado de atención.
 */
export function alertUrgent(): void {
  playTone(880, 0.12, 0.35, 0.00, 'square');  // A5
  playTone(880, 0.12, 0.35, 0.18, 'square');  // A5
  playTone(880, 0.12, 0.35, 0.36, 'square');  // A5
}

/**
 * Desbloquea el AudioContext al primer gesto del usuario.
 * Llamar una vez al montar el componente raíz del KDS.
 * Sin esto, el navegador puede bloquear el primer sonido.
 */
export function unlockAudio(): void {
  const ctx = getCtx();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume();
  }
}