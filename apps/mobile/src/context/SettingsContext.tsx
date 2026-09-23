import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { settingsRepository, LocalStoreSettings } from '../database';

export function formatCurrencyValue(
  amount: number | string | undefined | null,
  symbol: string = '$',
  useDecimals: boolean = false
): string {
  const num = typeof amount === 'number' ? amount : Number(amount) || 0;
  const separator = symbol.length > 1 ? ' ' : '';
  if (useDecimals) {
    return `${symbol}${separator}${num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `${symbol}${separator}${Math.round(num).toLocaleString()}`;
}

export interface SettingsContextData {
  settings: LocalStoreSettings | null;
  currencySymbol: string;
  useDecimals: boolean;
  storeName: string;
  storePhone: string;
  hapticEnabled: boolean;
  formatMoney: (amount: number | string | undefined | null) => string;
  updateSettings: (
    updates: Partial<Omit<LocalStoreSettings, 'id' | 'created_at' | 'sync_status'>>
  ) => Promise<LocalStoreSettings>;
  reloadSettings: () => Promise<void>;
}

const defaultContext: SettingsContextData = {
  settings: null,
  currencySymbol: '$',
  useDecimals: false,
  storeName: 'Mi Tienda de Barrio',
  storePhone: '',
  hapticEnabled: true,
  formatMoney: (amount) => formatCurrencyValue(amount, '$', false),
  updateSettings: async () => ({} as LocalStoreSettings),
  reloadSettings: async () => {},
};

const SettingsContext = createContext<SettingsContextData>(defaultContext);

export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<LocalStoreSettings | null>(null);

  const reloadSettings = useCallback(async () => {
    try {
      const data = await settingsRepository.getSettings();
      setSettings(data);
    } catch (err) {
      console.error('Error cargando configuración:', err);
    }
  }, []);

  useEffect(() => {
    reloadSettings();
  }, [reloadSettings]);

  const updateSettings = useCallback(
    async (
      updates: Partial<Omit<LocalStoreSettings, 'id' | 'created_at' | 'sync_status'>>
    ) => {
      const updated = await settingsRepository.saveSettings(updates);
      setSettings(updated);
      return updated;
    },
    []
  );

  const currencySymbol = settings?.currency_symbol || '$';
  const useDecimals = Boolean(settings?.use_decimals);
  const storeName = settings?.store_name || 'Mi Tienda de Barrio';
  const storePhone = settings?.store_phone || '';
  const hapticEnabled = settings?.haptic_enabled !== false;

  const formatMoney = useCallback(
    (amount: number | string | undefined | null) => {
      return formatCurrencyValue(amount, currencySymbol, useDecimals);
    },
    [currencySymbol, useDecimals]
  );

  return (
    <SettingsContext.Provider
      value={{
        settings,
        currencySymbol,
        useDecimals,
        storeName,
        storePhone,
        hapticEnabled,
        formatMoney,
        updateSettings,
        reloadSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}
