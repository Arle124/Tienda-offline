import { getDatabaseDriver } from '../connection';
import type { LocalStoreSettings } from '../types';
import { generateUUID } from '../../utils/uuid';
import { hashPin, verifyPin } from '../../utils/crypto';

export class SettingsRepository {
  private get driver() {
    return getDatabaseDriver();
  }

  async getSettings(): Promise<LocalStoreSettings> {
    const all = await this.driver.getAll<LocalStoreSettings>('store_settings');
    if (all.length > 0 && !all[0].is_deleted) {
      const record = all[0];
      return {
        ...record,
        currency_symbol: record.currency_symbol || '$',
        use_decimals: Boolean(record.use_decimals),
        store_phone: record.store_phone || '',
        haptic_enabled: record.haptic_enabled !== false && (record.haptic_enabled as any) !== 0,
      };
    }

    // Configuración inicial por defecto (PIN por defecto: '1234')
    const now = new Date().toISOString();
    const defaultSettings: LocalStoreSettings = {
      id: generateUUID(),
      store_name: 'Mi Tienda de Barrio',
      owner_pin_hash: hashPin('1234'),
      currency_symbol: '$',
      use_decimals: false,
      store_phone: '',
      haptic_enabled: true,
      created_at: now,
      updated_at: now,
      is_deleted: false,
      sync_status: 'pending_insert',
    };

    return await this.driver.insert<LocalStoreSettings>(
      'store_settings',
      defaultSettings
    );
  }

  async saveSettings(
    updates: Partial<Omit<LocalStoreSettings, 'id' | 'created_at' | 'sync_status'>>
  ): Promise<LocalStoreSettings> {
    const current = await this.getSettings();
    return await this.driver.update<LocalStoreSettings>(
      'store_settings',
      current.id,
      {
        ...updates,
        updated_at: new Date().toISOString(),
        sync_status: 'pending_update',
      }
    );
  }

  async verifyOwnerPin(pin: string): Promise<boolean> {
    const settings = await this.getSettings();
    return verifyPin(pin, settings.owner_pin_hash);
  }

  async setOwnerPin(newPin: string): Promise<void> {
    const newHash = hashPin(newPin);
    await this.saveSettings({ owner_pin_hash: newHash });
  }

  async getDeviceId(): Promise<string> {
    let deviceId = await this.driver.getMeta('device_id');
    if (!deviceId) {
      deviceId = `dev_${generateUUID().substring(0, 8)}`;
      await this.driver.setMeta('device_id', deviceId);
    }
    return deviceId;
  }

  async getLastSyncTimestamp(): Promise<string | null> {
    return await this.driver.getMeta('last_sync_timestamp');
  }

  async setLastSyncTimestamp(timestamp: string): Promise<void> {
    await this.driver.setMeta('last_sync_timestamp', timestamp);
  }
}

export const settingsRepository = new SettingsRepository();
