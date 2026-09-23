import React, { useState, useEffect } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSettings, formatCurrencyValue } from '../context/SettingsContext';
import { useToast } from './Toast';
import { settingsRepository, UserRole } from '../database';

const QUICK_CURRENCIES = [
  { symbol: '$', label: '$ (COP / MXN / USD / CLP)' },
  { symbol: 'S/', label: 'S/ (Sol Peruano)' },
  { symbol: 'Bs', label: 'Bs (Boliviano)' },
  { symbol: 'Q', label: 'Q (Quetzal Guat.)' },
  { symbol: '€', label: '€ (Euro)' },
  { symbol: '₡', label: '₡ (Colón C.R.)' },
];

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  currentRole: UserRole;
  onRoleChange?: (newRole: UserRole) => void;
}

export function SettingsModal({
  visible,
  onClose,
  currentRole,
  onRoleChange,
}: SettingsModalProps) {
  const {
    settings,
    currencySymbol,
    useDecimals,
    storeName,
    storePhone,
    hapticEnabled,
    updateSettings,
  } = useSettings();
  const { showToast } = useToast();

  // Estado local para edición
  const [tempStoreName, setTempStoreName] = useState(storeName);
  const [tempStorePhone, setTempStorePhone] = useState(storePhone);
  const [tempCurrency, setTempCurrency] = useState(currencySymbol);
  const [tempDecimals, setTempDecimals] = useState(useDecimals);
  const [tempHaptic, setTempHaptic] = useState(hapticEnabled);

  // Desbloqueo temporal de administración dentro del modal si el rol es mostrador
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(currentRole === 'duena');
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminPinError, setAdminPinError] = useState('');

  // Cambio de PIN de administrador
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);

  useEffect(() => {
    if (visible) {
      setTempStoreName(storeName);
      setTempStorePhone(storePhone);
      setTempCurrency(currencySymbol);
      setTempDecimals(useDecimals);
      setTempHaptic(hapticEnabled);
      setIsAdminUnlocked(currentRole === 'duena');
      setAdminPinInput('');
      setAdminPinError('');
      setNewPin('');
      setConfirmPin('');
      setIsChangingPin(false);
    }
  }, [visible, storeName, storePhone, currencySymbol, useDecimals, hapticEnabled, currentRole]);

  const handleUnlockAdmin = async () => {
    if (!adminPinInput) {
      setAdminPinError('Ingresa el PIN de 4 dígitos');
      return;
    }
    const isValid = await settingsRepository.verifyOwnerPin(adminPinInput);
    if (isValid) {
      setIsAdminUnlocked(true);
      setAdminPinError('');
      setAdminPinInput('');
      showToast({
        type: 'success',
        title: 'Acceso Concedido',
        message: 'Ajustes del negocio desbloqueados.',
      });
    } else {
      setAdminPinError('PIN incorrecto. (Por defecto: 1234)');
    }
  };

  const handleSaveSettings = async () => {
    try {
      await updateSettings({
        store_name: tempStoreName.trim() || 'Mi Tienda de Barrio',
        store_phone: tempStorePhone.trim(),
        currency_symbol: tempCurrency.trim() || '$',
        use_decimals: tempDecimals,
        haptic_enabled: tempHaptic,
      });

      showToast({
        type: 'success',
        title: 'Ajustes Guardados',
        message: 'La configuración del negocio se actualizó correctamente.',
      });
      onClose();
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Error al Guardar',
        message: 'No se pudieron actualizar los ajustes.',
      });
    }
  };

  const handleUpdatePin = async () => {
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      showToast({
        type: 'warning',
        title: 'PIN Inválido',
        message: 'El nuevo PIN debe tener exactamente 4 números.',
      });
      return;
    }

    if (newPin !== confirmPin) {
      showToast({
        type: 'warning',
        title: 'PIN no coincide',
        message: 'La confirmación del PIN no coincide.',
      });
      return;
    }

    try {
      await settingsRepository.setOwnerPin(newPin);
      setNewPin('');
      setConfirmPin('');
      setIsChangingPin(false);
      showToast({
        type: 'success',
        title: 'PIN Actualizado',
        message: 'El nuevo PIN de Administrador quedó registrado.',
      });
    } catch {
      showToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo cambiar el PIN.',
      });
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalCard}>
          {/* Header del Modal */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>⚙️ Ajustes del Sistema</Text>
              <Text style={styles.headerSubtitle}>
                Mi Cuaderno Digital • v1.0.1 (Offline Local)
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* SECCIÓN 1: PREFERENCIAS DEL DISPOSITIVO (ACCESIBLE PARA TODOS) */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>📱 Preferencias del Dispositivo</Text>
              <Text style={styles.sectionSubtitle}>
                Ajustes individuales para el uso en este teléfono.
              </Text>

              <View style={styles.rowBetween}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={styles.rowTitle}>📳 Vibración Háptica</Text>
                  <Text style={styles.rowDescription}>
                    Respuesta táctil al cobrar ventas y pulsar botones de acción.
                  </Text>
                </View>
                <Switch
                  value={tempHaptic}
                  onValueChange={setTempHaptic}
                  trackColor={{ false: '#CBD5E1', true: '#10B981' }}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={[styles.rowBetween, { borderTopWidth: 1, borderColor: '#F1F5F9', paddingTop: 12, marginTop: 12 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>⚡ Modo Operativo</Text>
                  <Text style={styles.rowDescription}>
                    0ms de latencia • SQLite Local Autónomo
                  </Text>
                </View>
                <View style={styles.statusBadge}>
                  <Text style={styles.statusBadgeText}>Activo</Text>
                </View>
              </View>
            </View>

            {/* SECCIÓN 2: AJUSTES DEL NEGOCIO (PROTEGIDO POR PIN) */}
            {!isAdminUnlocked ? (
              <View style={styles.lockedCard}>
                <View style={styles.lockedIconContainer}>
                  <Text style={styles.lockedIcon}>🔒</Text>
                </View>
                <Text style={styles.lockedTitle}>Ajustes del Negocio Protegidos</Text>
                <Text style={styles.lockedDescription}>
                  Para cambiar moneda, nombre del negocio, teléfono o PIN, ingresa el PIN de Administrador.
                </Text>

                <View style={styles.pinUnlockRow}>
                  <TextInput
                    style={styles.pinInput}
                    placeholder="PIN (4 dígitos)"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    maxLength={4}
                    secureTextEntry
                    value={adminPinInput}
                    onChangeText={setAdminPinInput}
                  />
                  <TouchableOpacity
                    style={styles.unlockButton}
                    onPress={handleUnlockAdmin}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.unlockButtonText}>Desbloquear</Text>
                  </TouchableOpacity>
                </View>
                {Boolean(adminPinError) && (
                  <Text style={styles.errorText}>{adminPinError}</Text>
                )}
              </View>
            ) : (
              <>
                {/* 1. Moneda y Formato Regional */}
                <View style={styles.sectionCard}>
                  <View style={styles.badgeHeaderRow}>
                    <Text style={styles.sectionTitle}>🌎 Moneda y Formato Regional</Text>
                    <View style={styles.adminBadge}>
                      <Text style={styles.adminBadgeText}>Admin</Text>
                    </View>
                  </View>
                  <Text style={styles.sectionSubtitle}>
                    Personaliza el símbolo de tu país y el manejo de centavos.
                  </Text>

                  {/* Selector rápido de divisas */}
                  <Text style={styles.fieldLabel}>Símbolos Frecuentes:</Text>
                  <View style={styles.chipsRow}>
                    {QUICK_CURRENCIES.map((c) => {
                      const isSelected = tempCurrency === c.symbol;
                      return (
                        <TouchableOpacity
                          key={c.symbol}
                          style={[
                            styles.chip,
                            isSelected && styles.chipActive,
                          ]}
                          onPress={() => setTempCurrency(c.symbol)}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              isSelected && styles.chipTextActive,
                            ]}
                          >
                            {c.symbol}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Campo libre de símbolo */}
                  <Text style={styles.fieldLabel}>O ingresa tu propio prefijo:</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: $, S/, Bs, Q, €, ₡, L, C$"
                    placeholderTextColor="#94A3B8"
                    value={tempCurrency}
                    onChangeText={setTempCurrency}
                    maxLength={5}
                  />

                  {/* Switch de Decimales */}
                  <View style={[styles.rowBetween, { marginTop: 12 }]}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <Text style={styles.rowTitle}>Manejo de Decimales (Centavos)</Text>
                      <Text style={styles.rowDescription}>
                        Actívalo para Perú, México, EE.UU. o Europa ({tempCurrency} 12.50). Desactívalo para Colombia o Chile ({tempCurrency} 12.500).
                      </Text>
                    </View>
                    <Switch
                      value={tempDecimals}
                      onValueChange={setTempDecimals}
                      trackColor={{ false: '#CBD5E1', true: '#2563EB' }}
                      thumbColor="#FFFFFF"
                    />
                  </View>

                  {/* Vista Previa en Vivo */}
                  <View style={styles.previewBox}>
                    <Text style={styles.previewLabel}>Vista Previa en Pantalla:</Text>
                    <Text style={styles.previewValue}>
                      {formatCurrencyValue(24500.5, tempCurrency, tempDecimals)}
                    </Text>
                  </View>
                </View>

                {/* 2. Identidad del Negocio */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>🏪 Identidad de la Tienda</Text>
                  <Text style={styles.sectionSubtitle}>
                    Aparece en reportes de Excel y mensajes automáticos de WhatsApp.
                  </Text>

                  <Text style={styles.fieldLabel}>Nombre de la Tienda:</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: Abarrotes La Bendición"
                    placeholderTextColor="#94A3B8"
                    value={tempStoreName}
                    onChangeText={setTempStoreName}
                  />

                  <Text style={[styles.fieldLabel, { marginTop: 12 }]}>
                    Teléfono / WhatsApp de Contacto:
                  </Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Ej: 3001234567"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    value={tempStorePhone}
                    onChangeText={setTempStorePhone}
                  />
                </View>

                {/* 3. Seguridad y PIN */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>🔐 Seguridad de Administración</Text>
                  <Text style={styles.sectionSubtitle}>
                    Protege el cierre de caja, deudas e inventario.
                  </Text>

                  {!isChangingPin ? (
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => setIsChangingPin(true)}
                    >
                      <Text style={styles.secondaryButtonText}>
                        🔑 Modificar PIN de Administrador
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.pinChangeBox}>
                      <Text style={styles.fieldLabel}>Nuevo PIN (4 dígitos numéricos):</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="••••"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        maxLength={4}
                        secureTextEntry
                        value={newPin}
                        onChangeText={setNewPin}
                      />

                      <Text style={[styles.fieldLabel, { marginTop: 8 }]}>
                        Confirmar Nuevo PIN:
                      </Text>
                      <TextInput
                        style={styles.input}
                        placeholder="••••"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        maxLength={4}
                        secureTextEntry
                        value={confirmPin}
                        onChangeText={setConfirmPin}
                      />

                      <View style={styles.pinActionRow}>
                        <TouchableOpacity
                          style={styles.cancelSmallButton}
                          onPress={() => {
                            setIsChangingPin(false);
                            setNewPin('');
                            setConfirmPin('');
                          }}
                        >
                          <Text style={styles.cancelSmallButtonText}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.saveSmallButton}
                          onPress={handleUpdatePin}
                        >
                          <Text style={styles.saveSmallButtonText}>Guardar PIN</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              </>
            )}

            {/* SECCIÓN 3: ACERCA DE LA APP */}
            <View style={styles.infoFooter}>
              <Text style={styles.infoTitle}>Mi Cuaderno Digital</Text>
              <Text style={styles.infoText}>
                Versión 1.0.1 • Diseñado para el Comercio Latinoamericano
              </Text>
              <Text style={styles.infoSubtext}>
                Almacenamiento Local Offline • Seguridad y Privacidad Garantizada
              </Text>
            </View>
          </ScrollView>

          {/* Footer de Acciones del Modal */}
          {isAdminUnlocked && (
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.saveSettingsButton}
                onPress={handleSaveSettings}
                activeOpacity={0.8}
              >
                <Text style={styles.saveSettingsButtonText}>
                  💾 Guardar Cambios del Negocio
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    minHeight: '60%',
    display: 'flex',
  },
  header: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
  },
  closeButton: {
    backgroundColor: '#1E293B',
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  closeButtonText: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  badgeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  adminBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  adminBadgeText: {
    color: '#B45309',
    fontSize: 10,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  rowDescription: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusBadgeText: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: 'bold',
  },
  lockedCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    alignItems: 'center',
  },
  lockedIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  lockedIcon: {
    fontSize: 22,
  },
  lockedTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#92400E',
    marginBottom: 4,
  },
  lockedDescription: {
    fontSize: 12,
    color: '#B45309',
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 17,
  },
  pinUnlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    maxWidth: 280,
  },
  pinInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F59E0B',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    textAlign: 'center',
    color: '#0F172A',
    fontWeight: 'bold',
    letterSpacing: 4,
  },
  unlockButton: {
    backgroundColor: '#F59E0B',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  unlockButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '500',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  chipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#1D4ED8',
  },
  chipText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#334155',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  previewBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  previewValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
    marginTop: 4,
  },
  secondaryButton: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#334155',
    fontWeight: 'bold',
    fontSize: 13,
  },
  pinChangeBox: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pinActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  cancelSmallButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  cancelSmallButtonText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: 'bold',
  },
  saveSmallButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#2563EB',
  },
  saveSmallButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  infoFooter: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#64748B',
  },
  infoText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  infoSubtext: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  footer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
  },
  saveSettingsButton: {
    backgroundColor: '#10B981',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveSettingsButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
