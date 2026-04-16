// ============================================================
// frontend/src/hooks/useMenu.ts
//
// Carga categorías y items del menú con manejo de estado
// (loading, error, datos). Filtra items por categoría activa.
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { getCategories, getMenuItems } from '../services/menuService';
import type { MenuCategory, MenuItem } from '../types/menu';

export function useMenu() {
  const [categories, setCategories]       = useState<MenuCategory[]>([]);
  const [items, setItems]                 = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loadingCats, setLoadingCats]     = useState(true);
  const [loadingItems, setLoadingItems]   = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  // Cargar categorías al montar
  useEffect(() => {
    let cancelled = false;
    setLoadingCats(true);
    getCategories()
      .then((cats) => {
        if (cancelled) return;
        setCategories(cats);
        // Seleccionar la primera categoría automáticamente
        if (cats.length > 0) setActiveCategory(cats[0].id);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingCats(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Cargar items cuando cambia la categoría activa
  useEffect(() => {
    if (!activeCategory) return;
    let cancelled = false;
    setLoadingItems(true);
    setError(null);
    getMenuItems(activeCategory)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingItems(false);
      });
    return () => { cancelled = true; };
  }, [activeCategory]);

  const selectCategory = useCallback((id: string) => {
    setActiveCategory(id);
  }, []);

  return {
    categories,
    items,
    activeCategory,
    selectCategory,
    loading: loadingCats || loadingItems,
    loadingItems,
    error,
  };
}