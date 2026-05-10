// ============================================================
// frontend/src/components/kds/ShiftWithdrawalQuick.tsx  —  F10
//
// Modal de reabastecimiento parcial desde el KDS.
// El cocinero selecciona ingredientes y cantidades a agregar
// al mini-inventario sin salir de la vista de cocina.
// ============================================================
import { RefreshCw, X, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useShiftStore }        from '../../store/shiftStore';
import { apiFetch }             from '../../services/api';
import type { Ingredient }      from '../../types/inventory';
import type { ShiftItem }       from '../../types/shift';

interface Props {
  onClose: () => void;
  onDone:  () => void;  // recarga el panel después del restock
}

interface RestockLine {
  ingredient_id:   string;
  ingredient_name: string;
  unit:            string;
  quantity:        number;
  available:       number;  // stock disponible en bodega
}

export default function ShiftWithdrawalQuick({ onClose, onDone }: Props) {
  const { activeWithdrawal, items: shiftItems, setItems } = useShiftStore();
  const [allIngredients, setAllIngredients] = useState<Ingredient[]>([]);
  const [lines,   setLines]   = useState<RestockLine[]>([]);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Carga ingredientes disponibles en bodega
    apiFetch<Ingredient[]>('/inventory/ingredients?active=true')
      .then((ings) => {
        setAllIngredients(ings);
        // Pre-popular con ingredientes ya en el turno
        const preloaded = shiftItems
          .map((si) => {
            const ing = ings.find((i) => i.id === si.ingredient_id);
            return ing ? {
              ingredient_id:   si.ingredient_id,
              ingredient_name: si.ingredient_name,
              unit:            si.unit,
              quantity:        0,
              available:       ing.stock_quantity,
            } : null;
          })
          .filter(Boolean) as RestockLine[];
        setLines(preloaded);
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  function handleQtyChange(ingredientId: string, qty: number) {
    setLines((prev) =>
      prev.map((l) => l.ingredient_id === ingredientId ? { ...l, quantity: qty } : l)
    );
  }

  function handleAddIngredient(ing: Ingredient) {
    if (lines.some((l) => l.ingredient_id === ing.id)) return;
    setLines((prev) => [...prev, {
      ingredient_id:   ing.id,
      ingredient_name: ing.name,
      unit:            ing.unit,
      quantity:        0,
      available:       ing.stock_quantity,
    }]);
  }

  function handleRemoveLine(ingredientId: string) {
    setLines((prev) => prev.filter((l) => l.ingredient_id !== ingredientId));
  }

  async function handleSubmit() {
    if (!activeWithdrawal) return;
    const toSend = lines.filter((l) => l.quantity > 0);
    if (toSend.length === 0) { setError('Ingresa al menos una cantidad mayor a 0'); return; }

    setSaving(true);
    setError(null);
    try {
      const result = await apiFetch<{ items: ShiftItem[] }>(
        `/inventory/withdrawals/${activeWithdrawal.id}/restock`,
        { method: 'POST', body: JSON.stringify({ items: toSend.map((l) => ({ ingredient_id: l.ingredient_id, quantity: l.quantity })) }) }
      );
      // Actualizar el mini-inventario con los datos frescos
      const fresh = await apiFetch<ShiftItem[]>(`/inventory/withdrawals/${activeWithdrawal.id}/items`);
      setItems(fresh);
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al reabastecer');
    } finally {
      setSaving(false);
    }
  }

  const unusedIngredients = allIngredients.filter(
    (i) => !lines.some((l) => l.ingredient_id === i.id) && i.stock_quantity > 0
  );

  return (
<div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
  <div className="shift-modal">
    <div className="shift-modal-header">
      <h3><RefreshCw size={15}/> Reabastecer turno</h3>
          <button className="modal-close-btn" onClick={onClose} aria-label="Cerrar"><X size={15}/></button>
        </div>

        {loading ? (
          <div className="admin-loading"><div className="mip-spinner"/></div>
        ) : (
          <>
            {/* Líneas de restock */}
            <div className="shift-modal-body">
              {lines.map((line) => (
                <div key={line.ingredient_id} className="restock-line">
                  <div className="restock-line-info">
                    <span className="restock-name">{line.ingredient_name}</span>
                    <span className="restock-avail">Bodega: {line.available.toFixed(2)} {line.unit}</span>
                  </div>
                  <input
                    type="number" min="0" step="0.001" max={line.available}
                    className="restock-qty-input"
                    value={line.quantity || ''}
                    placeholder="0"
                    onChange={(e) => handleQtyChange(line.ingredient_id, parseFloat(e.target.value) || 0)}
                  />
                  <span className="restock-unit">{line.unit}</span>
                  <button className="restock-remove-btn" onClick={() => handleRemoveLine(line.ingredient_id)}>
                    <X size={13}/>
                  </button>
                </div>
              ))}

              {lines.length === 0 && (
                <p style={{ color: 'var(--kds-text-dim)', fontSize: 13, textAlign: 'center', padding: 12 }}>
                  Selecciona ingredientes para reabastecer
                </p>
              )}

              {/* Agregar ingrediente adicional */}
              {unusedIngredients.length > 0 && (
                <div className="restock-add-section">
                  <p className="restock-add-label">Agregar ingrediente:</p>
                  <div className="restock-add-grid">
                    {unusedIngredients.slice(0, 8).map((ing) => (
                      <button
                        key={ing.id}
                        className="restock-add-chip"
                        onClick={() => handleAddIngredient(ing)}
                      >
                        + {ing.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && <p className="shift-modal-error">{error}</p>}

            <div className="shift-modal-footer">
  <button className="admin-btn-ghost" onClick={onClose} disabled={saving}>Cancelar</button>
  <button className="mip-btn-restock" onClick={handleSubmit} disabled={saving}>
    {saving ? 'Procesando...' : <><Check size={15}/> Confirmar reabasto</>}
  </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}