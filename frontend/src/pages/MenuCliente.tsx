import { formatCOP } from '../utils/constants';
import { useNavigate } from 'react-router-dom';
import { useMenu } from '../hooks/useMenu';
import '../styles/mesero.css';

export default function MenuCliente() {
  const navigate = useNavigate();
  const {
    categories, items, activeCategory,
    selectCategory, loading, loadingItems, error, hasCategories,
  } = useMenu();

  return (
    <div style={{ minHeight: '100svh', background: '#F8FAFC', color: '#1E293B', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: '#fff', borderBottom: '1px solid rgba(37,99,235,0.08)', position: 'sticky', top: 0, zIndex: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #2563EB, #06B6D4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M4 10h14M4 14h9" stroke="#fff" strokeWidth="1.6" strokeLinecap="round"/>
              <rect x="2" y="5" width="18" height="14" rx="2" stroke="#fff" strokeWidth="1.4"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, margin: 0, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>Menú del restaurante</p>
            <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>Solo informativo · El mesero toma tu pedido</p>
          </div>
        </div>
        <button onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.20)', color: '#2563EB', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          Volver
        </button>
      </header>

      {/* Banner */}
      <div style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)', borderRadius: 12, margin: '16px 20px 0', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#2563EB' }}>
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.3"/><path d="M9 8v5M9 6h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        <span>Consulta nuestro menú y dile al mesero qué deseas ordenar.</span>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 12, color: '#94A3B8', flexDirection: 'column' }}>
          <div className="mesero-spinner" />
          <p>Cargando menú...</p>
        </div>
      ) : error ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#ef4444', flexDirection: 'column', gap: 8 }}>
          <p>No se pudo cargar el menú</p>
          <button onClick={() => window.location.reload()} style={{ color: '#2563EB', cursor: 'pointer' }}>Reintentar</button>
        </div>
      ) : !hasCategories ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#94A3B8' }}>
          <p>El menú no está disponible aún</p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <nav style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '14px 20px 10px', scrollbarWidth: 'none' }}>
            {categories.map((cat) => (
              <button key={cat.id} onClick={() => selectCategory(cat.id)} style={{ whiteSpace: 'nowrap', padding: '8px 18px', borderRadius: 100, fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0, background: activeCategory === cat.id ? 'linear-gradient(135deg, #2563EB, #3B82F6)' : '#fff', color: activeCategory === cat.id ? '#fff' : '#475569', border: activeCategory === cat.id ? 'none' : '1px solid rgba(37,99,235,0.08)' }}>
                {cat.name}
              </button>
            ))}
          </nav>

          {/* Items */}
          <div style={{ flex: 1, padding: '4px 20px 32px', overflowY: 'auto' }}>
            {loadingItems ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, paddingTop: 8 }}>
                {Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ height: 140, borderRadius: 16, background: '#E2E8F0' }} />)}
              </div>
            ) : items.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>Sin ítems en esta categoría</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, paddingTop: 8 }}>
                {items.map((item) => (
                  <div key={item.id} style={{ background: '#fff', border: '1px solid rgba(37,99,235,0.08)', borderRadius: 16, overflow: 'hidden', opacity: item.is_out_of_stock ? 0.55 : 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ height: 160, background: '#F1F5F9', position: 'relative', flexShrink: 0 }}>
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy"/>
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><path d="M8 28V16a10 10 0 0120 0v12" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round"/><path d="M5 28h26" stroke="#CBD5E1" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </div>
                      )}
                      {item.is_out_of_stock && <div style={{ position: 'absolute', top: 10, left: 10, background: '#ef4444', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100 }}>Agotado</div>}
                      {item.preparation_time != null && !item.is_out_of_stock && <div style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, padding: '3px 10px', borderRadius: 100 }}>~{item.preparation_time} min</div>}
                    </div>
                    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                      <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: '#1E293B' }}>{item.name}</h3>
                      {item.description && <p style={{ fontSize: 12, color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>{item.description}</p>}
                      <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                        <span style={{ fontSize: 18, fontWeight: 900, color: '#2563EB' }}>{formatCOP(item.price)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}