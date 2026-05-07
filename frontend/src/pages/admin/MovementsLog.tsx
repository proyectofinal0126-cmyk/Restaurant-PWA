// ============================================================
// frontend/src/pages/admin/MovementsLog.tsx  →  /admin/inventario/movimientos
// ============================================================

import { useEffect, useState, useCallback } from 'react';
import AdminLayout             from '../../components/admin/AdminLayout';
import { useInventoryStore }   from '../../store/inventoryStore';
import { getMovements, getIngredients } from '../../services/inventoryService';
import type { MovementFilter, MovementType } from '../../types/inventory';
import '../../styles/admin.css';
import '../../styles/inventory.css';
import { Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const TYPE_LABEL: Record<string, string> = {
  entrada: 'Entrada', salida: 'Salida', ajuste: 'Ajuste', consumo_turno: 'Consumo turno',
};

const today = new Date().toLocaleDateString('sv-SE');
const week  = new Date(Date.now() - 7 * 86400000).toLocaleDateString('sv-SE');

export default function MovementsLog() {
  const navigate = useNavigate();
  const { movements, movLoading, ingredients, setMovements, setMovLoading, setIngredients, setError } = useInventoryStore();
  const [filter, setFilter] = useState<MovementFilter>({ date_from: week, date_to: today });

  const load = useCallback(() => {
    setMovLoading(true);
    getMovements(filter)
      .then(setMovements)
      .catch((e: Error) => setError(e.message));
  }, [filter]); // eslint-disable-line

  useEffect(() => {
    load();
    if (!ingredients.length) {
      getIngredients().then(setIngredients).catch(() => {});
    }
  }, [load]); // eslint-disable-line

  function handleExportCSV() {
    const rows = [
      ['Fecha', 'Ingrediente', 'Tipo', 'Cantidad', 'Stock resultante', 'Usuario', 'Nota'],
      ...movements.map((m) => [
        new Date(m.created_at).toLocaleString('es'),
        m.ingredient_name,
        TYPE_LABEL[m.type] ?? m.type,
        m.quantity.toFixed(3),
        m.stock_after?.toFixed(3) ?? '—',
        m.user_name ?? '—',
        m.notes ?? '',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a    = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `movimientos_bodega_${filter.date_from ?? 'all'}.csv`;
    a.click();
  }

  return (
    <AdminLayout>
<div className="admin-page-header">
  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <button className="admin-btn-ghost" onClick={() => navigate(-1)}>
      ← Volver
    </button>
    <div>
      <h1 className="admin-page-title">Historial de movimientos</h1>
      <p className="admin-page-sub">Trazabilidad completa de la bodega</p>
    </div>
  </div>
  <button className="admin-btn-ghost" onClick={handleExportCSV} disabled={movements.length === 0}>
    <Download size={14}/> Exportar CSV
  </button>
</div>

        {/* Filtros */}
        <div className="inv-filters">
          <div className="admin-field">
            <label style={{ fontSize: 11, color: 'var(--a-muted)', fontWeight: 600 }}>Desde</label>
            <input className="admin-input" type="date" value={filter.date_from ?? ''}
              onChange={(e) => setFilter({ ...filter, date_from: e.target.value })}/>
          </div>
          <div className="admin-field">
            <label style={{ fontSize: 11, color: 'var(--a-muted)', fontWeight: 600 }}>Hasta</label>
            <input className="admin-input" type="date" value={filter.date_to ?? ''}
              onChange={(e) => setFilter({ ...filter, date_to: e.target.value })}/>
          </div>
          <div className="admin-field">
            <label style={{ fontSize: 11, color: 'var(--a-muted)', fontWeight: 600 }}>Tipo</label>
            <select className="admin-select" value={filter.type ?? ''} onChange={(e) =>
              setFilter({ ...filter, type: (e.target.value as MovementType) || undefined })}>
              <option value="">Todos</option>
              <option value="entrada">Entrada</option>
              <option value="salida">Salida (retiro)</option>
              <option value="ajuste">Ajuste manual</option>
              <option value="consumo_turno">Consumo turno</option>
            </select>
          </div>
          <div className="admin-field">
            <label style={{ fontSize: 11, color: 'var(--a-muted)', fontWeight: 600 }}>Ingrediente</label>
            <select className="admin-select" value={filter.ingredient_id ?? ''}
              onChange={(e) => setFilter({ ...filter, ingredient_id: e.target.value || undefined })}>
              <option value="">Todos</option>
              {ingredients.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
          <button className="admin-btn-teal" onClick={load} disabled={movLoading}>
            {movLoading ? 'Cargando...' : 'Buscar'}
          </button>
        </div>

        {movLoading ? (
          <div className="admin-loading"><div className="inv-spinner"/></div>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table">
              <thead>
                <tr>
                  <th>Fecha</th><th>Ingrediente</th><th>Tipo</th>
                  <th>Cantidad</th><th>Stock resultante</th><th>Usuario</th><th>Nota</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                      {new Date(m.created_at).toLocaleString('es', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}
                    </td>
                    <td style={{ fontWeight: 600 }}>{m.ingredient_name}</td>
                    <td>
                      <span className={`mov-type-badge mov-type-badge--${m.type}`}>
                        {TYPE_LABEL[m.type] ?? m.type}
                      </span>
                    </td>
                    <td className={m.quantity >= 0 ? 'mov-qty-pos' : 'mov-qty-neg'}>
                      {m.quantity >= 0 ? '+' : ''}{m.quantity.toFixed(3)} {m.unit}
                    </td>
                    <td style={{ color: 'var(--a-muted)', fontSize: 12 }}>
                      {m.stock_after?.toFixed(3) ?? '—'} {m.unit}
                    </td>
                    <td style={{ fontSize: 12 }}>{m.user_name ?? '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--a-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.notes ?? '—'}
                    </td>
                  </tr>
                ))}
                {movements.length === 0 && (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--a-muted)' }}>
                    Sin movimientos para este período
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
    </AdminLayout>
  );
}