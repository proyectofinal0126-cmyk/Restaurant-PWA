// ============================================================
// frontend/src/components/inventory/LowStockAlert.tsx  —  F9
//
// Banner que muestra en la parte superior del panel admin
// cuando hay ingredientes con stock bajo o crítico.
// ============================================================

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventoryStore } from '../../store/inventoryStore';
import { getLowStock }       from '../../services/inventoryService';
import { AlertTriangle } from 'lucide-react';
export default function LowStockAlert() {
  const { lowStockItems, lowStockCount, setLowStock } = useInventoryStore();
  const navigate = useNavigate();

  useEffect(() => {
    getLowStock().then(setLowStock).catch(() => {/* silencioso */});
    const interval = setInterval(() => {
      getLowStock().then(setLowStock).catch(() => {});
    }, 3 * 60_000); // refresh cada 3 min
    return () => clearInterval(interval);
  }, []); // eslint-disable-line

  if (lowStockCount === 0) return null;

  const critical = lowStockItems.filter((i) => i.status === 'CRITICO' || i.status === 'AGOTADO').length;

  return (
    <div className="low-stock-banner" role="alert">
      <AlertTriangle size={14}/>
      <div className="lsb-text">
        <strong>
          {critical > 0
            ? <span className="lsb-critical">{critical} ingrediente{critical > 1 ? 's' : ''} en estado CRÍTICO/AGOTADO</span>
            : null}
          {critical > 0 && lowStockCount - critical > 0 ? ' · ' : null}
          {lowStockCount - critical > 0
            ? `${lowStockCount - critical} ingrediente${lowStockCount - critical > 1 ? 's' : ''} con stock BAJO`
            : null}
        </strong>
        {' '}— Revisa la bodega para reabastecer.
      </div>
      <span className="lsb-count">{lowStockCount}</span>
      <button
        type="button"
        className="admin-btn-sm"
        onClick={() => navigate('/admin/inventario')}
      >
        Ver bodega
      </button>
    </div>
  );
}