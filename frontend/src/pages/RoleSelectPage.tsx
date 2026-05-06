import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import type { Role } from '../store/appStore';
import '../styles/role.select.css';
import { Lock } from 'lucide-react';

interface RoleDef {
  id: Role;
  label: string;
  desc: string;
  icon: React.ReactNode;
  needsLogin: boolean; // cliente no necesita login en autoservicio
}

const ROLES_AUTO: RoleDef[] = [
  {
    id: 'cliente', label: 'Cliente', needsLogin: false,
    desc: 'Escanea QR, elige tu pedido y rastrea en tiempo real.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <circle cx="14" cy="10" r="5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 24c0-4.97 4.03-9 9-9s9 4.03 9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'caja', label: 'Caja', needsLogin: true,
    desc: 'Valida órdenes, procesa pagos y cierra pedidos.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect x="4" y="8" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M4 13h20M10 17h2M16 17h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M10 5l4-2 4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'cocina', label: 'Cocina', needsLogin: true,
    desc: 'KDS: visualiza y actualiza el estado de preparación.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M8 22V14a6 6 0 1112 0v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M5 22h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M14 8V4M10 9l-2-3M18 9l2-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'admin', label: 'Admin', needsLogin: true,
    desc: 'Control total: menú, usuarios, reportes y dashboard.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <path d="M14 3l2.5 5 5.5.8-4 3.9.9 5.5L14 15.5 9.1 18.2l.9-5.5L6 8.8l5.5-.8L14 3z"
          stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <path d="M8 22h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M11 25h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
];

const ROLES_MESERO: RoleDef[] = [
  {
    id: 'cliente', label: 'Cliente', needsLogin: false,
    desc: 'Consulta el menú y sigue el estado de tu pedido.',
    icon: ROLES_AUTO[0].icon,
  },
  {
    id: 'mesero', label: 'Mesero', needsLogin: true,
    desc: 'Gestiona mesas, toma órdenes y entrega pedidos.',
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect x="4" y="12" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M4 15h20" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="10" cy="9" r="3" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M18 9h4M18 6h4M18 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  { ...ROLES_AUTO[2] },
  { ...ROLES_AUTO[1] },
  { ...ROLES_AUTO[3] },
];

export default function RoleSelectPage() {
  const navigate = useNavigate();
  const { mode, setRole } = useAppStore();

  const isAuto  = mode === 'autoservicio';
  const roles   = isAuto ? ROLES_AUTO : ROLES_MESERO;
  const accent  = isAuto ? 'orange' : 'blue';

  function handleRole(role: RoleDef) {
    setRole(role.id);
    if (role.needsLogin) {
      navigate('/login');
    } else {
      // Cliente autoservicio entra directo al menú
      const dest = isAuto ? '/autoservicio/menu' : '/mesero/menu-cliente';
      navigate(dest);
    }
  }

  return (
    <div className={`rs-root accent-${accent}`}>
      <div className="rs-bg">
        <div className={`rs-blob rb-${accent}`} />
        <div className="noise" />
      </div>

      <div className="rs-wrap">

        {/* ── Nav ── */}
        <nav className="rs-nav">
          <button className="back-pill" onClick={() => navigate('/')}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Volver
          </button>
          <div className={`mode-pill pill-${accent}`}>
            {isAuto ? 'Autoservicio' : 'Con Mesero'}
          </div>
        </nav>

        {/* ── Header ── */}
        <div className="rs-header">
          <p className="eyebrow">Paso 2 de 3</p>
          <h1 className="rs-h1">¿Cuál es tu rol?</h1>
          <p className="rs-sub">
            {roles.length} roles disponibles en la modalidad <strong>{isAuto ? 'Autoservicio' : 'Con Mesero'}</strong>.
            Los roles de personal requieren inicio de sesión.
          </p>
        </div>

        {/* ── Grid de roles ── */}
        <div className={`roles-grid grid-${roles.length}`}>
          {roles.map((role, i) => (
            <button
              key={role.id}
              className={`role-card ${role.needsLogin ? 'needs-login' : 'no-login'}`}
              style={{ '--i': i } as React.CSSProperties}
              onClick={() => handleRole(role)}
            >
              <div className="rc-icon">{role.icon}</div>
              <div className="rc-body">
                <div className="rc-top-row">
                  <h3 className="rc-title">{role.label}</h3>
                  {role.needsLogin
                    ? <span className="rc-badge login-req"><Lock size={11}/> Login</span>
                    : <span className="rc-badge direct">Acceso directo</span>
                  }
                </div>
                <p className="rc-desc">{role.desc}</p>
              </div>
              <div className="rc-arrow">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M4 9h10M10 5l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}