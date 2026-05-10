// ============================================================
// frontend/src/components/admin/AdminLayout.tsx  —  Fase 9 (actualizado)
// NUEVO: ítem "Bodega" en el sidebar → /admin/inventario
// ============================================================

import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore }              from '../../store/appStore';
import '../../styles/admin.css';

interface Props {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  {
    path: '/admin/dashboard', label: 'Dashboard',
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="10" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="2" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <rect x="10" y="10" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    </svg>,
  },
  {
  path: '/admin/mesas', label: 'Mesas',
  icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <rect x="2" y="6" width="14" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
    <path d="M5 6V4M13 6V4M2 10h14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>,
},
  {
    path: '/admin/menu', label: 'Menú',
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M3 5h12M3 9h12M3 13h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>,
  },
  {
    path: '/admin/inventario', label: 'Bodega',
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="7" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M5 7V5a4 4 0 018 0v2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <circle cx="9" cy="11" r="1.5" fill="currentColor" opacity=".6"/>
    </svg>,
  },
  {
    path: '/admin/users', label: 'Personal',
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="7" cy="6" r="3" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M1 16c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M13 8l1.5 1.5L17 7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>,
  },
  {
    path: '/admin/reports', label: 'Reportes',
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M5 12l2.5-3 2.5 2 3-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>,
  },
  {
    path: '/admin/settings', label: 'Configuración',
    icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="2.5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M9 2v2M9 14v2M2 9h2M14 9h2M4.2 4.2l1.4 1.4M12.4 12.4l1.4 1.4M4.2 13.8l1.4-1.4M12.4 5.6l1.4-1.4"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>,
  },
];

export default function AdminLayout({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAppStore();

  function handleLogout() { logout(); navigate('/'); }

  return (
    <div className="admin-root">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <div className="admin-logo-icon">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 2L20 7.5V16.5L11 22L2 16.5V7.5L11 2Z" fill="url(#alg)"/>
              <defs>
                <linearGradient id="alg" x1="2" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#818cf8"/><stop offset="1" stopColor="#6366f1"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <p className="admin-logo-name">RestaurantPWA</p>
            <p className="admin-logo-role">Administrador</p>
          </div>
        </div>

        <nav className="admin-nav" aria-label="Navegación admin">
          {NAV_ITEMS.map((item) => {
            // El ítem Bodega está activo para cualquier ruta /admin/inventario*, /admin/proveedores, /admin/recetas
            const isActive = item.path === '/admin/inventario'
              ? location.pathname.startsWith('/admin/inventario') ||
                location.pathname === '/admin/proveedores' ||
                location.pathname === '/admin/recetas'
              : location.pathname === item.path;

            return (
              <button key={item.path} type="button"
                className={`admin-nav-item ${isActive ? 'admin-nav-item--active' : ''}`}
                onClick={() => navigate(item.path)}
                aria-current={isActive ? 'page' : undefined}>
                <span className="admin-nav-icon">{item.icon}</span>
                <span className="admin-nav-label">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user-info">
            <div className="admin-user-avatar">{user?.name?.charAt(0).toUpperCase() ?? 'A'}</div>
            <div>
              <p className="admin-user-name">{user?.name ?? 'Admin'}</p>
              <p className="admin-user-email">{user?.email ?? ''}</p>
            </div>
          </div>
          <button type="button" className="admin-logout-btn" onClick={handleLogout} aria-label="Cerrar sesión">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              <path d="M10 11l4-4-4-4M14 7H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </aside>

      <main className="admin-content">{children}</main>
    </div>
  );
}