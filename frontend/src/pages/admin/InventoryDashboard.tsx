// ============================================================
// frontend/src/pages/admin/InventoryDashboard.tsx  →  /admin/inventario
//
// Vista principal de la bodega. Muestra:
//   - KPIs (total ingredientes, bajo stock, valor estimado)
//   - Banner de alertas integrado
//   - Tabla de ingredientes con acciones rápidas
//   - Modales: crear/editar ingrediente, entrada, ajuste, historial
// ============================================================

import { useEffect, useState, useCallback } from 'react';
import { useNavigate }         from 'react-router-dom';
import AdminLayout             from '../../components/admin/AdminLayout';
import { useInventoryStore }   from '../../store/inventoryStore';
import {
  getIngredients, createIngredient, updateIngredient,
  deleteIngredient, registerEntry, registerAdjustment,
  getSuppliers, getLowStock,
} from '../../services/inventoryService';
import type { Ingredient, IngredientForm, StockEntryForm, StockAdjustmentForm } from '../../types/inventory';
import '../../styles/admin.css';
import '../../styles/inventory.css';

const UNITS = ['kg', 'g', 'l', 'ml', 'und', 'porciones', 'litros', 'bolsas', 'cajas'];

const EMPTY_ING: IngredientForm = {
  name: '', unit: 'kg', stock_quantity: 0, min_stock: 0,
  cost_per_unit: 0, supplier_id: '', is_active: true,
};

const STATUS_LABEL: Record<string, string> = {
  OK: '🟢 OK', BAJO: '🟡 Bajo', CRITICO: '🔴 Crítico', AGOTADO: '⚫ Agotado',
};

function StockBadge({ status }: { status: string }) {
  const cls = { OK:'ok', BAJO:'bajo', CRITICO:'crit', AGOTADO:'oot' }[status] ?? 'oot';
  return <span className={`stock-badge stock-badge--${cls}`}>{STATUS_LABEL[status] ?? status}</span>;
}

export default function InventoryDashboard() {
  const navigate = useNavigate();
  const {
    ingredients, ingLoading, suppliers, lowStockCount,
    setIngredients, setIngLoading, setSuppliers, setLowStock,
    updateIngredientInList, removeIngredientFromList, setError,
  } = useInventoryStore();

  // ── Modales ──────────────────────────────────────────────
  const [ingForm,    setIngForm]    = useState<IngredientForm | null>(null);
  const [editIngId,  setEditIngId]  = useState<string | null>(null);
  const [entryForm,  setEntryForm]  = useState<StockEntryForm | null>(null);
  const [adjForm,    setAdjForm]    = useState<StockAdjustmentForm | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [search,     setSearch]     = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = useCallback(() => {
    setIngLoading(true);
    getIngredients({ search: search || undefined, status: filterStatus || undefined })
      .then(setIngredients)
      .catch((e: Error) => setError(e.message));
    getSuppliers().then(setSuppliers).catch(() => {});
    getLowStock().then(setLowStock).catch(() => {});
  }, [search, filterStatus]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  // ── Guardar ingrediente ──────────────────────────────────
  async function handleSaveIng() {
    if (!ingForm) return;
    setSaving(true);
    try {
      if (editIngId) {
        const updated = await updateIngredient(editIngId, ingForm);
        updateIngredientInList(updated);
      } else {
        const created = await createIngredient(ingForm);
        setIngredients([...ingredients, created]);
      }
      setIngForm(null); setEditIngId(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setSaving(false); }
  }

  // ── Soft delete ──────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!confirm('¿Desactivar este ingrediente?')) return;
    try {
      await deleteIngredient(id);
      removeIngredientFromList(id);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error'); }
  }

  // ── Registrar entrada ────────────────────────────────────
  async function handleEntry() {
    if (!entryForm || !entryForm.ingredient_id || entryForm.quantity <= 0) return;
    setSaving(true);
    try {
      await registerEntry(entryForm);
      setEntryForm(null);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al registrar entrada');
    } finally { setSaving(false); }
  }

  // ── Registrar ajuste ─────────────────────────────────────
  async function handleAdj() {
    if (!adjForm || !adjForm.ingredient_id || !adjForm.notes?.trim()) return;
    setSaving(true);
    try {
      await registerAdjustment(adjForm);
      setAdjForm(null);
      load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al registrar ajuste');
    } finally { setSaving(false); }
  }

  // ── KPIs ─────────────────────────────────────────────────
  const totalActivos = ingredients.filter((i) => i.is_active).length;
  const totalBajo    = ingredients.filter((i) => i.status === 'BAJO' || i.status === 'CRITICO' || i.status === 'AGOTADO').length;
  const valorEst     = ingredients.reduce((s, i) => s + i.stock_quantity * i.cost_per_unit, 0);

  return (
    <AdminLayout>
      <div className="admin-page">

        {/* Header */}
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">Bodega / Inventario</h1>
            <p className="admin-page-sub">Control de materia prima y stock</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="admin-btn-ghost" onClick={() => navigate('/admin/proveedores')}>
              🏭 Proveedores
            </button>
            <button className="admin-btn-ghost" onClick={() => navigate('/admin/recetas')}>
              📋 Recetas
            </button>
            <button className="admin-btn-ghost" onClick={() => navigate('/admin/inventario/movimientos')}>
              📊 Historial
            </button>
            <button className="admin-btn-teal" onClick={() => { setIngForm(EMPTY_ING); setEditIngId(null); }}>
              + Ingrediente
            </button>
          </div>
        </div>

        {/* Banner alertas */}
        {lowStockCount > 0 && (
          <div className="low-stock-banner">
            <span className="lsb-icon">⚠️</span>
            <span className="lsb-text">
              {totalBajo} ingrediente{totalBajo > 1 ? 's' : ''} con stock bajo o crítico
            </span>
            <span className="lsb-count">{totalBajo}</span>
          </div>
        )}

        {/* KPIs */}
        <div className="inv-kpi-grid">
          <div className="inv-kpi-card kpi-teal">
            <span className="inv-kpi-label">Total ingredientes</span>
            <span className="inv-kpi-val">{totalActivos}</span>
          </div>
          <div className="inv-kpi-card">
            <span className="inv-kpi-label">Alertas de stock</span>
            <span className="inv-kpi-val" style={{ color: totalBajo > 0 ? 'var(--inv-crit)' : 'inherit' }}>{totalBajo}</span>
          </div>
          <div className="inv-kpi-card">
            <span className="inv-kpi-label">Valor estimado bodega</span>
            <span className="inv-kpi-val" style={{ fontSize: 20 }}>${valorEst.toLocaleString('es-CO', { maximumFractionDigits: 0 })}</span>
          </div>
        </div>

        {/* Filtros */}
        <div className="inv-filters">
          <div className="admin-search-wrap" style={{ flex: 1, maxWidth: 320 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <input className="admin-search" placeholder="Buscar ingrediente..." value={search}
              onChange={(e) => setSearch(e.target.value)}/>
          </div>
          <select className="admin-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="OK">🟢 OK</option>
            <option value="BAJO">🟡 Bajo</option>
            <option value="CRITICO">🔴 Crítico</option>
            <option value="AGOTADO">⚫ Agotado</option>
          </select>
          <button className="admin-btn-ghost" onClick={load}>↺ Actualizar</button>
        </div>

        {/* Tabla */}
        {ingLoading ? (
          <div className="admin-loading"><div className="inv-spinner"/><p>Cargando bodega...</p></div>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Ingrediente</th>
                  <th>Unidad</th>
                  <th>Stock</th>
                  <th>Mínimo</th>
                  <th>Estado</th>
                  <th>Proveedor</th>
                  <th>Costo/Unidad</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.map((ing) => (
                  <tr key={ing.id}>
                    <td style={{ fontWeight: 600 }}>{ing.name}</td>
                    <td>{ing.unit}</td>
                    <td style={{ fontFamily: "'Cabinet Grotesk', sans-serif", fontSize: 15, fontWeight: 700 }}>
                      {ing.stock_quantity.toLocaleString('es', { maximumFractionDigits: 3 })}
                    </td>
                    <td style={{ color: 'var(--a-muted)' }}>
                      {ing.min_stock.toLocaleString('es', { maximumFractionDigits: 3 })}
                    </td>
                    <td><StockBadge status={ing.status} /></td>
                    <td style={{ color: 'var(--a-muted)', fontSize: 12 }}>{ing.supplier_name ?? '—'}</td>
                    <td style={{ fontSize: 12 }}>${ing.cost_per_unit.toLocaleString('es-CO')}</td>
                    <td>
                      <div className="alr-actions">
                        <button className="admin-btn-sm" onClick={() => setEntryForm({ ingredient_id: ing.id, quantity: 0, notes: '' })}>
                          +Entrada
                        </button>
                        <button className="admin-btn-sm" onClick={() => setAdjForm({ ingredient_id: ing.id, quantity: 0, notes: '' })}>
                          Ajuste
                        </button>
                        <button className="admin-btn-sm" onClick={() => {
                          setIngForm({
                            name: ing.name, unit: ing.unit, stock_quantity: ing.stock_quantity,
                            min_stock: ing.min_stock, cost_per_unit: ing.cost_per_unit,
                            supplier_id: ing.supplier_id ?? '', is_active: ing.is_active,
                          });
                          setEditIngId(ing.id);
                        }}>Editar</button>
                        <button className="admin-btn-sm admin-btn-danger" onClick={() => handleDelete(ing.id)}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {ingredients.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--a-muted)' }}>
                    Sin ingredientes. Haz clic en "+ Ingrediente" para agregar uno.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Modal: Crear/Editar Ingrediente ── */}
        {ingForm && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setIngForm(null)}>
            <div className="admin-confirm-modal" style={{ maxWidth: 520 }}>
              <h3>{editIngId ? 'Editar ingrediente' : 'Nuevo ingrediente'}</h3>
              <div className="admin-form-grid">
                <div className="admin-field">
                  <label>Nombre *</label>
                  <input className="admin-input" value={ingForm.name}
                    onChange={(e) => setIngForm({ ...ingForm, name: e.target.value })}
                    placeholder="Ej: Carne molida"/>
                </div>
                <div className="admin-field">
                  <label>Unidad *</label>
                  <select className="admin-select" value={ingForm.unit}
                    onChange={(e) => setIngForm({ ...ingForm, unit: e.target.value })}>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="admin-field">
                  <label>Stock inicial</label>
                  <input className="admin-input" type="number" min="0" step="0.001"
                    value={ingForm.stock_quantity}
                    onChange={(e) => setIngForm({ ...ingForm, stock_quantity: parseFloat(e.target.value) || 0 })}/>
                </div>
                <div className="admin-field">
                  <label>Stock mínimo *</label>
                  <input className="admin-input" type="number" min="0" step="0.001"
                    value={ingForm.min_stock}
                    onChange={(e) => setIngForm({ ...ingForm, min_stock: parseFloat(e.target.value) || 0 })}/>
                </div>
                <div className="admin-field">
                  <label>Costo por unidad ($)</label>
                  <input className="admin-input" type="number" min="0" step="0.01"
                    value={ingForm.cost_per_unit}
                    onChange={(e) => setIngForm({ ...ingForm, cost_per_unit: parseFloat(e.target.value) || 0 })}/>
                </div>
                <div className="admin-field">
                  <label>Proveedor</label>
                  <select className="admin-select" value={ingForm.supplier_id}
                    onChange={(e) => setIngForm({ ...ingForm, supplier_id: e.target.value })}>
                    <option value="">Sin proveedor</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="admin-form-actions">
                <button className="admin-btn-ghost" onClick={() => setIngForm(null)}>Cancelar</button>
                <button className="admin-btn-teal" onClick={handleSaveIng}
                  disabled={!ingForm.name || !ingForm.unit || saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal: Entrada de mercancía ── */}
        {entryForm && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setEntryForm(null)}>
            <div className="admin-confirm-modal" style={{ maxWidth: 400 }}>
              <h3>📦 Registrar entrada</h3>
              <p style={{ fontSize: 13, color: 'var(--a-muted)' }}>
                {ingredients.find((i) => i.id === entryForm.ingredient_id)?.name}
                {' — Stock actual: '}
                {ingredients.find((i) => i.id === entryForm.ingredient_id)?.stock_quantity}
                {' '}
                {ingredients.find((i) => i.id === entryForm.ingredient_id)?.unit}
              </p>
              <div className="admin-field">
                <label>Cantidad recibida *</label>
                <input className="admin-input" type="number" min="0.001" step="0.001"
                  value={entryForm.quantity || ''}
                  onChange={(e) => setEntryForm({ ...entryForm, quantity: parseFloat(e.target.value) || 0 })}
                  autoFocus/>
              </div>
              <div className="admin-field">
                <label>Nota (ej: Factura #123)</label>
                <input className="admin-input" value={entryForm.notes}
                  onChange={(e) => setEntryForm({ ...entryForm, notes: e.target.value })}
                  placeholder="Opcional"/>
              </div>
              <div className="admin-form-actions">
                <button className="admin-btn-ghost" onClick={() => setEntryForm(null)}>Cancelar</button>
                <button className="admin-btn-teal" onClick={handleEntry}
                  disabled={!entryForm.quantity || entryForm.quantity <= 0 || saving}>
                  {saving ? 'Registrando...' : 'Registrar entrada'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal: Ajuste manual ── */}
        {adjForm && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setAdjForm(null)}>
            <div className="admin-confirm-modal" style={{ maxWidth: 400 }}>
              <h3>🔧 Ajuste de stock</h3>
              <p style={{ fontSize: 12, color: 'var(--a-muted)' }}>
                Usa valores negativos para mermas. La justificación es obligatoria.
              </p>
              <div className="admin-field">
                <label>Cantidad a ajustar (+ o −) *</label>
                <input className="admin-input" type="number" step="0.001"
                  value={adjForm.quantity || ''}
                  onChange={(e) => setAdjForm({ ...adjForm, quantity: parseFloat(e.target.value) || 0 })}
                  autoFocus/>
              </div>
              <div className="admin-field">
                <label>Justificación * (obligatoria)</label>
                <input className="admin-input" value={adjForm.notes}
                  onChange={(e) => setAdjForm({ ...adjForm, notes: e.target.value })}
                  placeholder="Ej: Merma por caducidad, corrección de conteo..."/>
              </div>
              <div className="admin-form-actions">
                <button className="admin-btn-ghost" onClick={() => setAdjForm(null)}>Cancelar</button>
                <button className="admin-btn-primary" onClick={handleAdj}
                  disabled={adjForm.quantity === 0 || !adjForm.notes?.trim() || saving}>
                  {saving ? 'Guardando...' : 'Aplicar ajuste'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}