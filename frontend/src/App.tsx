// ============================================================
// frontend/src/App.tsx  —  Fase 7 (actualizado)
//
// CAMBIO: /caja/dashboard ahora carga CajaMesero.tsx (Fase 7)
// en lugar del componente <Soon>.
// ============================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home              from './pages/Home';
import RoleSelectPage    from './pages/RoleSelectPage';
import LoginPage         from './pages/LoginPage';
import ProtectedRoute    from './components/auth/ProtectedRoute';

// Fase 3
import ClientMenu        from './pages/ClientMenu';
import Checkout          from './pages/Checkout';
import OrderTracker      from './pages/OrderTracker';

// Fase 4
import CajaAutoservicio  from './pages/caja/CajaAutoservicio';

// Fase 5
import KDS               from './pages/cocina/KDS';

// Fase 6
import TableDashboard    from './pages/mesero/TableDashboard';
import TakeOrder         from './pages/mesero/TakeOrder';

// Fase 7
import CajaMesero        from './pages/cashier/CajaMesero';

const Soon = ({ label }: { label: string }) => (
  <div style={{
    minHeight: '100svh', background: '#080810', color: '#f0ece6',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '14px', fontFamily: 'sans-serif',
  }}>
    <span style={{ fontSize: 52 }}>🚧</span>
    <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800 }}>{label}</h2>
    <p style={{ color: '#55556a', fontSize: 14 }}>Próxima fase</p>
    <a href="/" style={{ color: '#f97316', fontSize: 13, textDecoration: 'none' }}>← Inicio</a>
  </div>
);

const Unauthorized = () => (
  <div style={{
    minHeight: '100svh', background: '#080810', color: '#f0ece6',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', gap: '14px', fontFamily: 'sans-serif',
  }}>
    <span style={{ fontSize: 52 }}>🔒</span>
    <h2 style={{ margin: 0 }}>Acceso denegado</h2>
    <a href="/" style={{ color: '#f97316', fontSize: 13, textDecoration: 'none' }}>← Inicio</a>
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Fase 2 */}
        <Route path="/"            element={<Home />} />
        <Route path="/select-role" element={<RoleSelectPage />} />
        <Route path="/login"       element={<LoginPage />} />

        {/* Fase 3: Cliente autoservicio (sin login) */}
        <Route path="/autoservicio/menu"        element={<ClientMenu />} />
        <Route path="/autoservicio/checkout"    element={<Checkout />} />
        <Route path="/autoservicio/tracker/:id" element={<OrderTracker />} />

        {/* Fase 4: Caja autoservicio */}
        <Route
          path="/autoservicio/caja"
          element={
            <ProtectedRoute allowedRoles={['caja', 'admin']}>
              <CajaAutoservicio />
            </ProtectedRoute>
          }
        />

        {/* Fase 5: KDS */}
        <Route
          path="/cocina/kds"
          element={
            <ProtectedRoute allowedRoles={['cocina', 'admin']}>
              <KDS />
            </ProtectedRoute>
          }
        />

        {/* Fase 6: Módulo Mesero */}
        <Route
          path="/mesero/dashboard"
          element={
            <ProtectedRoute allowedRoles={['mesero', 'admin']}>
              <TableDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mesero/orden/:tableId"
          element={
            <ProtectedRoute allowedRoles={['mesero', 'admin']}>
              <TakeOrder />
            </ProtectedRoute>
          }
        />

        {/* Fase 7: Caja Con Mesero */}
        <Route
          path="/caja/dashboard"
          element={
            <ProtectedRoute allowedRoles={['caja', 'admin']}>
              <CajaMesero />
            </ProtectedRoute>
          }
        />

        {/* Fase futura: Admin */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Soon label="Dashboard Admin" />
            </ProtectedRoute>
          }
        />

        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="*"             element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}