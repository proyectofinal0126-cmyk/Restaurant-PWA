import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { useAuth } from '../hooks/useAuth';
import '../styles/loginpage.css';
import { Lock, Eye, EyeOff } from 'lucide-react';

// Credenciales demo por rol para facilitar pruebas en desarrollo
const DEMO_CREDS: Record<string, { email: string; password: string; label: string }> = {
  caja:   { email: 'caja@restaurant.com',   password: 'caja1234',   label: 'Caja' },
  cocina: { email: 'cocina@restaurant.com', password: 'cocina1234', label: 'Cocina' },
  mesero: { email: 'mesero@restaurant.com', password: 'mesero1234', label: 'Mesero' },
  admin:  { email: 'admin@restaurant.com',  password: 'admin1234',  label: 'Admin' },
};

export default function LoginPage() {
  const navigate        = useNavigate();
  const { mode, role }  = useAppStore();
  const { login, loading, error } = useAuth();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const isAuto  = mode === 'autoservicio';
  const accent  = isAuto ? 'orange' : 'blue';

  // Pre-fill demo credentials
  function fillDemo() {
    const key  = role ?? 'admin';
    const demo = DEMO_CREDS[key] ?? DEMO_CREDS['admin'];
    setEmail(demo.email);
    setPassword(demo.password);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await login(email, password);
  }

  const roleLabel = role
    ? DEMO_CREDS[role]?.label ?? role
    : 'Personal';

  return (
    <div className={`login-root accent-${accent}`}>
      {/* ── Fondo ── */}
      <div className="login-bg">
        <div className={`lb lb-${accent}`} />
        <div className="noise" />
        <div className="login-lines" />
      </div>

      {/* ── Panel izquierdo (decorativo) ── */}
      <aside className="login-aside">
        <div className="aside-inner">
          <div className="aside-logo" onClick={() => navigate('/')}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <path d="M18 2L33 10.5V25.5L18 34L3 25.5V10.5L18 2Z"
                fill="url(#alg)" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
              <defs>
                <linearGradient id="alg" x1="3" y1="2" x2="33" y2="34">
                  <stop stopColor="#f97316"/>
                  <stop offset="1" stopColor="#ea580c"/>
                </linearGradient>
              </defs>
            </svg>
            <span>RestaurantPWA</span>
          </div>

          <div className="aside-copy">
            <p className="aside-mode">{isAuto ? 'Autoservicio' : 'Con Mesero'}</p>
            <h2 className="aside-h2">Bienvenido<br/>de vuelta</h2>
            <p className="aside-desc">
              Accede con tus credenciales para gestionar el sistema de pedidos en tiempo real.
            </p>
          </div>

          <div className="aside-steps">
            <div className="step step-done">
              <div className="step-dot"><svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg></div>
              <span>Modalidad</span>
            </div>
            <div className="step-line" />
            <div className="step step-done">
              <div className="step-dot"><svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg></div>
              <span>Rol</span>
            </div>
            <div className="step-line" />
            <div className="step step-active">
              <div className="step-dot step-current" />
              <span>Acceso</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Formulario ── */}
      <main className="login-main">
        <div className="login-card">

          {/* Header del form */}
          <div className="lc-header">
            <div className={`role-tag rt-${accent}`}>
              <Lock size={13}/> Acceso: {roleLabel}
            </div>
            <h1 className="lc-h1">Iniciar sesión</h1>
            <p className="lc-sub">Ingresa tus credenciales del sistema</p>
          </div>

          {/* Error */}
          {error && (
            <div className="login-error">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="#ef4444" strokeWidth="1.5"/>
                <path d="M8 5v3M8 10v1" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {error}
            </div>
          )}

          {/* Form */}
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="field-group">
              <label className="field-label" htmlFor="email">Correo electrónico</label>
              <div className="field-wrap">
                <svg className="field-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M1 6l7 4 7-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <input
                  id="email"
                  type="email"
                  className="field-input"
                  placeholder="usuario@restaurant.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="password">Contraseña</label>
              <div className="field-wrap">
                <svg className="field-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M5 7V5a3 3 0 116 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                </svg>
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  className="field-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="toggle-pass"
                  onClick={() => setShowPass((v) => !v)}
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className={`submit-btn btn-${accent}`}
              disabled={loading}
            >
              {loading ? (
                <span className="spinner" />
              ) : (
                <>
                  Ingresar
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Demo helper */}
          {import.meta.env.DEV && (
            <div className="demo-box">
              <p className="demo-label">Modo desarrollo</p>
              <button className="demo-btn" onClick={fillDemo}>
                Rellenar credenciales de prueba ({roleLabel})
              </button>
            </div>
          )}

          <div className="lc-footer">
            <button className="link-btn" onClick={() => navigate('/select-role')}>
              ← Cambiar de rol
            </button>
            <button className="link-btn" onClick={() => navigate('/')}>
              Ir al inicio
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}