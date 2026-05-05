// ============================================================
// frontend/src/pages/cocina/BodegaView.tsx  →  /cocina/bodega
//
// Vista de bodega para el COCINERO:
//   - Consulta stock actual (solo lectura)
//   - Crea retiro de turno (descuenta stock)
//   - Ve su turno activo y puede cerrarlo
// ============================================================

import { useEffect, useState } from 'react';
import { useNavigate }         from 'react-router-dom';
import { useAppStore }         from '../../store/appStore';
import { useInventoryStore }   from '../../store/inventoryStore';
import {
  getIngredients, getActiveWithdrawal,
  createWithdrawal, closeWithdrawal,
} from '../../services/inventoryService';
import type { WithdrawalItemInput } from '../../types/inventory';
import '../../styles/kds.css';
import '../../styles/inventory.css';

const STATUS_LABEL: Record<string, string> = {
  OK: '🟢', BAJO: '🟡', CRITICO: '🔴', AGOTADO: '⚫',
};

export default function BodegaView() {
  const navigate = useNavigate();
  const { user } = useAppStore();
  const {
    ingredients, ingLoading, activeWithdrawal, wdLoading,
    setIngredients, setIngLoading, setActiveWithdrawal, setWdLoading, setError,
  } = useInventoryStore();

  const [showForm, setShowForm]   = useState(false);
  const [wdItems, setWdItems]     = useState<WithdrawalItemInput[]>([]);
  const [wdNotes, setWdNotes]     = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch]       = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setIngLoading(true);
    getIngredients({ active: 'true' }).then(setIngredients).catch((e: Error) => setError(e.message));
    setWdLoading(true);
    getActiveWithdrawal().then(setActiveWithdrawal).catch(() => setActiveWithdrawal(null));
  }, []); // eslint-disable-line

  // Inicializar items del formulario con todos los ingredientes en cantidad 0
  function handleOpenForm() {
    setWdItems(ingredients.map((i) => ({ ingredient_id: i.id, quantity_withdrawn: 0 })));
    setWdNotes('');
    setShowForm(true);
  }

  function handleQtyChange(ingredientId: string, qty: number) {
    setWdItems((prev) =>
      prev.map((item) => item.ingredient_id === ingredientId ? { ...item, quantity_withdrawn: qty } : item)
    );
  }

  async function handleSubmitWithdrawal() {
    const filtered = wdItems.filter((i) => i.quantity_withdrawn > 0);
    if (filtered.length === 0) {
      setError('Debes ingresar al menos una cantidad mayor a 0');
      return;
    }
    setSubmitting(true);
    try {
      const wd = await createWithdrawal(filtered, wdNotes);
      setActiveWithdrawal(wd);
      setShowForm(false);
      // Recargar stock actualizado
      getIngredients({ active: 'true' }).then(setIngredients).catch(() => {});
      setSuccessMsg('✅ Retiro registrado. Stock descontado de bodega.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al registrar retiro');
    } finally { setSubmitting(false); }
  }

  async function handleCloseTurn() {
    if (!activeWithdrawal) return;
    if (!confirm('¿Cerrar el turno? No podrás agregarle más retiros.')) return;
    try {
      const closed = await closeWithdrawal(activeWithdrawal.id);
      setActiveWithdrawal({ ...activeWithdrawal, ...closed });
      setSuccessMsg('Turno cerrado correctamente.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cerrar turno');
    }
  }

  const filtered = ingredients.filter((i) =>
    !search || i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ minHeight: '100svh', background: '#070711', color: '#f0ece6', fontFamily: "'Satoshi', sans-serif" }}>
      {/* Header */}
      <div style={{ background: '#0d0d1e', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate('/cocina/kds')} style={{ background: 'none', border: 'none', color: '#6b6775', cursor: 'pointer', fontSize: 18 }}>←</button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 900, margin: 0 }}>Bodega</h1>
          <p style={{ fontSize: 12, color: '#6b6775', margin: 0 }}>
            {user?.name} — Stock actual de ingredientes
          </p>
        </div>
        {!activeWithdrawal || activeWithdrawal.status === 'cerrado' ? (
          <button className="admin-btn-teal" onClick={handleOpenForm} disabled={ingLoading}>
            🧺 Iniciar retiro de turno
          </button>
        ) : (
          <button className="admin-btn-ghost" onClick={handleCloseTurn} style={{ borderColor: 'rgba(45,212,191,0.3)' }}>
            ✅ Cerrar turno
          </button>
        )}
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '20px 20px 60px' }}>

        {successMsg && (
          <div className="admin-success-banner" style={{ marginBottom: 16 }}>{successMsg}</div>
        )}

        {/* Turno activo */}
        {activeWithdrawal && activeWithdrawal.status === 'abierto' && (
          <div className="withdrawal-card" style={{ marginBottom: 20 }}>
            <div className="wd-header">
              <span className="wd-title">🧺 Turno activo</span>
              <span className="wd-status-open">
                Iniciado: {new Date(activeWithdrawal.started_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="wd-items">
              {activeWithdrawal.items.map((item) => (
                <div key={item.id} className="wd-item">
                  <span className="wd-item-name">{item.ingredient_name}</span>
                  <span className="wd-item-qty">
                    {item.quantity_withdrawn.toLocaleString('es', { maximumFractionDigits: 3 })} {item.unit}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Búsqueda */}
        <div style={{ marginBottom: 14 }}>
          <input
            style={{ width: '100%', maxWidth: 320, padding: '8px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#f0ece6', fontFamily: 'inherit', fontSize: 14 }}
            placeholder="Buscar ingrediente..." value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Tabla de stock */}
        {ingLoading ? (
          <div className="admin-loading"><div className="inv-spinner"/><p>Cargando bodega...</p></div>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table" style={{ '--a-surface': '#0d0d1e', '--a-surface-2': '#121224', '--a-text': '#f0ece6', '--a-muted': '#6b6775', '--a-border': 'rgba(255,255,255,0.06)' } as React.CSSProperties}>
              <thead>
                <tr>
                  <th>Ingrediente</th>
                  <th>Unidad</th>
                  <th>Stock disponible</th>
                  <th>Mínimo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ing) => (
                  <tr key={ing.id}>
                    <td style={{ fontWeight: 600 }}>{ing.name}</td>
                    <td>{ing.unit}</td>
                    <td style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 16, fontWeight: 700 }}>
                      {ing.stock_quantity.toLocaleString('es', { maximumFractionDigits: 3 })}
                    </td>
                    <td style={{ color: '#6b6775', fontSize: 12 }}>
                      {ing.min_stock.toLocaleString('es', { maximumFractionDigits: 3 })}
                    </td>
                    <td>
                      <span style={{ fontSize: 18 }}>{STATUS_LABEL[ing.status] ?? '?'}</span>
                      <span style={{ fontSize: 11, color: '#6b6775', marginLeft: 4 }}>{ing.status}</span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 28, color: '#6b6775' }}>
                    Sin resultados
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal: Formulario de retiro ── */}
      {showForm && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div style={{
            background: '#0d0d1e', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 16, padding: 24, width: '100%', maxWidth: 560,
            maxHeight: '85vh', overflowY: 'auto',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3 style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 18, fontWeight: 900 }}>
                🧺 Retiro de turno
              </h3>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', color: '#6b6775', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <p style={{ fontSize: 12, color: '#6b6775' }}>
              Ingresa las cantidades que retirarás. Solo los campos con cantidad &gt; 0 se registran.
            </p>

            {ingredients.map((ing) => {
              const val = wdItems.find((i) => i.ingredient_id === ing.id)?.quantity_withdrawn ?? 0;
              return (
                <div key={ing.id} className="wd-form-item" style={{ gridTemplateColumns: '1fr 80px 40px auto' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{ing.name}</span>
                  <input
                    type="number" min="0" step="0.001" max={ing.stock_quantity}
                    value={val || ''}
                    onChange={(e) => handleQtyChange(ing.id, parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0ece6', fontFamily: 'inherit', fontSize: 13 }}
                  />
                  <span style={{ fontSize: 11, color: '#6b6775', textAlign: 'center' }}>{ing.unit}</span>
                  <span style={{ fontSize: 11, color: ing.stock_quantity < (val ?? 0) ? '#ef4444' : '#6b6775' }}>
                    /{ing.stock_quantity.toFixed(1)}
                  </span>
                </div>
              );
            })}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, color: '#6b6775', fontWeight: 600 }}>Nota del turno (opcional)</label>
              <input value={wdNotes} onChange={(e) => setWdNotes(e.target.value)}
                placeholder="Ej: Turno mañana 08:00–16:00"
                style={{ padding: '8px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0ece6', fontFamily: 'inherit', fontSize: 13 }}/>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button className="admin-btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="admin-btn-teal" onClick={handleSubmitWithdrawal} disabled={submitting}>
                {submitting ? 'Registrando...' : '✅ Confirmar retiro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}