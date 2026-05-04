// ============================================================
// frontend/src/pages/admin/Settings.tsx  →  /admin/settings
//
// Configuración global del restaurante.
// Nombre, dirección, impuestos, propina sugerida, moneda.
//
// El modo de operación (autoservicio/mesero/ambos) NO aparece
// aquí — lo fija el equipo técnico en el .env al instalar.
// ============================================================

import { formatCOP } from '../../utils/constants';
import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { getSettings, saveSettings } from '../../services/adminService';
import type { RestaurantSettings } from '../../types/admin';

const CURRENCIES = ['USD', 'COP', 'MXN', 'EUR', 'PEN', 'ARS', 'CLP'];
const TIMEZONES  = ['America/Bogota','America/Mexico_City','America/Lima','America/Santiago','America/Buenos_Aires','America/New_York','America/Sao_Paulo'];

const DEFAULT: RestaurantSettings = {
  name:           'RestaurantPWA',
  address:        '',
  phone:          '',
  tax_rate:       8,
  tip_suggestion: 10,
  currency:       'COP',
  timezone:       'America/Bogota',
};

export default function Settings() {
  const [settings, setSettings] = useState<RestaurantSettings>(DEFAULT);
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getSettings()
      .then((s) => setSettings({ ...DEFAULT, ...s }))
      .catch(() => { /* usa defaults */ })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const result = await saveSettings(settings);
      setSettings({ ...DEFAULT, ...result });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const field = (
    label: string,
    key: keyof RestaurantSettings,
    type: string = 'text',
    hint?: string,
    extra?: Record<string, unknown>
  ) => (
    <div className="admin-field">
      <label>{label}</label>
      <input
        className="admin-input"
        type={type}
        value={String(settings[key])}
        onChange={(e) => setSettings({
          ...settings,
          [key]: type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value,
        })}
        {...extra}
      />
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">Configuración</h1>
            <p className="admin-page-sub">Ajustes generales del restaurante</p>
          </div>
        </div>

        {loading ? (
          <div className="admin-loading"><div className="admin-spinner"/></div>
        ) : (
          <div className="settings-sections">

            {/* Información básica */}
            <div className="admin-form-card">
              <h3 className="admin-form-title">Información del restaurante</h3>
              <div className="admin-form-grid">
                {field('Nombre del restaurante *', 'name', 'text', undefined, { placeholder: 'RestaurantPWA' })}
                {field('Dirección', 'address', 'text', undefined, { placeholder: 'Calle 123 #45-67' })}
                {field('Teléfono de contacto', 'phone', 'tel', undefined, { placeholder: '+57 300 000 0000' })}
                <div className="admin-field">
                  <label>Zona horaria</label>
                  <select className="admin-select" value={settings.timezone}
                    onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}>
                    {TIMEZONES.map((tz) => (
                      <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Finanzas */}
            <div className="admin-form-card">
              <h3 className="admin-form-title">Configuración financiera</h3>
              <div className="admin-form-grid">
                <div className="admin-field">
                  <label>Moneda</label>
                  <select className="admin-select" value={settings.currency}
                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                {field('IVA / Impuesto (%)', 'tax_rate', 'number',
                  'Porcentaje aplicado a cada orden. Ej: 8 = 8%',
                  { min: 0, max: 50, step: 0.1 })}
                {field('Propina sugerida (%)', 'tip_suggestion', 'number',
                  'Porcentaje sugerido al cliente. Ej: 10 = 10%',
                  { min: 0, max: 30, step: 0.5 })}
              </div>

              <div className="settings-preview">
                <p className="settings-preview-title">Vista previa con $100.000 de subtotal:</p>
                <div className="settings-preview-rows">
                  <div className="spr-row"><span>Subtotal</span><span>$ 100.000</span></div>
                  <div className="spr-row"><span>IVA ({settings.tax_rate}%)</span>
                    <span>{formatCOP((100 * settings.tax_rate / 100))}</span></div>
                  <div className="spr-row spr-total">
                    <span>Total</span>
                    <span>{formatCOP((100 + 100 * settings.tax_rate / 100))}</span>
                  </div>
                  <div className="spr-row spr-tip">
                    <span>Propina sugerida ({settings.tip_suggestion}%)</span>
                    <span>+{formatCOP((100 * settings.tip_suggestion / 100))}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Acciones */}
            {error && <div className="admin-error-banner" role="alert">{error}</div>}
            {saved  && <div className="admin-success-banner">✅ Configuración guardada correctamente</div>}

            <div className="admin-form-actions" style={{ justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="admin-btn-primary"
                onClick={handleSave}
                disabled={saving || !settings.name}
                style={{ minWidth: 160 }}
              >
                {saving ? 'Guardando...' : 'Guardar configuración'}
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
