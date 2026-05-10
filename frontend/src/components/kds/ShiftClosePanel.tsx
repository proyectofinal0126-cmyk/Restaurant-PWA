// ============================================================
// frontend/src/components/kds/ShiftClosePanel.tsx  —  F10
//
// Modal de cierre de turno. Muestra stock sobrante por ingrediente
// y permite al cocinero indicar qué devuelve a bodega y qué
// registra como merma.
// ============================================================

import { useState } from 'react';
import { useShiftStore } from '../../store/shiftStore';
import { apiFetch }      from '../../services/api';
import { Lock, TrendingDown, X } from 'lucide-react';
interface Props {
  onClose:  () => void;
  onClosed: () => void;  // callback cuando el turno se cerró exitosamente
}

type LineMode = 'devolver' | 'merma' | 'ignorar';

interface CloseLine {
  ingredient_id:   string;
  ingredient_name: string;
  unit:            string;
  remaining:       number;
  mode:            LineMode;
  quantity:        number;
  merma_notes:     string;
}

export default function ShiftClosePanel({ onClose, onClosed }: Props) {
  const { activeWithdrawal, items, clearShift } = useShiftStore();

  const [lines, setLines] = useState<CloseLine[]>(
    items
      .filter((i) => i.quantity_remaining > 0)
      .map((i) => ({
        ingredient_id:   i.ingredient_id,
        ingredient_name: i.ingredient_name,
        unit:            i.unit,
        remaining:       i.quantity_remaining,
        mode:            'devolver' as LineMode,
        quantity:        i.quantity_remaining,
        merma_notes:     '',
      }))
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  function setLineMode(id: string, mode: LineMode) {
    setLines((prev) => prev.map((l) =>
      l.ingredient_id === id ? { ...l, mode, quantity: l.remaining } : l
    ));
  }

  function setLineQty(id: string, qty: number) {
    setLines((prev) => prev.map((l) =>
      l.ingredient_id === id ? { ...l, quantity: Math.min(qty, l.remaining) } : l
    ));
  }

  function setLineMermaNotes(id: string, notes: string) {
    setLines((prev) => prev.map((l) =>
      l.ingredient_id === id ? { ...l, merma_notes: notes } : l
    ));
  }

  async function handleClose() {
    if (!activeWithdrawal) return;
    setSaving(true);
    setError(null);

    // Validar mermas con nota obligatoria
    const mermasInvalidas = lines.filter((l) => l.mode === 'merma' && !l.merma_notes.trim());
    if (mermasInvalidas.length > 0) {
      setError(`La justificación es obligatoria para mermas: ${mermasInvalidas.map((l) => l.ingredient_name).join(', ')}`);
      setSaving(false);
      return;
    }

    const returns = lines
      .filter((l) => l.mode === 'devolver' && l.quantity > 0)
      .map((l) => ({ ingredient_id: l.ingredient_id, quantity: l.quantity }));

    const mermas = lines
      .filter((l) => l.mode === 'merma' && l.quantity > 0)
      .map((l) => ({ ingredient_id: l.ingredient_id, quantity: l.quantity, notes: l.merma_notes }));

    try {
      await apiFetch(`/inventory/withdrawals/${activeWithdrawal.id}/close-liquidation`, {
        method: 'POST',
        body:   JSON.stringify({ returns, mermas }),
      });
      clearShift();
      onClosed();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cerrar turno');
    } finally {
      setSaving(false);
    }
  }

  const totalDevueltos = lines.filter((l) => l.mode === 'devolver' && l.quantity > 0).length;
  const totalMermas    = lines.filter((l) => l.mode === 'merma'    && l.quantity > 0).length;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="shift-modal shift-modal--wide">
        <div className="shift-modal-header">
          <h3><Lock size={15}/> Cerrar turno</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar"><X size={15}/></button>
        </div>

        <div className="shift-modal-body">
          {lines.length === 0 ? (
            <p style={{ color: 'var(--kds-text-dim)', textAlign: 'center', padding: 20 }}>
              No hay ingredientes sobrantes. El turno se cerrará directamente.
            </p>
          ) : (
            <>
              <p style={{ fontSize: 13, color: 'var(--kds-text-muted)', marginBottom: 14 }}>
                Indica qué hacer con los ingredientes sobrantes de tu turno:
              </p>

              {lines.map((line) => (
                <div key={line.ingredient_id} className="close-line">
                  <div className="close-line-name">
                    <strong>{line.ingredient_name}</strong>
                    <span style={{ fontSize: 12, color: 'var(--kds-text-dim)' }}>
                      {' '}— {line.remaining.toFixed(3)} {line.unit} sobrante
                    </span>
                  </div>

                  {/* Selector de modo */}
                  <div className="close-line-modes">
                    {(['devolver', 'merma', 'ignorar'] as LineMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`close-mode-btn ${line.mode === mode ? 'close-mode-btn--active' : ''}`}
                        onClick={() => setLineMode(line.ingredient_id, mode)}
                      >
                        {mode === 'devolver' ? '↩ Devolver a bodega'
  : mode === 'merma' ? <><TrendingDown size={13}/> Registrar merma</>
  : '— Ignorar'}
                      </button>
                    ))}
                  </div>

                  {/* Cantidad */}
                  {line.mode !== 'ignorar' && (
                    <div className="close-line-qty">
                      <label style={{ fontSize: 12, color: 'var(--kds-text-muted)' }}>Cantidad:</label>
                      <input
                        type="number" min="0" step="0.001" max={line.remaining}
                        className="restock-qty-input"
                        value={line.quantity || ''}
                        onChange={(e) => setLineQty(line.ingredient_id, parseFloat(e.target.value) || 0)}
                      />
                      <span style={{ fontSize: 12, color: 'var(--kds-text-dim)' }}>{line.unit}</span>
                    </div>
                  )}

                  {/* Justificación de merma */}
                  {line.mode === 'merma' && (
                    <input
                      className="close-merma-notes"
                      placeholder="Justificación (obligatoria) — ej: Caducidad, derrame..."
                      value={line.merma_notes}
                      onChange={(e) => setLineMermaNotes(line.ingredient_id, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Resumen */}
        <div className="shift-close-summary">
  {totalDevueltos > 0 && <span>↩ {totalDevueltos} ingrediente{totalDevueltos > 1 ? 's' : ''} a devolver</span>}
  {totalMermas > 0 && <span><TrendingDown size={13}/> {totalMermas} merma{totalMermas > 1 ? 's' : ''}</span>}
</div>

        {error && <p className="shift-modal-error">{error}</p>}

        <div className="shift-modal-footer">
          <button className="admin-btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="mip-btn-close" onClick={handleClose} disabled={saving}
            style={{ background: '#ef4444' }}>
  {saving ? 'Cerrando...' : <><Lock size={15}/> Confirmar cierre de turno</>}
</button>
        </div>
      </div>
    </div>
  );
}