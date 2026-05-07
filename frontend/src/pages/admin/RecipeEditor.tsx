// ============================================================
// frontend/src/pages/admin/RecipeEditor.tsx  →  /admin/recetas
// ============================================================
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import AdminLayout             from '../../components/admin/AdminLayout';
import { useInventoryStore }   from '../../store/inventoryStore';
import { apiFetch }            from '../../services/api';
import {
  getRecipe, addRecipeIngredient, removeRecipeIngredient, getIngredients,
} from '../../services/inventoryService';
import type { RecipeIngredient, RecipeIngredientForm } from '../../types/inventory';
import '../../styles/admin.css';
import '../../styles/inventory.css';

interface MenuItem { id: string; name: string; category_name: string; }

export default function RecipeEditor() {
  const navigate = useNavigate();
  const { ingredients, setIngredients, setError } = useInventoryStore();
  const [menuItems,    setMenuItems]    = useState<MenuItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [recipe,       setRecipe]       = useState<RecipeIngredient[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [newIng,       setNewIng]       = useState<RecipeIngredientForm>({ ingredient_id: '', quantity_required: 0 });
  const [saving,       setSaving]       = useState(false);
  
  useEffect(() => {
    apiFetch<MenuItem[]>('/admin/menu/items').then(setMenuItems).catch(() => {});
    if (!ingredients.length) getIngredients().then(setIngredients).catch(() => {});
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!selectedItem) { setRecipe([]); return; }
    setLoading(true);
    getRecipe(selectedItem).then(setRecipe).finally(() => setLoading(false));
  }, [selectedItem]);

  async function handleAdd() {
    if (!selectedItem || !newIng.ingredient_id || newIng.quantity_required <= 0) return;
    setSaving(true);
    try {
      await addRecipeIngredient(selectedItem, newIng);
      const updated = await getRecipe(selectedItem);
      setRecipe(updated);
      setNewIng({ ingredient_id: '', quantity_required: 0 });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al agregar ingrediente');
    } finally { setSaving(false); }
  }

  async function handleRemove(ingredientId: string) {
    if (!selectedItem) return;
    try {
      await removeRecipeIngredient(selectedItem, ingredientId);
      setRecipe(recipe.filter((r) => r.ingredient_id !== ingredientId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al eliminar ingrediente');
    }
  }

  const selectedName = menuItems.find((m) => m.id === selectedItem)?.name ?? '';
  const usedIds      = new Set(recipe.map((r) => r.ingredient_id));

  return (
    <AdminLayout>
      <div className="admin-page">
<div className="admin-page-header">
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <button className="admin-btn-ghost" onClick={() => navigate(-1)}>
      ← Volver
    </button>
    <div>
      <h1 className="admin-page-title">Editor de Recetas</h1>
      <p className="admin-page-sub">Vincula ingredientes a los platillos del menú</p>
    </div>
  </div>
</div>

        {/* Selector de platillo */}
        <div className="admin-form-card">
          <h3 className="admin-form-title">Seleccionar platillo</h3>
          <select className="admin-select" value={selectedItem}
            onChange={(e) => setSelectedItem(e.target.value)}
            style={{ maxWidth: 360 }}>
            <option value="">— Selecciona un platillo —</option>
            {menuItems.map((m) => (
              <option key={m.id} value={m.id}>{m.name} ({m.category_name})</option>
            ))}
          </select>
        </div>

        {selectedItem && (
          <>
            {/* Receta actual */}
            <div className="admin-form-card">
              <h3 className="admin-form-title">Receta de: {selectedName}</h3>

              {loading ? (
                <div className="admin-loading" style={{ padding: 20 }}><div className="inv-spinner"/></div>
              ) : recipe.length === 0 ? (
                <p style={{ color: 'var(--a-muted)', fontSize: 13 }}>
                  Sin ingredientes asignados. Agrega uno abajo.
                </p>
              ) : (
                <div>
                  {recipe.map((r) => (
                    <div key={r.id} className="recipe-row">
                      <span className="recipe-ingr-name">{r.ingredient_name}</span>
                      <span className="recipe-qty">
                        {r.quantity_required} {r.unit}
                      </span>
                      <span style={{ color: 'var(--a-muted)', fontSize: 11 }}>por porción</span>
                      <button className="admin-btn-sm admin-btn-danger"
                        onClick={() => handleRemove(r.ingredient_id)}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Agregar ingrediente */}
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--a-border)' }}>
                <p style={{ fontSize: 12, color: 'var(--a-muted)', marginBottom: 10, fontWeight: 600 }}>
                  Agregar ingrediente a la receta:
                </p>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  <div className="admin-field" style={{ flex: 1, minWidth: 180 }}>
                    <label>Ingrediente</label>
                    <select className="admin-select" value={newIng.ingredient_id}
                      onChange={(e) => setNewIng({ ...newIng, ingredient_id: e.target.value })}>
                      <option value="">Seleccionar...</option>
                      {ingredients.filter((i) => !usedIds.has(i.id)).map((i) => (
                        <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                      ))}
                    </select>
                  </div>
                  <div className="admin-field">
                    <label>Cantidad por porción</label>
                    <input className="admin-input" type="number" min="0.001" step="0.001"
                      value={newIng.quantity_required || ''}
                      onChange={(e) => setNewIng({ ...newIng, quantity_required: parseFloat(e.target.value) || 0 })}
                      style={{ width: 120 }}/>
                  </div>
                  <button className="admin-btn-teal" onClick={handleAdd}
                    disabled={!newIng.ingredient_id || newIng.quantity_required <= 0 || saving}>
                    {saving ? 'Agregando...' : '+ Agregar'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}