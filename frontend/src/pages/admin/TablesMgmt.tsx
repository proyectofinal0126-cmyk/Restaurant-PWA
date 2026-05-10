// ============================================================
// frontend/src/pages/admin/TablesMgmt.tsx  →  /admin/mesas
// CRUD de mesas: crear, editar, eliminar, ver estado
// ============================================================

import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { apiFetch } from '../../services/api';
import '../../styles/admin.css';

interface Table {
  id:         string;
  number:     number;
  capacity:   number;
  section:    string | null;
  status:     'available' | 'occupied' | 'reserved' | 'waiting_bill';
  created_at: string;
}

interface TableForm {
  number:   number;
  capacity: number;
  section:  string;
}

const EMPTY_FORM: TableForm = { number: 1, capacity: 4, section: '' };

const STATUS_LABEL: Record<string, string> = {
  available:    'Disponible',
  occupied:     'Ocupada',
  reserved:     'Reservada',
  waiting_bill: 'Esperando cobro',
};

const STATUS_COLOR: Record<string, string> = {
  available:    '#22c55e',
  occupied:     '#f59e0b',
  reserved:     '#3b82f6',
  waiting_bill: '#ef4444',
};

export default function TablesMgmt() {
  const [tables,  setTables]  = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [form,    setForm]    = useState<TableForm | null>(null);
  const [editId,  setEditId]  = useState<string | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ id: string; number: number } | null>(null);

  useEffect(() => { loadTables(); }, []);

  async function loadTables() {
    setLoading(true);
    try {
      const data = await apiFetch<Table[]>('/tables');
      setTables(data.sort((a, b) => a.number - b.number));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar mesas');
    } finally { setLoading(false); }
  }

  async function handleSave() {
    if (!form) return;
    if (!form.number || form.number < 1) { setError('El número de mesa es requerido'); return; }
    if (!form.capacity || form.capacity < 1) { setError('La capacidad es requerida'); return; }
    setSaving(true);
    setError(null);
    try {
      if (editId) {
        await apiFetch(`/tables/${editId}`, { method: 'PUT', body: JSON.stringify(form) });
        showSuccess('Mesa actualizada correctamente');
      } else {
        await apiFetch('/tables', { method: 'POST', body: JSON.stringify(form) });
        showSuccess('Mesa creada correctamente');
      }
      setForm(null); setEditId(null);
      loadTables();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    setSaving(true);
    try {
      await apiFetch(`/tables/${id}`, { method: 'DELETE' });
      setConfirm(null);
      showSuccess('Mesa eliminada correctamente');
      loadTables();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    } finally { setSaving(false); }
  }

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  }

  const sections = [...new Set(tables.map(t => t.section).filter(Boolean))] as string[];

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">Gestión de Mesas</h1>
            <p className="admin-page-sub">{tables.length} mesas registradas</p>
          </div>
          <button
            className="admin-btn-primary"
            onClick={() => { setForm(EMPTY_FORM); setEditId(null); setError(null); }}
          >
            + Nueva mesa
          </button>
        </div>

        {/* Banners */}
        {success && (
          <div className="admin-success-banner">{success}</div>
        )}
        {error && (
          <div className="admin-error-banner" style={{ display: 'flex', justifyContent: 'space-between' }}>
            {error}
            <button onClick={() => setError(null)} style={{ color: 'inherit', fontSize: 18 }}>×</button>
          </div>
        )}

        {/* Formulario */}
        {form && (
          <div className="admin-form-card">
            <h3 className="admin-form-title">{editId ? 'Editar mesa' : 'Nueva mesa'}</h3>
            <div className="admin-form-grid">
              <div className="admin-field">
                <label>Número de mesa *</label>
                <input
                  className="admin-input"
                  type="number"
                  min={1}
                  value={form.number}
                  onChange={(e) => setForm({ ...form, number: parseInt(e.target.value) || 1 })}
                  placeholder="Ej: 1"
                />
              </div>
              <div className="admin-field">
                <label>Capacidad (personas) *</label>
                <input
                  className="admin-input"
                  type="number"
                  min={1}
                  max={20}
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 1 })}
                  placeholder="Ej: 4"
                />
              </div>
              <div className="admin-field">
                <label>Sección</label>
                <input
                  className="admin-input"
                  value={form.section}
                  onChange={(e) => setForm({ ...form, section: e.target.value })}
                  placeholder="Ej: Salón principal, Terraza, Privado"
                  list="sections-list"
                />
                <datalist id="sections-list">
                  {sections.map(s => <option key={s} value={s} />)}
                </datalist>
              </div>
            </div>
            <div className="admin-form-actions">
              <button className="admin-btn-ghost" onClick={() => { setForm(null); setEditId(null); }}>
                Cancelar
              </button>
              <button
                className="admin-btn-primary"
                onClick={handleSave}
                disabled={saving || !form.number || !form.capacity}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}

        {/* Tabla de mesas */}
        {loading ? (
          <div className="admin-loading"><div className="admin-spinner" /></div>
        ) : (
          <>
            {/* Resumen por estado */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {Object.entries(STATUS_LABEL).map(([status, label]) => {
                const count = tables.filter(t => t.status === status).length;
                return (
                  <div key={status} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 16px', borderRadius: 10,
                    background: `${STATUS_COLOR[status]}18`,
                    border: `1px solid ${STATUS_COLOR[status]}40`,
                    fontSize: 13,
                  }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[status], flexShrink: 0 }} />
                    <span style={{ color: STATUS_COLOR[status], fontWeight: 600 }}>{count}</span>
                    <span style={{ color: 'var(--a-muted)' }}>{label}</span>
                  </div>
                );
              })}
            </div>

            {/* Lista */}
            <div className="admin-list">
              {/* Header */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '80px 1fr 100px 140px 100px 140px',
                gap: 12, padding: '8px 16px',
                fontSize: 11, color: 'var(--a-muted)', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.4px',
                borderBottom: '1px solid var(--a-border)',
              }}>
                <span>Mesa</span>
                <span>Sección</span>
                <span>Capacidad</span>
                <span>Estado</span>
                <span>Creada</span>
                <span style={{ textAlign: 'right' }}>Acciones</span>
              </div>

              {tables.map((table) => (
                <div key={table.id} className="admin-list-row" style={{
                  display: 'grid',
                  gridTemplateColumns: '80px 1fr 100px 140px 100px 140px',
                  gap: 12, alignItems: 'center',
                }}>
                  {/* Número */}
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'var(--a-surface-2)',
                    border: '1px solid var(--a-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Cabinet Grotesk', sans-serif",
                    fontSize: 16, fontWeight: 900,
                  }}>
                    {table.number}
                  </div>

                  {/* Sección */}
                  <span style={{ fontSize: 13, color: 'var(--a-muted)' }}>
                    {table.section || '—'}
                  </span>

                  {/* Capacidad */}
                  <span style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                      <circle cx="6.5" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M1 12c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    {table.capacity} personas
                  </span>

                  {/* Estado */}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    fontSize: 12, fontWeight: 600,
                    padding: '4px 10px', borderRadius: 100,
                    background: `${STATUS_COLOR[table.status]}18`,
                    border: `1px solid ${STATUS_COLOR[table.status]}40`,
                    color: STATUS_COLOR[table.status],
                    width: 'fit-content',
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[table.status] }} />
                    {STATUS_LABEL[table.status]}
                  </span>

                  {/* Fecha */}
                  <span style={{ fontSize: 11, color: 'var(--a-muted)' }}>
{table.created_at
  ? new Date(table.created_at).toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' })
  : new Date().toLocaleDateString('es', { day: '2-digit', month: '2-digit', year: '2-digit' })}                  </span>

                  {/* Acciones */}
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button
                      className="admin-btn-sm"
                      onClick={() => {
                        setForm({ number: table.number, capacity: table.capacity, section: table.section ?? '' });
                        setEditId(table.id);
                        setError(null);
                      }}
                    >
                      Editar
                    </button>
                    <button
                      className="admin-btn-sm admin-btn-danger"
                      onClick={() => setConfirm({ id: table.id, number: table.number })}
                      disabled={table.status !== 'available'}
                      title={table.status !== 'available' ? 'Solo se pueden eliminar mesas disponibles' : ''}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}

              {tables.length === 0 && (
                <p className="admin-empty-msg">No hay mesas registradas. Crea la primera.</p>
              )}
            </div>
          </>
        )}

        {/* Modal confirmación eliminar */}
        {confirm && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setConfirm(null)}>
            <div className="admin-confirm-modal">
              <h3>¿Eliminar mesa {confirm.number}?</h3>
              <p>Esta acción no se puede deshacer. Solo se pueden eliminar mesas con estado <strong>Disponible</strong>.</p>
              <div className="admin-form-actions">
                <button className="admin-btn-ghost" onClick={() => setConfirm(null)}>Cancelar</button>
                <button
                  className="admin-btn-danger"
                  onClick={() => handleDelete(confirm.id)}
                  disabled={saving}
                >
                  {saving ? 'Eliminando...' : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
