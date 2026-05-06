// ============================================================
// frontend/src/pages/cocina/BodegaView.tsx  →  /cocina/bodega
// Rediseñado: tema claro, sin emojis, iconos SVG
// ============================================================
import { Warehouse, ClipboardList, CheckCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate }         from 'react-router-dom';
import { useAppStore }         from '../../store/appStore';
import { useInventoryStore }   from '../../store/inventoryStore';
import {
  getIngredients, getActiveWithdrawal,
  createWithdrawal, closeWithdrawal,
} from '../../services/inventoryService';
import type { WithdrawalItemInput } from '../../types/inventory';
import '../../styles/inventory.css';
import '../../styles/admin.css';

// ── Iconos SVG inline ────────────────────────────────────────
const IconArrowLeft = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 5l-7 7 7 7"/>
  </svg>
);
const IconWarehouse = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/>
    <path d="M6 18h12M6 14h12M6 10h12"/>
  </svg>
);
const IconClipboardList = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
    <path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>
  </svg>
);
const IconCheckCircle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
    <polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);
const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);
const IconSearch = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);
const IconAlertTriangle = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);
const IconPackage = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
);
const IconDot = ({ color }: { color: string }) => (
  <svg width="8" height="8" viewBox="0 0 8 8" style={{ flexShrink: 0 }}>
    <circle cx="4" cy="4" r="4" fill={color}/>
  </svg>
);
const IconClock = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
);

// ── Helpers ──────────────────────────────────────────────────
const STATUS_DOT: Record<string, string> = {
  OK: '#22c55e', BAJO: '#f59e0b', CRITICO: '#ef4444', AGOTADO: '#9ca3af',
};
const STATUS_CLASS: Record<string, string> = {
  OK: 'stock-badge--ok', BAJO: 'stock-badge--bajo',
  CRITICO: 'stock-badge--crit', AGOTADO: 'stock-badge--oot',
};
const STATUS_LABEL: Record<string, string> = {
  OK: 'OK', BAJO: 'Bajo', CRITICO: 'Crítico', AGOTADO: 'Agotado',
};

export default function BodegaView() {
  const navigate = useNavigate();
  const { user } = useAppStore();
  const {
    ingredients, ingLoading, activeWithdrawal, wdLoading,
    setIngredients, setIngLoading, setActiveWithdrawal, setWdLoading, setError,
  } = useInventoryStore();

  const [showForm, setShowForm]     = useState(false);
  const [wdItems, setWdItems]       = useState<WithdrawalItemInput[]>([]);
  const [wdNotes, setWdNotes]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch]         = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setIngLoading(true);
    getIngredients({ active: 'true' }).then(setIngredients).catch((e: Error) => setError(e.message));
    setWdLoading(true);
    getActiveWithdrawal().then(setActiveWithdrawal).catch(() => setActiveWithdrawal(null));
  }, []); // eslint-disable-line

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
      getIngredients({ active: 'true' }).then(setIngredients).catch(() => {});
      setSuccessMsg('Retiro registrado. Stock descontado de bodega.');
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
  const hasActiveTurn = activeWithdrawal && activeWithdrawal.status === 'abierto';

  return (
    <div style={{ minHeight: '100svh', background: 'var(--a-bg, #F5F5F7)', color: 'var(--a-text, #1D1D1F)', fontFamily: "'Satoshi', sans-serif" }}>

      {/* Header */}
      <div style={{ background: 'var(--a-surface, #fff)', borderBottom: '1px solid var(--a-border, rgba(28,20,16,0.07))', padding: '14px 24px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          onClick={() => navigate('/cocina/kds')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: 9, background: 'var(--a-surface-2, #F0F0F5)', border: '1px solid var(--a-border, rgba(28,20,16,0.07))', color: 'var(--a-muted, #98989D)', cursor: 'pointer' }}
          title="Volver a cocina"
        >
          <IconArrowLeft />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--inv-teal-soft, rgba(45,212,191,0.12))', border: '1px solid var(--inv-teal-border, rgba(45,212,191,0.28))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--inv-teal, #2dd4bf)', flexShrink: 0 }}>
            <IconWarehouse />
          </div>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 900, margin: 0, fontFamily: "'Cabinet Grotesk', sans-serif" }}>Bodega</h1>
            <p style={{ fontSize: 12, color: 'var(--a-muted, #98989D)', margin: 0 }}>{user?.name} — Stock actual de ingredientes</p>
          </div>
        </div>

        {!hasActiveTurn ? (
          <button className="admin-btn-teal" onClick={handleOpenForm} disabled={ingLoading || wdLoading} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <IconClipboardList /> Iniciar retiro de turno
          </button>
        ) : (
          <button className="admin-btn-ghost" onClick={handleCloseTurn} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <IconCheckCircle /> Cerrar turno
          </button>
        )}
      </div>

      {/* Contenido */}
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 20px 60px' }}>

        {successMsg && (
          <div className="admin-success-banner" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconCheckCircle /> {successMsg}
          </div>
        )}

        {hasActiveTurn && (
          <div className="withdrawal-card" style={{ marginBottom: 20 }}>
            <div className="wd-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconPackage />
                <span className="wd-title">Turno activo</span>
              </div>
              <span className="wd-status-open" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <IconClock /> Iniciado: {new Date(activeWithdrawal.started_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="wd-items">
              {activeWithdrawal.items.map((item) => (
                <div key={item.id} className="wd-item">
                  <span className="wd-item-name">{item.ingredient_name}</span>
                  <span className="wd-item-qty">{item.quantity_withdrawn.toLocaleString('es', { maximumFractionDigits: 3 })} {item.unit}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Búsqueda */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ position: 'relative', display: 'inline-block', maxWidth: 320, width: '100%' }}>
            <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--a-muted, #98989D)', pointerEvents: 'none' }}>
              <IconSearch />
            </span>
            <input
              style={{ width: '100%', padding: '9px 12px 9px 34px', borderRadius: 10, background: 'var(--a-surface, #fff)', border: '1px solid var(--a-border, rgba(28,20,16,0.07))', color: 'var(--a-text, #1D1D1F)', fontFamily: 'inherit', fontSize: 13, outline: 'none', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
              placeholder="Buscar ingrediente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Tabla */}
        {ingLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 48, color: 'var(--a-muted)' }}>
            <div className="inv-spinner" />
            <p style={{ fontSize: 13 }}>Cargando bodega...</p>
          </div>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Ingrediente</th><th>Unidad</th><th>Stock disponible</th><th>Mínimo</th><th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ing) => (
                  <tr key={ing.id}>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{ing.name}</td>
                    <td style={{ color: 'var(--a-muted)', fontSize: 12 }}>{ing.unit}</td>
                    <td>
                      <span style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 15, fontWeight: 800, color: ing.status === 'AGOTADO' ? 'var(--inv-oot)' : ing.status === 'CRITICO' ? 'var(--inv-crit)' : ing.status === 'BAJO' ? 'var(--inv-low)' : 'var(--a-text)' }}>
                        {ing.stock_quantity.toLocaleString('es', { maximumFractionDigits: 3 })}
                      </span>
                    </td>
                    <td style={{ color: 'var(--a-muted)', fontSize: 12 }}>{ing.min_stock.toLocaleString('es', { maximumFractionDigits: 3 })}</td>
                    <td>
                      <span className={`stock-badge ${STATUS_CLASS[ing.status] ?? ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <IconDot color={STATUS_DOT[ing.status] ?? '#9ca3af'} />
                        {STATUS_LABEL[ing.status] ?? ing.status}
                        {(ing.status === 'BAJO' || ing.status === 'CRITICO') && <IconAlertTriangle />}
                      </span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 36, color: 'var(--a-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <IconPackage /><span style={{ fontSize: 13 }}>Sin resultados</span>
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal retiro */}
      {showForm && (
        <div onClick={(e) => e.target === e.currentTarget && setShowForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ background: 'var(--a-surface, #fff)', border: '1px solid var(--a-border, rgba(28,20,16,0.07))', borderRadius: 16, padding: 24, width: '100%', maxWidth: 560, maxHeight: '85vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--inv-teal-soft, rgba(45,212,191,0.12))', border: '1px solid var(--inv-teal-border, rgba(45,212,191,0.28))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--inv-teal, #2dd4bf)' }}>
                  <IconClipboardList />
                </div>
                <h3 style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 17, fontWeight: 900, margin: 0 }}>Retiro de turno</h3>
              </div>
              <button onClick={() => setShowForm(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: 'var(--a-surface-2, #F0F0F5)', border: '1px solid var(--a-border)', color: 'var(--a-muted)', cursor: 'pointer' }}>
                <IconX />
              </button>
            </div>

            <p style={{ fontSize: 12, color: 'var(--a-muted)', margin: 0 }}>
              Ingresa las cantidades que retirarás. Solo los campos con cantidad &gt; 0 se registran.
            </p>

            {ingredients.map((ing) => {
              const val = wdItems.find((i) => i.ingredient_id === ing.id)?.quantity_withdrawn ?? 0;
              const overLimit = val > ing.stock_quantity;
              return (
                <div key={ing.id} className="wd-form-item" style={{ gridTemplateColumns: '1fr 90px 36px auto' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{ing.name}</span>
                  <input
                    type="number" min="0" step="0.001" max={ing.stock_quantity}
                    value={val || ''} onChange={(e) => handleQtyChange(ing.id, parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 7, background: 'var(--a-surface, #fff)', border: `1px solid ${overLimit ? 'var(--inv-crit, #ef4444)' : 'var(--a-border, rgba(28,20,16,0.07))'}`, color: 'var(--a-text)', fontFamily: 'inherit', fontSize: 13, outline: 'none' }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--a-muted)', textAlign: 'center' }}>{ing.unit}</span>
                  <span style={{ fontSize: 11, color: overLimit ? 'var(--inv-crit, #ef4444)' : 'var(--a-muted)', whiteSpace: 'nowrap' }}>máx {ing.stock_quantity.toFixed(1)}</span>
                </div>
              );
            })}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <label style={{ fontSize: 11, color: 'var(--a-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Nota del turno (opcional)</label>
              <input value={wdNotes} onChange={(e) => setWdNotes(e.target.value)} placeholder="Ej: Turno mañana 08:00–16:00"
                style={{ padding: '8px 12px', borderRadius: 9, background: 'var(--a-surface, #fff)', border: '1px solid var(--a-border, rgba(28,20,16,0.07))', color: 'var(--a-text)', fontFamily: 'inherit', fontSize: 13, outline: 'none' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button className="admin-btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="admin-btn-teal" onClick={handleSubmitWithdrawal} disabled={submitting} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <IconCheckCircle /> {submitting ? 'Registrando...' : 'Confirmar retiro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
