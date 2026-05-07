// ============================================================
// frontend/src/pages/admin/SupplierManager.tsx  →  /admin/proveedores
// ============================================================

import { useEffect, useState } from 'react';
import AdminLayout             from '../../components/admin/AdminLayout';
import { useInventoryStore }   from '../../store/inventoryStore';
import { getSuppliers, createSupplier, updateSupplier } from '../../services/inventoryService';
import type { SupplierForm } from '../../types/inventory';
import '../../styles/admin.css';
import '../../styles/inventory.css';
import { useNavigate } from 'react-router-dom';
const EMPTY: SupplierForm = { name: '', contact_name: '', phone: '', email: '', address: '', is_active: true };

export default function SupplierManager() {
  const navigate = useNavigate();
  const { suppliers, supLoading, setSuppliers, setSupLoading, updateSupplierInList, setError } = useInventoryStore();
  const [form,   setForm]   = useState<SupplierForm | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSupLoading(true);
    getSuppliers().then(setSuppliers).catch((e: Error) => setError(e.message));
  }, []); // eslint-disable-line

  async function handleSave() {
    if (!form || !form.name.trim()) return;
    setSaving(true);
    try {
      if (editId) {
        const updated = await updateSupplier(editId, form);
        updateSupplierInList(updated);
      } else {
        const created = await createSupplier(form);
        setSuppliers([...suppliers, created]);
      }
      setForm(null); setEditId(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setSaving(false); }
  }

  return (
    <AdminLayout>
 <div className="admin-page-header">
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <button className="admin-btn-ghost" onClick={() => navigate(-1)}>
      ← Volver
    </button>
    <div>
      <h1 className="admin-page-title">Proveedores</h1>
      <p className="admin-page-sub">{suppliers.length} proveedores registrados</p>
    </div>
  </div>
  <button className="admin-btn-teal" onClick={() => { setForm(EMPTY); setEditId(null); }}>
    + Proveedor
  </button>
</div>

        {form && (
          <div className="admin-form-card">
            <h3 className="admin-form-title">{editId ? 'Editar proveedor' : 'Nuevo proveedor'}</h3>
            <div className="admin-form-grid">
              <div className="admin-field">
                <label>Nombre *</label>
                <input className="admin-input" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre del proveedor"/>
              </div>
              <div className="admin-field">
                <label>Contacto</label>
                <input className="admin-input" value={form.contact_name}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })} placeholder="Nombre del contacto"/>
              </div>
              <div className="admin-field">
                <label>Teléfono</label>
                <input className="admin-input" value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+57 300 000 0000"/>
              </div>
              <div className="admin-field">
                <label>Email</label>
                <input className="admin-input" type="email" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@proveedor.com"/>
              </div>
              <div className="admin-field admin-field--full">
                <label>Dirección</label>
                <input className="admin-input" value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Dirección"/>
              </div>
            </div>
            <div className="admin-form-actions">
              <button className="admin-btn-ghost" onClick={() => { setForm(null); setEditId(null); }}>Cancelar</button>
              <button className="admin-btn-teal" onClick={handleSave} disabled={!form.name || saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}

        {supLoading ? (
          <div className="admin-loading"><div className="inv-spinner"/></div>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Nombre</th><th>Contacto</th><th>Teléfono</th><th>Email</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>{s.contact_name ?? '—'}</td>
                    <td>{s.phone ?? '—'}</td>
                    <td style={{ fontSize: 12 }}>{s.email ?? '—'}</td>
                    <td>
                      <button className="admin-btn-sm" onClick={() => {
                        setForm({ name: s.name, contact_name: s.contact_name ?? '', phone: s.phone ?? '',
                          email: s.email ?? '', address: s.address ?? '', is_active: s.is_active });
                        setEditId(s.id);
                      }}>Editar</button>
                    </td>
                  </tr>
                ))}
                {suppliers.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 28, color: 'var(--a-muted)' }}>
                    Sin proveedores aún
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      
    </AdminLayout>
  );
}