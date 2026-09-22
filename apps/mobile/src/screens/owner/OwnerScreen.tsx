import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import {
  UserRole,
  settingsRepository,
  saleRepository,
  LocalCustomer,
  LocalProduct,
  TodaySalesSummary,
} from '../../database';
import {
  shareOrDownloadCsv,
  generateSalesCsv,
  generateDebtorsCsv,
  generateInventoryCsv,
} from '../../utils/excel';

interface OwnerScreenProps {
  role: UserRole;
  customers: LocalCustomer[];
  products: LocalProduct[];
  pendingCount: number;
  onRoleChange: (newRole: UserRole) => void;
  onRefreshData: () => Promise<void>;
}

export function OwnerScreen({
  role,
  customers,
  products,
  pendingCount,
  onRoleChange,
  onRefreshData,
}: OwnerScreenProps) {
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [todaySummary, setTodaySummary] = useState<TodaySalesSummary | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Cuadre / Arqueo de caja
  const [countedCash, setCountedCash] = useState('');

  // Modal para cambiar PIN
  const [changePinModal, setChangePinModal] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [changePinError, setChangePinError] = useState('');

  const loadSummary = useCallback(async () => {
    try {
      const summary = await saleRepository.getTodaySummary();
      setTodaySummary(summary);
    } catch (err) {
      console.error('Error cargando resumen de finanzas:', err);
    }
  }, []);

  useEffect(() => {
    if (role === 'duena') {
      loadSummary();
    }
  }, [role, loadSummary]);

  const handleUnlock = async () => {
    setPinError('');
    const isValid = await settingsRepository.verifyOwnerPin(pinInput);
    if (isValid) {
      onRoleChange('duena');
      setPinInput('');
    } else {
      setPinError('PIN incorrecto. (Por defecto es 1234)');
    }
  };

  const handleChangePin = async () => {
    setChangePinError('');
    if (newPin.length < 4) {
      setChangePinError('El nuevo PIN debe tener al menos 4 dígitos.');
      return;
    }

    const isValidCurrent = await settingsRepository.verifyOwnerPin(currentPin);
    if (!isValidCurrent) {
      setChangePinError('El PIN actual es incorrecto.');
      return;
    }

    try {
      await settingsRepository.setOwnerPin(newPin);
      setChangePinModal(false);
      setCurrentPin('');
      setNewPin('');
      const msg = '✅ PIN de Dueña actualizado con éxito.';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Listo', msg);
    } catch (err: any) {
      setChangePinError(`Error: ${err.message}`);
    }
  };

  const handleExportSales = async () => {
    setIsExporting(true);
    try {
      const { sales, items } = await saleRepository.getAllSalesAndItems();
      const csv = generateSalesCsv(sales, items, customers);
      const todayStr = new Date().toISOString().slice(0, 10);
      await shareOrDownloadCsv(`Reporte_Ventas_${todayStr}.csv`, csv);
    } catch (err: any) {
      const msg = `Error al exportar ventas: ${err.message}`;
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportDebtors = async () => {
    setIsExporting(true);
    try {
      const csv = generateDebtorsCsv(customers);
      const todayStr = new Date().toISOString().slice(0, 10);
      await shareOrDownloadCsv(`Libreta_Fiados_${todayStr}.csv`, csv);
    } catch (err: any) {
      const msg = `Error al exportar fiados: ${err.message}`;
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportInventory = async () => {
    setIsExporting(true);
    try {
      const csv = generateInventoryCsv(products);
      const todayStr = new Date().toISOString().slice(0, 10);
      await shareOrDownloadCsv(`Inventario_Tienda_${todayStr}.csv`, csv);
    } catch (err: any) {
      const msg = `Error al exportar inventario: ${err.message}`;
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Error', msg);
    } finally {
      setIsExporting(false);
    }
  };

  const totalStreetDebt = customers.reduce(
    (sum, c) => sum + (c.current_debt || 0),
    0
  );

  const theoreticalCashInDrawer = todaySummary ? todaySummary.totalRevenueToday : 0;
  const countedNum = parseFloat(countedCash.replace(/[^0-9]/g, ''));
  const cashDifference = !isNaN(countedNum) ? countedNum - theoreticalCashInDrawer : null;

  // Si no está desbloqueado, mostrar pantalla de PIN
  if (role !== 'duena') {
    return (
      <View style={styles.lockedContainer}>
        <View style={styles.lockCard}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.lockTitle}>Modo Dueña Protegido</Text>
          <Text style={styles.lockSubtitle}>
            Ingresa tu PIN de 4 dígitos para acceder al cierre de caja, finanzas y arqueo.
          </Text>

          <TextInput
            style={styles.pinInput}
            secureTextEntry
            keyboardType="numeric"
            maxLength={4}
            placeholder="••••"
            value={pinInput}
            onChangeText={setPinInput}
            autoFocus
          />

          {Boolean(pinError) && <Text style={styles.errorText}>{pinError}</Text>}

          <TouchableOpacity style={styles.unlockBtn} onPress={handleUnlock}>
            <Text style={styles.unlockBtnText}>Entrar como Dueña</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Cabecera Modo Dueña */}
      <View style={styles.headerCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>👑 Panel Financiero de la Dueña</Text>
          <Text style={styles.headerSubtitle}>
            Cierre de caja y salud económica del negocio
          </Text>
        </View>
        <TouchableOpacity
          style={styles.lockExitBtn}
          onPress={() => onRoleChange('tendera')}
        >
          <Text style={styles.lockExitBtnText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>

      {/* Métricas Principales del Día */}
      <View style={styles.metricsGrid}>
        {/* Efectivo en Caja */}
        <View style={[styles.kpiCard, { backgroundColor: '#DCFCE7' }]}>
          <Text style={styles.kpiLabel}>💵 Efectivo que debe haber en Caja Hoy</Text>
          <Text style={[styles.kpiValue, { color: '#166534' }]}>
            ${theoreticalCashInDrawer.toLocaleString()}
          </Text>
          <Text style={styles.kpiSub}>
            (Ventas de contado: ${todaySummary?.totalCashSales.toLocaleString() || '0'} + Abonos de fiados recibidos: $
            {todaySummary?.totalPaymentsReceived.toLocaleString() || '0'})
          </Text>
        </View>

        {/* Fiados de Hoy vs Cartera Total */}
        <View style={styles.kpiRow}>
          <View style={[styles.kpiCardMini, { backgroundColor: '#FEF9C3' }]}>
            <Text style={styles.kpiMiniLabel}>📝 Fiado Hoy</Text>
            <Text style={[styles.kpiMiniValue, { color: '#854D0E' }]}>
              ${todaySummary?.totalDebtSales.toLocaleString() || '0'}
            </Text>
          </View>

          <View style={[styles.kpiCardMini, { backgroundColor: '#FEE2E2' }]}>
            <Text style={styles.kpiMiniLabel}>📒 Total en la Calle</Text>
            <Text style={[styles.kpiMiniValue, { color: '#991B1B' }]}>
              ${totalStreetDebt.toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      {/* Herramienta: Arqueo / Cuadre de Caja */}
      <View style={styles.sectionBox}>
        <Text style={styles.sectionTitle}>💰 Cuadre / Arqueo de Caja del Día</Text>
        <Text style={styles.sectionSubtitle}>
          Cuenta el efectivo físico en el cajón y compáralo con el sistema
        </Text>

        <View style={styles.cashCountRow}>
          <Text style={styles.fieldLabel}>Efectivo contado en cajón ($):</Text>
          <TextInput
            style={styles.cashCountInput}
            keyboardType="numeric"
            placeholder="Ej: 85000"
            value={countedCash}
            onChangeText={setCountedCash}
          />
        </View>

        {cashDifference !== null && (
          <View
            style={[
              styles.diffBox,
              cashDifference === 0
                ? styles.diffExact
                : cashDifference > 0
                ? styles.diffSurplus
                : styles.diffDeficit,
            ]}
          >
            <Text style={styles.diffTitle}>
              {cashDifference === 0
                ? '✅ ¡Caja Cuadrada Perfecta!'
                : cashDifference > 0
                ? `🟢 Sobrante en Caja: +$${cashDifference.toLocaleString()}`
                : `🔴 Faltante en Caja: -$${Math.abs(cashDifference).toLocaleString()}`}
            </Text>
            <Text style={styles.diffDetails}>
              En sistema: ${theoreticalCashInDrawer.toLocaleString()} • En mano: $
              {countedNum.toLocaleString()}
            </Text>
          </View>
        )}
      </View>

      {/* Reportes para Contabilidad / Excel / DIAN */}
      <View style={styles.sectionBox}>
        <Text style={styles.sectionTitle}>📊 Reportes en Excel / CSV</Text>
        <Text style={styles.sectionSubtitle}>
          Genera reportes para contabilidad, DIAN o respaldos. Puedes compartirlos directamente por WhatsApp o descargarlos.
        </Text>

        <View style={styles.reportButtonsList}>
          {/* Reporte de Ventas */}
          <TouchableOpacity
            style={[styles.reportBtn, { borderColor: '#16A34A', backgroundColor: '#F0FDF4' }]}
            onPress={handleExportSales}
            disabled={isExporting}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.reportBtnTitle, { color: '#15803D' }]}>
                📈 Reporte de Ventas Detallado
              </Text>
              <Text style={styles.reportBtnDesc}>
                Todas las ventas, cobros de contado, créditos fiados y desglose de artículos.
              </Text>
            </View>
            <Text style={styles.reportBtnIcon}>📥</Text>
          </TouchableOpacity>

          {/* Reporte de Cartera / Fiados */}
          <TouchableOpacity
            style={[styles.reportBtn, { borderColor: '#D97706', backgroundColor: '#FFFBEB' }]}
            onPress={handleExportDebtors}
            disabled={isExporting}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.reportBtnTitle, { color: '#B45309' }]}>
                📒 Libreta de Fiados (Cartera)
              </Text>
              <Text style={styles.reportBtnDesc}>
                Lista de todos los vecinos, teléfonos, deudas pendientes y estado de cuenta.
              </Text>
            </View>
            <Text style={styles.reportBtnIcon}>📥</Text>
          </TouchableOpacity>

          {/* Reporte de Inventario */}
          <TouchableOpacity
            style={[styles.reportBtn, { borderColor: '#2563EB', backgroundColor: '#EFF6FF' }]}
            onPress={handleExportInventory}
            disabled={isExporting}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.reportBtnTitle, { color: '#1D4ED8' }]}>
                📦 Inventario y Valorización
              </Text>
              <Text style={styles.reportBtnDesc}>
                Existencias, costos de compra, precios de venta y capital total invertido.
              </Text>
            </View>
            <Text style={styles.reportBtnIcon}>📥</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sincronización y Servidor */}
      <View style={styles.sectionBox}>
        <Text style={styles.sectionTitle}>☁️ Sincronización en la Nube</Text>
        <Text style={styles.sectionSubtitle}>
          Los datos están seguros en SQLite local y se sincronizan con la nube
        </Text>

        <View style={styles.syncRow}>
          <Text style={styles.syncCountText}>
            📦 Registros pendientes por subir:{' '}
            <Text style={styles.syncCountHighlight}>{pendingCount}</Text>
          </Text>

          <TouchableOpacity
            style={styles.syncBtn}
            onPress={async () => {
              await onRefreshData();
              const msg =
                pendingCount > 0
                  ? `Se enviaron ${pendingCount} transacciones a la cola de sincronización.`
                  : 'Todos los datos locales ya están al día.';
              if (Platform.OS === 'web') alert(msg);
              else Alert.alert('Sincronización', msg);
            }}
          >
            <Text style={styles.syncBtnText}>🔄 Actualizar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Configuración de Seguridad */}
      <View style={styles.sectionBox}>
        <Text style={styles.sectionTitle}>⚙️ Seguridad y Configuración</Text>
        <TouchableOpacity
          style={styles.changePinBtn}
          onPress={() => setChangePinModal(true)}
        >
          <Text style={styles.changePinBtnText}>🔑 Cambiar PIN de Acceso</Text>
        </TouchableOpacity>
      </View>

      {/* MODAL: Cambiar PIN */}
      <Modal visible={changePinModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>🔑 Cambiar PIN de Dueña</Text>

            <Text style={styles.inputLabel}>PIN actual *</Text>
            <TextInput
              style={styles.textInput}
              secureTextEntry
              keyboardType="numeric"
              maxLength={6}
              placeholder="••••"
              value={currentPin}
              onChangeText={setCurrentPin}
            />

            <Text style={styles.inputLabel}>Nuevo PIN (mínimo 4 dígitos) *</Text>
            <TextInput
              style={styles.textInput}
              secureTextEntry
              keyboardType="numeric"
              maxLength={6}
              placeholder="••••"
              value={newPin}
              onChangeText={setNewPin}
            />

            {Boolean(changePinError) && (
              <Text style={styles.errorText}>{changePinError}</Text>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setChangePinModal(false);
                  setCurrentPin('');
                  setNewPin('');
                  setChangePinError('');
                }}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.savePinBtn}
                onPress={handleChangePin}
              >
                <Text style={styles.savePinBtnText}>Guardar PIN</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  lockedContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  lockCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  lockIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  lockTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  lockSubtitle: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  pinInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    fontSize: 28,
    textAlign: 'center',
    paddingVertical: 10,
    letterSpacing: 8,
    marginBottom: 12,
    backgroundColor: '#F8FAFC',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginBottom: 10,
    textAlign: 'center',
  },
  unlockBtn: {
    width: '100%',
    backgroundColor: '#EA580C',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  unlockBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  headerCard: {
    backgroundColor: '#7C2D12',
    padding: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 2,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#FDBA74',
    fontSize: 12,
    marginTop: 2,
  },
  lockExitBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  lockExitBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  metricsGrid: {
    gap: 12,
    marginBottom: 16,
  },
  kpiCard: {
    padding: 16,
    borderRadius: 14,
    elevation: 1,
  },
  kpiLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#334155',
  },
  kpiValue: {
    fontSize: 30,
    fontWeight: 'bold',
    marginTop: 4,
  },
  kpiSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  kpiRow: {
    flexDirection: 'row',
    gap: 12,
  },
  kpiCardMini: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
  },
  kpiMiniLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#475569',
  },
  kpiMiniValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  sectionBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
  cashCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  cashCountInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
    width: 140,
    textAlign: 'right',
  },
  diffBox: {
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  diffExact: {
    backgroundColor: '#DCFCE7',
  },
  diffSurplus: {
    backgroundColor: '#FEF9C3',
  },
  diffDeficit: {
    backgroundColor: '#FEE2E2',
  },
  diffTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  diffDetails: {
    fontSize: 11,
    color: '#475569',
    marginTop: 4,
  },
  syncRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  syncCountText: {
    fontSize: 13,
    color: '#334155',
  },
  syncCountHighlight: {
    fontWeight: 'bold',
    color: '#D97706',
  },
  syncBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  syncBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  changePinBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  changePinBtnText: {
    color: '#334155',
    fontWeight: 'bold',
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
    marginTop: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    color: '#0F172A',
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  cancelBtnText: {
    color: '#64748B',
    fontWeight: 'bold',
  },
  savePinBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#EA580C',
  },
  savePinBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  reportButtonsList: {
    gap: 10,
    marginTop: 6,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'space-between',
  },
  reportBtnTitle: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  reportBtnDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
  },
  reportBtnIcon: {
    fontSize: 22,
    marginLeft: 10,
  },
});
