import { formatCOP } from '../../utils/constants';
// ============================================================
// frontend/src/pages/mesero/TakeOrder.tsx
// Ruta: /mesero/orden/:tableId
//
// Pantalla de toma de orden del mesero. Diseño profesional
// orientado a uso frecuente y rápido en tablet.
//
// FLUJO:
//   1. Recibe tableId desde la URL (viene de TableDashboard)
//   2. Carga menú via useMenu() (hook existente)
//   3. Mesero agrega items al carrito (waiterStore.cart)
//   4. Confirma la orden → POST /api/orders con source:'waiter'
//   5. Backend registra waiter_id, table_id, actualiza mesa a 'occupied'
//   6. Redirige de vuelta al TableDashboard
//
// DIFERENCIAS con ClientMenu.tsx (autoservicio):
//   - Tiene búsqueda de items por nombre
//   - Panel lateral del carrito siempre visible (no modal)
//   - Notas por item inline (sin modal extra)
//   - Sin animaciones de FAB ni badge — interfaz profesional
//   - Requiere autenticación (mesero)
// ============================================================

import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams }  from 'react-router-dom';
import { useAppStore }             from '../../store/appStore';
import { useWaiterStore }          from '../../store/waiterStore';
import { useMenu }                 from '../../hooks/useMenu';
import { createWaiterOrder, getTables } from '../../services/waiterService';
import { ApiError }                from '../../services/api';
import type { MenuItem }           from '../../types/menu';
import '../../styles/takeorder.css';

export default function TakeOrder() {
  const { tableId }  = useParams<{ tableId: string }>();
  const navigate     = useNavigate();
  const { user }     = useAppStore();

  const {
    tables, setTables,
    cart, initCart,
    addToCart, removeFromCart, updateCartQty, updateItemNotes,
    setOrderNotes,
    clearCart, getCartTotal, getCartItemCount,
    updateTableStatus,
  } = useWaiterStore();

  const { categories, items, activeCategory, selectCategory, loading, loadingItems, hasCategories } = useMenu();

  const [search,        setSearch]        = useState('');
  const [submitting,    setSubmitting]    = useState(false);
  const [submitError,   setSubmitError]   = useState<string | null>(null);
  const [editingNotes,  setEditingNotes]  = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Obtener datos de la mesa desde el store
  const table = tables.find((t) => t.id === tableId);

  // ── Inicializar carrito para esta mesa ─────────────────────
  useEffect(() => {
    if (!tableId) return;

    // Si no hay datos de la mesa en el store, cargarlos
    if (!table) {
      getTables().then(setTables).catch(() => {});
    }

    // Iniciar carrito si no existe o es de otra mesa
    if (!cart || cart.tableId !== tableId) {
      const tableNumber = table?.number ?? 0;
      initCart(tableId, tableNumber);
    }
  }, [tableId]); // eslint-disable-line

  // Filtrar items por búsqueda
  const filteredItems = search.trim()
    ? items.filter((i) =>
        i.name.toLowerCase().includes(search.toLowerCase()) ||
        i.description?.toLowerCase().includes(search.toLowerCase())
      )
    : items;

  // ── Agregar item al carrito ────────────────────────────────
  const handleAdd = useCallback((item: MenuItem) => {
    addToCart({
      menuItemId: item.id,
      name:       item.name,
      price:      item.price,
      notes:      '',
    });
  }, [addToCart]);

  // ── Enviar orden al backend ────────────────────────────────
  async function handleSubmit() {
    if (!cart || cart.items.length === 0 || !tableId) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      await createWaiterOrder({
        table_id:       tableId,
        source:         'waiter',
        items: cart.items.map((i) => ({
          menu_item_id:         i.menuItemId,
          quantity:             i.quantity,
          special_instructions: i.notes,
        })),
        notes:          cart.orderNotes,
        waiter_id:      user?.id,
      });

      // Actualizar mesa a occupied en el store local
      updateTableStatus(tableId, 'occupied');
      clearCart();
      navigate('/mesero/dashboard');
    } catch (e) {
      setSubmitError(
        e instanceof ApiError
          ? e.message
          : 'Error al enviar la orden. Intenta de nuevo.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  const cartTotal     = getCartTotal();
  const cartItemCount = getCartItemCount();
  const tax           = cartTotal * 0.08;

  return (
    <div className="takeorder-root">
      {/* ── Header ── */}
      <header className="to-header">
        <button
          type="button"
          className="to-back"
          onClick={() => { clearCart(); navigate('/mesero/dashboard'); }}
          aria-label="Volver al mapa de mesas"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          Mesas
        </button>

        <div className="to-header-center">
          <h1 className="to-title">
            Mesa {table?.number ?? '...'}
          </h1>
          <span className="to-capacity">
            {table?.capacity ?? '—'} personas · {table?.section ?? ''}
          </span>
        </div>

        <div className="to-header-right">
          <span className="to-waiter">{user?.name ?? 'Mesero'}</span>
        </div>
      </header>

      <div className="to-body">
        {/* ── Panel izquierdo: Menú ── */}
        <section className="to-menu-panel" aria-label="Menú">
          {/* Búsqueda */}
          <div className="to-search-wrap">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input
              ref={searchRef}
              type="search"
              className="to-search"
              placeholder="Buscar item..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Buscar en el menú"
            />
            {search && (
              <button
                type="button"
                className="to-search-clear"
                onClick={() => { setSearch(''); searchRef.current?.focus(); }}
                aria-label="Limpiar búsqueda"
              >×</button>
            )}
          </div>

          {/* Tabs de categorías */}
          {!search && (
            <nav className="to-cat-tabs" aria-label="Categorías">
              {loading ? (
                <div className="to-cats-skeleton">
                  {[1,2,3,4].map((i) => (
                    <div key={i} className="to-cat-skel" />
                  ))}
                </div>
              ) : (
                categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`to-cat-tab ${activeCategory === cat.id ? 'to-cat-tab--active' : ''}`}
                    onClick={() => selectCategory(cat.id)}
                  >
                    {cat.icon && <span aria-hidden="true">{cat.icon}</span>}
                    {cat.name}
                  </button>
                ))
              )}
            </nav>
          )}

          {/* Grid de items */}
          <div className="to-items-area">
            {loadingItems ? (
              <div className="to-items-loading">
                {[1,2,3,4,5,6].map((i) => (
                  <div key={i} className="to-item-skel" />
                ))}
              </div>
            ) : !hasCategories ? (
              <div className="to-empty">
                <p>El menú aún no tiene categorías</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="to-empty">
                <p>{search ? `Sin resultados para "${search}"` : 'Sin items en esta categoría'}</p>
              </div>
            ) : (
              <ul className="to-items-grid" role="list">
                {filteredItems.map((item) => {
                  const inCart = cart?.items.find((c) => c.menuItemId === item.id);
                  return (
                    <li
                      key={item.id}
                      className={`to-item ${item.is_out_of_stock ? 'to-item--oos' : ''}`}
                    >
                      <div className="to-item-info">
                        <span className="to-item-name">{item.name}</span>
                        {item.description && (
                          <span className="to-item-desc">{item.description}</span>
                        )}
                        <span className="to-item-price">
                          {formatCOP(parseFloat(item.price as unknown as string))}
                        </span>
                        {item.preparation_time && (
                          <span className="to-item-time">~{item.preparation_time}min</span>
                        )}
                      </div>

                      <div className="to-item-actions">
                        {inCart ? (
                          /* Controles de cantidad */
                          <div className="to-qty-ctrl">
                            <button
                              type="button"
                              className="to-qty-btn"
                              onClick={() => updateCartQty(item.id, inCart.quantity - 1)}
                              aria-label={`Reducir ${item.name}`}
                            >−</button>
                            <span className="to-qty-val">{inCart.quantity}</span>
                            <button
                              type="button"
                              className="to-qty-btn"
                              onClick={() => updateCartQty(item.id, inCart.quantity + 1)}
                              aria-label={`Aumentar ${item.name}`}
                            >+</button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="to-add-btn"
                            onClick={() => handleAdd(item)}
                            disabled={item.is_out_of_stock}
                            aria-label={`Agregar ${item.name}`}
                          >
                            {item.is_out_of_stock ? 'Agotado' : '+'}
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* ── Panel derecho: Carrito ── */}
        <aside className="to-cart-panel" aria-label="Carrito">
          <div className="to-cart-header">
            <h2 className="to-cart-title">Orden actual</h2>
            <span className="to-cart-count">
              {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'}
            </span>
          </div>

          {/* Items del carrito */}
          {!cart || cart.items.length === 0 ? (
            <div className="to-cart-empty">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect x="6" y="14" width="28" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" opacity="0.25"/>
                <path d="M13 14v-4a7 7 0 0114 0v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.25"/>
              </svg>
              <p>Agrega items del menú</p>
            </div>
          ) : (
            <ul className="to-cart-list">
              {cart.items.map((item) => (
                <li key={item.menuItemId} className="to-cart-item">
                  <div className="to-ci-main">
                    <div className="to-ci-info">
                      <span className="to-ci-qty">{item.quantity}×</span>
                      <span className="to-ci-name">{item.name}</span>
                    </div>
                    <div className="to-ci-right">
                      <span className="to-ci-price">
                        {formatCOP(item.price * item.quantity)}
                      </span>
                      <button
                        type="button"
                        className="to-ci-remove"
                        onClick={() => removeFromCart(item.menuItemId)}
                        aria-label={`Quitar ${item.name}`}
                      >×</button>
                    </div>
                  </div>
                  {/* Notas inline por item */}
                  {editingNotes === item.menuItemId ? (
                    <input
                      type="text"
                      className="to-ci-notes-input"
                      placeholder="Instrucciones especiales..."
                      value={item.notes}
                      onChange={(e) => updateItemNotes(item.menuItemId, e.target.value)}
                      onBlur={() => setEditingNotes(null)}
                      autoFocus
                      maxLength={100}
                    />
                  ) : (
                    <button
                      type="button"
                      className="to-ci-notes-btn"
                      onClick={() => setEditingNotes(item.menuItemId)}
                    >
                      {item.notes || '+ Notas especiales'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {/* Notas de la orden completa */}
          <div className="to-order-notes">
            <label className="to-notes-label" htmlFor="order-notes">
              Notas de la orden
            </label>
            <textarea
              id="order-notes"
              className="to-notes-input"
              placeholder="Alergias, preferencias generales..."
              value={cart?.orderNotes ?? ''}
              onChange={(e) => setOrderNotes(e.target.value)}
              rows={2}
              maxLength={200}
            />
          </div>

          {/* Totales */}
          {cart && cart.items.length > 0 && (
            <div className="to-totals">
              <div className="to-total-row">
                <span>Subtotal</span>
                <span>{formatCOP(cartTotal)}</span>
              </div>
              <div className="to-total-row to-total-tax">
                <span>IVA (8%)</span>
                <span>{formatCOP(tax)}</span>
              </div>
              <div className="to-total-divider" />
              <div className="to-total-row to-total-final">
                <span>Total est.</span>
                <span>{formatCOP(cartTotal + tax)}</span>
              </div>
            </div>
          )}

          {/* Error de envío */}
          {submitError && (
            <div className="to-submit-error" role="alert">
              {submitError}
            </div>
          )}

          {/* Botón de enviar */}
          <button
            type="button"
            className="to-submit-btn"
            onClick={handleSubmit}
            disabled={!cart || cart.items.length === 0 || submitting}
          >
            {submitting ? (
              <span className="btn-spinner" aria-hidden="true" />
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M3 9l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                Enviar a cocina
              </>
            )}
          </button>
        </aside>
      </div>
    </div>
  );
}