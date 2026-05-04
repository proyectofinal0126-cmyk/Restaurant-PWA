// ============================================================
// frontend/src/pages/Home.tsx
//
// Muestra las tarjetas de modo de operación disponibles según
// operationMode (configurado por el admin en BD).
//
//   'autoservicio' → solo tarjeta Autoservicio, entra directo
//   'mesero'       → solo tarjeta Mesero, entra directo
//   'ambos'        → ambas tarjetas, usuario elige
// ============================================================

import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import type { Mode } from '../store/appStore';
import '../styles/home.css';

export default function Home() {
  const navigate       = useNavigate();
  const { setMode, operationMode } = useAppStore();

  function handleSelect(mode: Mode) {
    setMode(mode);
    navigate('/select-role');
  }

  const showAutoservicio = operationMode === 'autoservicio' || operationMode === 'ambos';
  const showMesero       = operationMode === 'mesero'       || operationMode === 'ambos';

  return (
    <div className="home-root">
      <div className="home-bg">
        <div className="blob b-orange" />
        <div className="blob b-blue" />
        <div className="noise" />
        <div className="grid-overlay" />
      </div>

      <div className="home-wrap">

        <header className="home-logo">
          <div className="logo-hex">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M16 2L29 9.5V22.5L16 30L3 22.5V9.5L16 2Z" fill="url(#hlg)"/>
              <defs>
                <linearGradient id="hlg" x1="3" y1="2" x2="29" y2="30" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#f97316"/>
                  <stop offset="1" stopColor="#ea580c"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="logo-wordmark">
            <span className="logo-main">RestaurantPWA</span>
            <span className="logo-tag">Sistema de Gestión</span>
          </div>
        </header>

        <section className="home-hero">
          <p className="eyebrow">¿Cómo vas a operar hoy?</p>
          <h1 className="home-h1">
            Selecciona tu<br/>
            <span className="gradient-text">modalidad de servicio</span>
          </h1>
          <p className="home-sub">
            Cada modalidad habilita los paneles y roles específicos para tu operación del día.
          </p>
        </section>

        <div className="mode-grid">

          {showAutoservicio && (
          <button className="mode-card card-orange" onClick={() => handleSelect('autoservicio')}>
            <div className="card-bg-glow glow-o" />
            <div className="card-top">
              <div className="card-badge badge-o">Autoservicio</div>
              <span className="card-num">01</span>
            </div>
            <div className="card-icon-large">
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <rect width="56" height="56" rx="16" fill="rgba(249,115,22,0.12)"/>
                <path d="M28 14L40 21V35L28 42L16 35V21L28 14Z" fill="none" stroke="#f97316" strokeWidth="1.5"/>
                <text x="22" y="32" fill="#f97316" fontSize="11" fontWeight="700">QR</text>
              </svg>
            </div>
            <div className="card-content">
              <h2 className="card-h2">Autoservicio</h2>
              <p className="card-p">
                El cliente escanea un QR, elige su pedido y paga. La caja valida y cocina prepara.
              </p>
            </div>
            <div className="card-roles-row">
              {['Cliente','Caja','Cocina','Admin'].map(r => (
                <span key={r} className="role-chip chip-o">{r}</span>
              ))}
            </div>
            <div className="card-cta">
              Seleccionar
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </button>
          )}

          {showMesero && (
          <button className="mode-card card-blue" onClick={() => handleSelect('mesero')}>
            <div className="card-bg-glow glow-b" />
            <div className="card-top">
              <div className="card-badge badge-b">Con Mesero</div>
              <span className="card-num">02</span>
            </div>
            <div className="card-icon-large">
              <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <rect width="56" height="56" rx="16" fill="rgba(59,130,246,0.12)"/>
                <circle cx="28" cy="22" r="7" stroke="#3b82f6" strokeWidth="1.5"/>
                <path d="M16 42c0-6.627 5.373-12 12-12s12 5.373 12 12" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="card-content">
              <h2 className="card-h2">Con Mesero</h2>
              <p className="card-p">
                El mesero gestiona mesas y toma órdenes. La cocina prepara y la caja cierra al final.
              </p>
            </div>
            <div className="card-roles-row">
              {['Cliente','Mesero','Cocina','Caja','Admin'].map(r => (
                <span key={r} className="role-chip chip-b">{r}</span>
              ))}
            </div>
            <div className="card-cta">
              Seleccionar
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
          </button>
          )}

        </div>

        <footer className="home-foot">RestaurantPWA · Sistema de Gestión</footer>
      </div>
    </div>
  );
}
