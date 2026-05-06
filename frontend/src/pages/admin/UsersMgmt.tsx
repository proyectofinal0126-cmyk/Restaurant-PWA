// ============================================================
// frontend/src/pages/admin/UsersMgmt.tsx  →  /admin/users
//
// Propósito: Gestión del personal del restaurante.
//   CRUD de usuarios, asignación de roles, activar/desactivar,
//   resetear contraseñas sin ver la contraseña actual.
// ============================================================
import { KeyRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAdminStore } from '../../store/adminStore';
import {
  getAdminUsers, createUser, updateUser,
  toggleUserActive, resetPassword,
} from '../../services/adminService';
import type { AdminUser, UserForm } from '../../types/admin';

const ROLES = ['admin', 'caja', 'cocina', 'mesero'];

const ROLE_COLOR: Record<string, string> = {
  admin:  'role-admin',
  caja:   'role-caja',
  cocina: 'role-cocina',
  mesero: 'role-mesero',
};

const EMPTY_FORM: UserForm = {
  email: '', first_name: '', last_name: '',
  role_name: 'mesero', phone: '', password: '', is_active: true,
};

export default function UsersMgmt() {
  const {
    users, usersLoading,
    setUsers, setUsersLoading, updateUserInList, setError,
  } = useAdminStore();

  const [userForm,  setUserForm]  = useState<UserForm | null>(null);
  const [editId,    setEditId]    = useState<string | null>(null);
  const [resetId,   setResetId]   = useState<string | null>(null);
  const [newPwd,    setNewPwd]    = useState('');
  const [saving,    setSaving]    = useState(false);
  const [search,    setSearch]    = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setUsersLoading(true);
    getAdminUsers()
      .then(setUsers)
      .catch((e: Error) => setError(e.message));
  }, []); // eslint-disable-line

  async function handleSave() {
    if (!userForm) return;
    setSaving(true);
    try {
      if (editId) {
        const { password, ...rest } = userForm;
        const updated = await updateUser(editId, rest);
        updateUserInList(updated);
        setSuccessMsg('Usuario actualizado correctamente');
      } else {
        if (!userForm.password) return;
        const created = await createUser(userForm);
        setUsers([...users, created]);
        setSuccessMsg('Usuario creado correctamente');
      }
      setUserForm(null); setEditId(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  }

  async function handleToggle(user: AdminUser) {
    try {
      const updated = await toggleUserActive(user.id, !user.is_active);
      updateUserInList(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cambiar estado');
    }
  }

  async function handleResetPwd() {
    if (!resetId || !newPwd || newPwd.length < 6) return;
    setSaving(true);
    try {
      await resetPassword(resetId, newPwd);
      setResetId(null); setNewPwd('');
      setSuccessMsg('Contraseña actualizada correctamente');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al resetear contraseña');
    } finally {
      setSaving(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  }

  // Filtrado local
  const filtered = users.filter((u) => {
    const matchSearch = search.trim() === '' ||
      `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === '' || u.role === filterRole;
    return matchSearch && matchRole;
  });

  return (
    <AdminLayout>
      <div className="admin-page">
        <div className="admin-page-header">
          <div>
            <h1 className="admin-page-title">Personal</h1>
            <p className="admin-page-sub">{users.length} usuarios registrados</p>
          </div>
          <button className="admin-btn-primary" onClick={() => { setUserForm(EMPTY_FORM); setEditId(null); }}>
            + Nuevo usuario
          </button>
        </div>

        {/* Mensaje de éxito */}
        {successMsg && (
          <div className="admin-success-banner">{successMsg}</div>
        )}

        {/* Filtros */}
        <div className="admin-filters">
          <div className="admin-search-wrap">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M9 9l3 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
            <input
              className="admin-search"
              placeholder="Buscar por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className="admin-select" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            <option value="">Todos los roles</option>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Formulario */}
        {userForm && (
          <div className="admin-form-card">
            <h3 className="admin-form-title">{editId ? 'Editar usuario' : 'Nuevo usuario'}</h3>
            <div className="admin-form-grid">
              <div className="admin-field">
                <label>Nombre *</label>
                <input className="admin-input" value={userForm.first_name}
                  onChange={(e) => setUserForm({ ...userForm, first_name: e.target.value })}
                  placeholder="Nombre"/>
              </div>
              <div className="admin-field">
                <label>Apellido *</label>
                <input className="admin-input" value={userForm.last_name}
                  onChange={(e) => setUserForm({ ...userForm, last_name: e.target.value })}
                  placeholder="Apellido"/>
              </div>
              <div className="admin-field">
                <label>Email *</label>
                <input className="admin-input" type="email" value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  placeholder="email@restaurante.com"
                  disabled={!!editId}/>
              </div>
              <div className="admin-field">
                <label>Rol *</label>
                <select className="admin-select" value={userForm.role_name}
                  onChange={(e) => setUserForm({ ...userForm, role_name: e.target.value })}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="admin-field">
                <label>Teléfono</label>
                <input className="admin-input" value={userForm.phone}
                  onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })}
                  placeholder="+57 300 000 0000"/>
              </div>
              {!editId && (
                <div className="admin-field">
                  <label>Contraseña inicial *</label>
                  <input className="admin-input" type="password" value={userForm.password ?? ''}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    placeholder="Mínimo 6 caracteres"/>
                </div>
              )}
            </div>
            <div className="admin-form-actions">
              <button className="admin-btn-ghost" onClick={() => { setUserForm(null); setEditId(null); }}>Cancelar</button>
              <button className="admin-btn-primary" onClick={handleSave}
                disabled={!userForm.first_name || !userForm.last_name || !userForm.email || (!editId && !userForm.password) || saving}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}

        {/* Lista de usuarios */}
        {usersLoading ? (
          <div className="admin-loading"><div className="admin-spinner"/></div>
        ) : (
          <div className="admin-list">
            {/* Cabecera */}
            <div className="admin-list-head">
              <span>Usuario</span>
              <span>Rol</span>
              <span>Teléfono</span>
              <span>Estado</span>
              <span>Acciones</span>
            </div>

            {filtered.map((user) => (
              <div key={user.id} className={`admin-list-row ${!user.is_active ? 'row-inactive' : ''}`}>
                <div className="alr-user">
                  <div className="alr-avatar">{user.first_name.charAt(0)}{user.last_name.charAt(0)}</div>
                  <div>
                    <p className="alr-name">{user.first_name} {user.last_name}</p>
                    <p className="alr-email">{user.email}</p>
                  </div>
                </div>
                <span className={`role-badge ${ROLE_COLOR[user.role] ?? ''}`}>{user.role}</span>
                <span className="alr-sub">{user.phone ?? '—'}</span>
                <div>
                  <button
                    type="button"
                    className={`admin-toggle admin-toggle--sm ${user.is_active ? 'admin-toggle--on' : ''}`}
                    onClick={() => handleToggle(user)}
                    title={user.is_active ? 'Desactivar' : 'Activar'}
                  />
                </div>
                <div className="alr-actions">
                  <button className="admin-btn-sm" onClick={() => {
                    setUserForm({
                      email:      user.email,
                      first_name: user.first_name,
                      last_name:  user.last_name,
                      role_name:  user.role,
                      phone:      user.phone ?? '',
                      is_active:  user.is_active,
                    });
                    setEditId(user.id);
                  }}>Editar</button>
                  <button className="admin-btn-sm" onClick={() => { setResetId(user.id); setNewPwd(''); }}>
                    <KeyRound size={14}/> Contraseña
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="admin-empty-msg">Sin usuarios que coincidan con la búsqueda</p>
            )}
          </div>
        )}

        {/* Modal reset contraseña */}
        {resetId && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setResetId(null)}>
            <div className="admin-confirm-modal">
              <h3>Resetear contraseña</h3>
              <p>Ingresa la nueva contraseña para el usuario.</p>
              <div className="admin-field" style={{ marginTop: 14 }}>
                <label>Nueva contraseña (mínimo 6 caracteres)</label>
                <input
                  className="admin-input"
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Nueva contraseña"
                  autoFocus
                />
              </div>
              <div className="admin-form-actions" style={{ marginTop: 16 }}>
                <button className="admin-btn-ghost" onClick={() => setResetId(null)}>Cancelar</button>
                <button className="admin-btn-primary" onClick={handleResetPwd}
                  disabled={newPwd.length < 6 || saving}>
                  {saving ? 'Guardando...' : 'Cambiar contraseña'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}