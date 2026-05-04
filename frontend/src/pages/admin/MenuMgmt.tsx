import { formatCOP } from '../../utils/constants';
// ============================================================
// frontend/src/pages/admin/MenuMgmt.tsx  →  /admin/menu
//
// Propósito: Gestión completa del menú. CRUD de categorías e ítems.
//   Toggle de disponibilidad, precios, tiempos de preparación.
//
// Flujo de datos:
//   1. Carga categorías → GET /api/admin/menu/categories
//   2. Al seleccionar categoría → GET /api/admin/menu/items?category=:id
//   3. Formularios inline para crear/editar
//   4. Toggle switch para is_available e is_out_of_stock
// ============================================================

import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAdminStore } from '../../store/adminStore';
import {
  getAdminCategories, getAdminItems,
  createCategory, updateCategory, deleteCategory,
  createMenuItem, updateMenuItem, deleteMenuItem,
  toggleItemAvailability,
} from '../../services/adminService';
import type { AdminCategory, AdminMenuItem, CategoryForm, MenuItemForm } from '../../types/admin';

const EMPTY_CAT: CategoryForm = { name: '', description: '', icon: '', position: 1, is_active: true };
const EMPTY_ITEM: MenuItemForm = { category_id: '', name: '', description: '', price: 0, preparation_time: 10, is_available: true, is_out_of_stock: false };

export default function MenuMgmt() {
  const {
    categories, items, menuLoading, activeCategory,
    setCategories, setItems, setMenuLoading, setActiveCategory,
    updateCategoryInList, removeCategoryFromList,
    updateItemInList, removeItemFromList, setError,
  } = useAdminStore();

  const [tab, setTab]             = useState<'categories' | 'items'>('categories');
  const [catForm, setCatForm]     = useState<CategoryForm | null>(null);
  const [itemForm, setItemForm]   = useState<MenuItemForm | null>(null);
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [confirm, setConfirm]     = useState<{ type: 'cat' | 'item'; id: string; name: string } | null>(null);

  // Carga categorías
  useEffect(() => {
    setMenuLoading(true);
    getAdminCategories()
      .then(setCategories)
      .catch((e: Error) => setError(e.message));
  }, []); // eslint-disable-line

  // Carga items al cambiar categoría activa
  useEffect(() => {
    if (tab !== 'items') return;
    setMenuLoading(true);
    getAdminItems(activeCategory ?? undefined)
      .then(setItems)
      .catch((e: Error) => setError(e.message))
      .finally(() => setMenuLoading(false));
  }, [activeCategory, tab]); // eslint-disable-line

  // ── Categorías ────────────────────────────────────────────
  async function handleSaveCat() {
    if (!catForm) return;
    setSaving(true);
    try {
      if (editCatId) {
        const updated = await updateCategory(editCatId, catForm);
        updateCategoryInList(updated);
      } else {
        const created = await createCategory(catForm);
        setCategories([...categories, created]);
      }
      setCatForm(null); setEditCatId(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setSaving(false); }
  }

  async function handleDeleteCat(id: string) {
    setSaving(true);
    try {
      await deleteCategory(id);
      removeCategoryFromList(id);
      setConfirm(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    } finally { setSaving(false); }
  }

  // ── Items ─────────────────────────────────────────────────
  async function handleSaveItem() {
    if (!itemForm) return;
    setSaving(true);
    try {
      if (editItemId) {
        const updated = await updateMenuItem(editItemId, itemForm);
        updateItemInList(updated);
      } else {
        const created = await createMenuItem(itemForm);
        setItems([...items, created]);
      }
      setItemForm(null); setEditItemId(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally { setSaving(false); }
  }

  async function handleDeleteItem(id: string) {
    setSaving(true);
    try {
      await deleteMenuItem(id);
      removeItemFromList(id);
      setConfirm(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    } finally { setSaving(false); }
  }

  async function handleToggleAvailable(item: AdminMenuItem) {
    try {
      const updated = await toggleItemAvailability(item.id, !item.is_available);
      updateItemInList(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al actualizar disponibilidad');
    }
  }

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">Gestión de Menú</h1>
            <p className="admin-page-sub">{categories.length} categorías · {items.length} ítems</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="admin-tabs">
          <button className={`admin-tab ${tab === 'categories' ? 'admin-tab--active' : ''}`}
            onClick={() => setTab('categories')}>
            Categorías
          </button>
          <button className={`admin-tab ${tab === 'items' ? 'admin-tab--active' : ''}`}
            onClick={() => setTab('items')}>
            Ítems del menú
          </button>
        </div>

        {/* ── CATEGORÍAS ── */}
        {tab === 'categories' && (
          <div className="admin-section">
            <div className="admin-section-header">
              <h2 className="admin-section-title">Categorías</h2>
              <button
                className="admin-btn-primary"
                onClick={() => { setCatForm(EMPTY_CAT); setEditCatId(null); }}
              >
                + Nueva categoría
              </button>
            </div>

            {/* Formulario inline */}
            {catForm && (
              <div className="admin-form-card">
                <h3 className="admin-form-title">{editCatId ? 'Editar categoría' : 'Nueva categoría'}</h3>
                <div className="admin-form-grid">
                  <div className="admin-field">
                    <label>Nombre *</label>
                    <input className="admin-input" value={catForm.name}
                      onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                      placeholder="Ej: Entradas" maxLength={100}/>
                  </div>
                  <div className="admin-field">
                    <label>Ícono (emoji)</label>
                    <input className="admin-input" value={catForm.icon}
                      onChange={(e) => setCatForm({ ...catForm, icon: e.target.value })}
                      placeholder="🍕" maxLength={10}/>
                  </div>
                  <div className="admin-field">
                    <label>Posición</label>
                    <input className="admin-input" type="number" min={1} value={catForm.position}
                      onChange={(e) => setCatForm({ ...catForm, position: parseInt(e.target.value) || 1 })}/>
                  </div>
                  <div className="admin-field admin-field--full">
                    <label>Descripción</label>
                    <input className="admin-input" value={catForm.description}
                      onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                      placeholder="Descripción opcional" maxLength={200}/>
                  </div>
                  <div className="admin-field admin-field--toggle">
                    <label>Activa</label>
                    <button
                      type="button"
                      className={`admin-toggle ${catForm.is_active ? 'admin-toggle--on' : ''}`}
                      onClick={() => setCatForm({ ...catForm, is_active: !catForm.is_active })}
                    />
                  </div>
                </div>
                <div className="admin-form-actions">
                  <button className="admin-btn-ghost" onClick={() => { setCatForm(null); setEditCatId(null); }}>
                    Cancelar
                  </button>
                  <button className="admin-btn-primary" onClick={handleSaveCat} disabled={!catForm.name || saving}>
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            )}

            {/* Lista */}
            {menuLoading ? <div className="admin-loading"><div className="admin-spinner"/></div> : (
              <div className="admin-list">
                {categories.map((cat) => (
                  <div key={cat.id} className={`admin-list-row ${!cat.is_active ? 'row-inactive' : ''}`}>
                    <div className="alr-main">
                      <span className="alr-icon">{cat.icon || '📂'}</span>
                      <div>
                        <p className="alr-name">{cat.name}</p>
                        <p className="alr-sub">{cat.items_count} ítems · pos. {cat.position}</p>
                      </div>
                    </div>
                    <div className="alr-meta">{cat.is_active ? '✅ Activa' : '⏸ Inactiva'}</div>
                    <div className="alr-actions">
                      <button className="admin-btn-sm" onClick={() => {
                        setCatForm({ name: cat.name, description: cat.description ?? '', icon: cat.icon ?? '', position: cat.position, is_active: cat.is_active });
                        setEditCatId(cat.id);
                      }}>Editar</button>
                      <button className="admin-btn-sm admin-btn-danger" onClick={() =>
                        setConfirm({ type: 'cat', id: cat.id, name: cat.name })
                      }>Eliminar</button>
                    </div>
                  </div>
                ))}
                {categories.length === 0 && <p className="admin-empty-msg">Sin categorías aún</p>}
              </div>
            )}
          </div>
        )}

        {/* ── ITEMS ── */}
        {tab === 'items' && (
          <div className="admin-section">
            <div className="admin-section-header">
              {/* Filtro por categoría */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 className="admin-section-title">Ítems</h2>
                <select
                  className="admin-select"
                  value={activeCategory ?? ''}
                  onChange={(e) => setActiveCategory(e.target.value || null)}
                >
                  <option value="">Todas las categorías</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <button
                className="admin-btn-primary"
                onClick={() => {
                  setItemForm({ ...EMPTY_ITEM, category_id: activeCategory ?? '' });
                  setEditItemId(null);
                }}
              >
                + Nuevo ítem
              </button>
            </div>

            {/* Formulario inline */}
            {itemForm && (
              <div className="admin-form-card">
                <h3 className="admin-form-title">{editItemId ? 'Editar ítem' : 'Nuevo ítem'}</h3>
                <div className="admin-form-grid">
                  <div className="admin-field">
                    <label>Categoría *</label>
                    <select className="admin-select" value={itemForm.category_id}
                      onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value })}>
                      <option value="">Seleccionar...</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="admin-field">
                    <label>Nombre *</label>
                    <input className="admin-input" value={itemForm.name}
                      onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                      placeholder="Ej: Hamburguesa Clásica" maxLength={100}/>
                  </div>
                  <div className="admin-field">
                    <label>Precio *</label>
                    <input className="admin-input" type="number" min={0} step="0.01" value={itemForm.price}
                      onChange={(e) => setItemForm({ ...itemForm, price: parseFloat(e.target.value) || 0 })}/>
                  </div>
                  <div className="admin-field">
                    <label>Tiempo prep. (min)</label>
                    <input className="admin-input" type="number" min={0} value={itemForm.preparation_time}
                      onChange={(e) => setItemForm({ ...itemForm, preparation_time: parseInt(e.target.value) || 0 })}/>
                  </div>
                  <div className="admin-field admin-field--full">
                    <label>Descripción</label>
                    <input className="admin-input" value={itemForm.description}
                      onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                      placeholder="Descripción del ítem" maxLength={300}/>
                  </div>
                  <div className="admin-field admin-field--toggle">
                    <label>Disponible</label>
                    <button type="button"
                      className={`admin-toggle ${itemForm.is_available ? 'admin-toggle--on' : ''}`}
                      onClick={() => setItemForm({ ...itemForm, is_available: !itemForm.is_available })}/>
                  </div>
                  <div className="admin-field admin-field--toggle">
                    <label>Agotado</label>
                    <button type="button"
                      className={`admin-toggle admin-toggle--danger ${itemForm.is_out_of_stock ? 'admin-toggle--on' : ''}`}
                      onClick={() => setItemForm({ ...itemForm, is_out_of_stock: !itemForm.is_out_of_stock })}/>
                  </div>
                </div>
                <div className="admin-form-actions">
                  <button className="admin-btn-ghost" onClick={() => { setItemForm(null); setEditItemId(null); }}>Cancelar</button>
                  <button className="admin-btn-primary" onClick={handleSaveItem}
                    disabled={!itemForm.name || !itemForm.category_id || itemForm.price <= 0 || saving}>
                    {saving ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
              </div>
            )}

            {/* Lista items */}
            {menuLoading ? <div className="admin-loading"><div className="admin-spinner"/></div> : (
              <div className="admin-list">
                {items.map((item) => (
                  <div key={item.id} className={`admin-list-row ${!item.is_available ? 'row-inactive' : ''}`}>
                    <div className="alr-main">
                      <div className="alr-item-img">
                        {item.image_url
                          ? <img src={item.image_url} alt={item.name} className="alr-img"/>
                          : <span>🍽️</span>
                        }
                      </div>
                      <div>
                        <p className="alr-name">{item.name}</p>
                        <p className="alr-sub">{item.category_name} · ~{item.preparation_time}min</p>
                      </div>
                    </div>
                    <div className="alr-price">{formatCOP(parseFloat(item.price as unknown as string))}</div>
                    <div className="alr-meta">
                      <button
                        type="button"
                        className={`admin-toggle admin-toggle--sm ${item.is_available ? 'admin-toggle--on' : ''}`}
                        onClick={() => handleToggleAvailable(item)}
                        title={item.is_available ? 'Deshabilitar' : 'Habilitar'}
                      />
                      <span className="alr-avail-label">{item.is_available ? 'Disponible' : 'No disponible'}</span>
                      {item.is_out_of_stock && <span className="alr-oos">Agotado</span>}
                    </div>
                    <div className="alr-actions">
                      <button className="admin-btn-sm" onClick={() => {
                        setItemForm({
                          category_id:      item.category_id,
                          name:             item.name,
                          description:      item.description ?? '',
                          price:            parseFloat(item.price as unknown as string),
                          preparation_time: item.preparation_time ?? 0,
                          is_available:     item.is_available,
                          is_out_of_stock:  item.is_out_of_stock,
                        });
                        setEditItemId(item.id);
                      }}>Editar</button>
                      <button className="admin-btn-sm admin-btn-danger" onClick={() =>
                        setConfirm({ type: 'item', id: item.id, name: item.name })
                      }>Eliminar</button>
                    </div>
                  </div>
                ))}
                {items.length === 0 && <p className="admin-empty-msg">Sin ítems en esta categoría</p>}
              </div>
            )}
          </div>
        )}

        {/* Modal de confirmación de borrado */}
        {confirm && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setConfirm(null)}>
            <div className="admin-confirm-modal">
              <h3>¿Eliminar {confirm.type === 'cat' ? 'categoría' : 'ítem'}?</h3>
              <p>Esta acción no se puede deshacer. Se eliminará <strong>"{confirm.name}"</strong>.</p>
              <div className="admin-form-actions">
                <button className="admin-btn-ghost" onClick={() => setConfirm(null)}>Cancelar</button>
                <button className="admin-btn-danger" onClick={() =>
                  confirm.type === 'cat'
                    ? handleDeleteCat(confirm.id)
                    : handleDeleteItem(confirm.id)
                } disabled={saving}>
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