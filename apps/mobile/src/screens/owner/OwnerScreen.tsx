import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  UserRole,
  settingsRepository,
  saleRepository,
  supplierRepository,
  LocalCustomer,
  LocalProduct,
  TodaySalesSummary,
  LocalSupplierBill,
} from '../../database';
import {
  exportSalesToXlsx,
  exportDebtorsToXlsx,
  exportInventoryToXlsx,
  exportCompleteStoreWorkbookToXlsx,
} from '../../utils/excel';
import { backupService } from '../../services/backup.service';
import { LegalTermsModal } from '../../components/LegalTermsModal';
import { useToast } from '../../components/Toast';
import { useSettings } from '../../context/SettingsContext';

interface OwnerScreenProps {
  role: UserRole;
  customers: LocalCustomer[];
  products: LocalProduct[];
  pendingBills?: LocalSupplierBill[];
  pendingCount: number;
  onRoleChange: (newRole: UserRole) => void;
  onRefreshData: () => Promise<void>;
}

export function OwnerScreen({
  role,
  customers,
  products,
  pendingBills = [],
  pendingCount,
  onRoleChange,
  onRefreshData,
}: OwnerScreenProps) {
  const { showToast } = useToast();
  const { formatMoney } = useSettings();
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [todaySummary, setTodaySummary] = useState<TodaySalesSummary | null>(null);
  const [todayOutflows, setTodayOutflows] = useState<number>(0);
  const [billsPaidToday, setBillsPaidToday] = useState<LocalSupplierBill[]>([]);
  const [pendingSupplierBills, setPendingSupplierBills] = useState<LocalSupplierBill[]>(pendingBills);
  const [isExporting, setIsExporting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [legalTermsVisible, setLegalTermsVisible] = useState(false);

  // Modal para crear nueva factura a proveedor
  const [newBillModalVisible, setNewBillModalVisible] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newBillAmount, setNewBillAmount] = useState('');
  const [newBillNotes, setNewBillNotes] = useState('');

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
      const outflows = await supplierRepository.getTodayPaidOutflows();
      setTodayOutflows(outflows.totalPaidToday);
      setBillsPaidToday(outflows.billsPaidToday);
      const pending = await supplierRepository.getPendingBills();
      setPendingSupplierBills(pending);
    } catch (err) {
      console.error('Error cargando resumen de finanzas:', err);
    }
  }, []);

  useEffect(() => {
    if (role === 'duena') {
      loadSummary();
    }
  }, [role, loadSummary]);

  const handlePaySupplierBill = async (bill: LocalSupplierBill) => {
    try {
      await supplierRepository.markAsPaid(bill.id);
      showToast({
        type: 'success',
        title: 'Factura Pagada',
        message: `Se pagó ${formatMoney(bill.total_amount)} a ${bill.supplier_name} con efectivo de caja.`,
      });
      await onRefreshData();
      await loadSummary();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error al pagar',
        message: err.message,
      });
    }
  };

  const handleDeleteSupplierBill = (bill: LocalSupplierBill) => {
    Alert.alert(
      '¿Eliminar factura?',
      `¿Deseas retirar la cuenta por pagar de ${formatMoney(bill.total_amount)} a "${bill.supplier_name}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await supplierRepository.softDelete(bill.id);
              showToast({
                type: 'info',
                title: 'Factura eliminada',
                message: 'La cuenta por pagar fue eliminada.',
              });
              await onRefreshData();
              await loadSummary();
            } catch (err: any) {
              showToast({
                type: 'error',
                title: 'Error al eliminar',
                message: err.message,
              });
            }
          },
        },
      ]
    );
  };

  const handleCreateSupplierBill = async () => {
    const amount = parseFloat(newBillAmount.replace(/[^0-9]/g, ''));
    if (isNaN(amount) || amount <= 0 || !newSupplierName.trim()) {
      showToast({
        type: 'warning',
        title: 'Datos incompletos',
        message: 'Ingresa proveedor y monto válido mayor a $0.',
      });
      return;
    }
    try {
      await supplierRepository.createBill({
        supplierName: newSupplierName.trim(),
        totalAmount: amount,
        isPaid: false,
        notes: newBillNotes.trim() || 'Factura pendiente de pago',
        createdBy: role,
      });
      setNewSupplierName('');
      setNewBillAmount('');
      setNewBillNotes('');
      setNewBillModalVisible(false);
      showToast({
        type: 'success',
        title: 'Factura Registrada',
        message: `Cuenta por pagar de ${formatMoney(amount)} guardada.`,
      });
      await onRefreshData();
      await loadSummary();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error al crear factura',
        message: err.message,
      });
    }
  };

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
      showToast({
        type: 'success',
        title: 'PIN Actualizado',
        message: 'PIN de Administrador actualizado con éxito.',
      });
    } catch (err: any) {
      setChangePinError(`Error: ${err.message}`);
    }
  };

  const handleExportSales = async () => {
    setIsExporting(true);
    try {
      const { sales, items } = await saleRepository.getAllSalesAndItems();
      await exportSalesToXlsx(sales, items, customers);
      showToast({
        type: 'success',
        title: 'Excel Exportado',
        message: 'Reporte de ventas generado con éxito.',
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error al exportar ventas',
        message: err.message,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportDebtors = async () => {
    setIsExporting(true);
    try {
      await exportDebtorsToXlsx(customers);
      showToast({
        type: 'success',
        title: 'Excel Exportado',
        message: 'Libreta de créditos generada con éxito.',
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error al exportar créditos',
        message: err.message,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportInventory = async () => {
    setIsExporting(true);
    try {
      await exportInventoryToXlsx(products);
      showToast({
        type: 'success',
        title: 'Excel Exportado',
        message: 'Inventario de productos generado con éxito.',
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error al exportar inventario',
        message: err.message,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCompleteWorkbook = async () => {
    setIsExporting(true);
    try {
      const { sales, items } = await saleRepository.getAllSalesAndItems();
      await exportCompleteStoreWorkbookToXlsx({
        sales,
        items,
        customers,
        products,
        todayCashSales: todaySummary?.totalCashSales || 0,
        todayTransferSales: todaySummary?.totalTransferSales || 0,
        todayCashPaymentsReceived: todaySummary?.totalCashPaymentsReceived || 0,
        todayTransferPaymentsReceived: todaySummary?.totalTransferPaymentsReceived || 0,
        todayDebtSales: todaySummary?.totalDebtSales || 0,
        totalStreetDebt,
        todayOutflows,
        billsPaidToday,
      });
      showToast({
        type: 'success',
        title: 'Libro Contable Exportado',
        message: 'Cuaderno completo de la tienda generado en Excel.',
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error al exportar libro completo',
        message: err.message,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    try {
      const filename = await backupService.exportBackup();
      showToast({
        type: 'success',
        title: 'Copia Creada',
        message: `Copia lista (${filename}). Puedes guardarla en Google Drive o enviarla por WhatsApp.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error al respaldar',
        message: err.message,
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreBackup = async () => {
    setRestoreModalVisible(false);
    setIsRestoring(true);
    try {
      const result = await backupService.pickAndRestoreBackup();
      if (!result) {
        setIsRestoring(false);
        return;
      }
      showToast({
        type: 'success',
        title: 'Restauración Exitosa',
        message: `Se restauraron ${result.counts.customers} clientes, ${result.counts.products} productos y ${result.counts.sales} ventas.`,
      });
      await onRefreshData();
      await loadSummary();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error al restaurar',
        message: err.message,
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const totalStreetDebt = customers.reduce(
    (sum, c) => sum + (c.current_debt || 0),
    0
  );

  const totalPendingSupplierDebt = pendingSupplierBills.reduce(
    (sum, b) => sum + (b.total_amount || 0),
    0
  );

  const theoreticalCashInDrawer = todaySummary
    ? todaySummary.totalPhysicalCashInDrawer - todayOutflows
    : 0;
  const countedNum = parseFloat(countedCash.replace(/[^0-9]/g, ''));
  const cashDifference = !isNaN(countedNum) ? countedNum - theoreticalCashInDrawer : null;

  // Si no está desbloqueado, mostrar pantalla de PIN
  if (role !== 'duena') {
    return (
      <View style={styles.lockedContainer}>
        <View style={styles.lockCard}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.lockTitle}>Acceso Administrativo Protegido</Text>
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
            <Text style={styles.unlockBtnText}>Ingresar como Administrador</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Cabecera Administración */}
      <View style={styles.headerCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Panel de Administración y Cierre</Text>
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
        {/* Efectivo Físico en Cajón (Arqueo) */}
        <View style={[styles.kpiCard, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC', borderWidth: 1 }]}>
          <Text style={styles.kpiLabel}>Efectivo Físico Esperado en Caja</Text>
          <Text style={[styles.kpiValue, { color: '#166534' }]}>
            {formatMoney(theoreticalCashInDrawer)}
          </Text>
          <Text style={styles.kpiSub}>
            Contado: {formatMoney(todaySummary?.totalCashSales || 0)} + Abonos Efectivo:{' '}
            {formatMoney(todaySummary?.totalCashPaymentsReceived || 0)}
            {todayOutflows > 0
              ? ` − Proveedores: -${formatMoney(todayOutflows)}`
              : ''}
          </Text>
          <Text style={{ fontSize: 11, color: '#15803D', marginTop: 4, fontWeight: '600' }}>
            Dinero físico a contar en billetes y monedas en el cajón.
          </Text>
        </View>

        {/* Dinero Digital en Nequi / Bancos */}
        <View style={[styles.kpiCard, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE', borderWidth: 1, marginTop: 10 }]}>
          <Text style={[styles.kpiLabel, { color: '#3730A3' }]}>Dinero Digital (Nequi / Bancos)</Text>
          <Text style={[styles.kpiValue, { color: '#4338CA' }]}>
            {formatMoney(todaySummary?.totalDigitalInNequi || 0)}
          </Text>
          <Text style={[styles.kpiSub, { color: '#4F46E5' }]}>
            Ventas Nequi: {formatMoney(todaySummary?.totalTransferSales || 0)} + Abonos Nequi:{' '}
            {formatMoney(todaySummary?.totalTransferPaymentsReceived || 0)}
          </Text>
          <Text style={{ fontSize: 11, color: '#6366F1', marginTop: 4, fontWeight: '600' }}>
            Ingresos recibidos por transferencias digitales (fuera de caja física).
          </Text>
        </View>

        {/* Resumen General de Ingresos */}
        <View style={[styles.kpiCard, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderWidth: 1, marginTop: 10 }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={[styles.kpiLabel, { color: '#475569' }]}>Total Ingresos Recaudados Hoy</Text>
              <Text style={[styles.kpiValue, { color: '#0F172A', fontSize: 20 }]}>
                {formatMoney(todaySummary?.totalRevenueToday || 0)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ fontSize: 12, color: '#166534', fontWeight: 'bold' }}>
                Caja: {formatMoney(todaySummary?.totalPhysicalCashInDrawer || 0)}
              </Text>
              <Text style={{ fontSize: 12, color: '#4338CA', fontWeight: 'bold', marginTop: 2 }}>
                Nequi: {formatMoney(todaySummary?.totalDigitalInNequi || 0)}
              </Text>
            </View>
          </View>
        </View>

        {/* Créditos de Hoy vs Cartera Total */}
        <View style={[styles.kpiRow, { marginTop: 10 }]}>
          <View style={[styles.kpiCardMini, { backgroundColor: '#FEF9C3' }]}>
            <Text style={styles.kpiMiniLabel}>Crédito Hoy</Text>
            <Text style={[styles.kpiMiniValue, { color: '#854D0E' }]}>
              {formatMoney(todaySummary?.totalDebtSales || 0)}
            </Text>
          </View>

          <View style={[styles.kpiCardMini, { backgroundColor: '#FEE2E2' }]}>
            <Text style={styles.kpiMiniLabel}>Total Cartera</Text>
            <Text style={[styles.kpiMiniValue, { color: '#991B1B' }]}>
              {formatMoney(totalStreetDebt)}
            </Text>
          </View>
        </View>

        {/* Cuentas por Pagar a Proveedores (Pendientes) */}
        <View style={[styles.kpiCardMini, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA', borderWidth: 1, marginTop: 10, width: '100%' }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={[styles.kpiMiniLabel, { color: '#9A3412', fontWeight: 'bold' }]}>
                Cuentas por Pagar a Proveedores
              </Text>
              <Text style={{ fontSize: 11, color: '#C2410C', marginTop: 2 }}>
                {pendingSupplierBills.length === 1 ? '1 factura pendiente' : `${pendingSupplierBills.length} facturas pendientes`}
              </Text>
            </View>
            <Text style={[styles.kpiMiniValue, { color: '#EA580C' }]}>
              {formatMoney(totalPendingSupplierDebt)}
            </Text>
          </View>
        </View>

        {/* Detalle de Salidas / Proveedores de Hoy */}
        {todayOutflows > 0 && (
          <View style={[styles.kpiCardMini, { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, marginTop: 10, width: '100%' }]}>
            <Text style={[styles.kpiMiniLabel, { color: '#991B1B', fontWeight: 'bold', fontSize: 13 }]}>
              Salidas de Caja a Proveedores: -{formatMoney(todayOutflows)}
            </Text>
            {billsPaidToday.map((b) => (
              <Text key={b.id} style={{ fontSize: 12, color: '#7F1D1D', marginTop: 3 }}>
                • {b.supplier_name}: {formatMoney(b.total_amount)} ({b.notes || 'Pagado de caja'})
              </Text>
            ))}
          </View>
        )}
      </View>

      {/* Herramienta: Arqueo / Cuadre de Caja */}
      <View style={styles.sectionBox}>
        <Text style={styles.sectionTitle}>Cuadre y Arqueo de Caja</Text>
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
                ? `🟢 Sobrante en Caja: +${formatMoney(cashDifference)}`
                : `🔴 Faltante en Caja: -${formatMoney(Math.abs(cashDifference))}`}
            </Text>
            <Text style={styles.diffDetails}>
              En sistema: {formatMoney(theoreticalCashInDrawer)} • En mano:{' '}
              {formatMoney(countedNum)}
            </Text>
          </View>
        )}
      </View>

      {/* Cuentas por Pagar a Proveedores */}
      <View style={styles.sectionBox}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.sectionTitle}>Cuentas por Pagar a Proveedores</Text>
            <Text style={styles.sectionSubtitle}>
              Facturas pendientes de repartidores y distribuidores.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addBillBtn}
            onPress={() => setNewBillModalVisible(true)}
          >
            <Text style={styles.addBillBtnText}>+ Factura</Text>
          </TouchableOpacity>
        </View>

        {pendingSupplierBills.length === 0 ? (
          <View style={styles.emptyBillsState}>
            <Text style={styles.emptyBillsTitle}>Al día con proveedores</Text>
            <Text style={styles.emptyBillsSub}>No tienes facturas pendientes de pago registradas.</Text>
          </View>
        ) : (
          pendingSupplierBills.map((bill) => (
            <View key={bill.id} style={styles.ownerBillCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.ownerBillSupplier}>{bill.supplier_name}</Text>
                <Text style={styles.ownerBillAmount}>{formatMoney(bill.total_amount)}</Text>
                <Text style={styles.ownerBillDate}>
                  {new Date(bill.created_at).toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' })} • {bill.notes || 'Factura pendiente'}
                </Text>
              </View>
              <View style={styles.ownerBillActions}>
                <TouchableOpacity
                  style={styles.ownerPayBillBtn}
                  onPress={() => handlePaySupplierBill(bill)}
                >
                  <Text style={styles.ownerPayBillText}>Pagar con Caja</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.ownerDeleteBillBtn}
                  onPress={() => handleDeleteSupplierBill(bill)}
                >
                  <Text style={styles.ownerDeleteBillText}>🗑️</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Reportes para Contabilidad / Microsoft Excel */}
      <View style={styles.sectionBox}>
        <Text style={styles.sectionTitle}>Reportes en Microsoft Excel (.xlsx)</Text>
        <Text style={styles.sectionSubtitle}>
          Hojas de cálculo reales con tablas organizadas, anchos de columna automáticos y formato de moneda. Puedes abrirlas en Excel o enviarlas por WhatsApp.
        </Text>

        <View style={styles.reportButtonsList}>
          {/* Libro Maestro Integral */}
          <TouchableOpacity
            style={[styles.reportBtn, { borderColor: '#7C3AED', backgroundColor: '#F5F3FF' }]}
            onPress={handleExportCompleteWorkbook}
            disabled={isExporting}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.reportBtnTitle, { color: '#6D28D9' }]}>
                Libro Maestro Completo (.xlsx)
              </Text>
              <Text style={styles.reportBtnDesc}>
                Las 4 hojas en un solo archivo: Cierre de Caja, Libreta de Créditos, Ventas e Inventario.
              </Text>
            </View>
          </TouchableOpacity>

          {/* Reporte de Ventas */}
          <TouchableOpacity
            style={[styles.reportBtn, { borderColor: '#16A34A', backgroundColor: '#F0FDF4' }]}
            onPress={handleExportSales}
            disabled={isExporting}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.reportBtnTitle, { color: '#15803D' }]}>
                Reporte de Ventas (.xlsx)
              </Text>
              <Text style={styles.reportBtnDesc}>
                Todas las ventas, cobros de contado, ventas a crédito y desglose de artículos.
              </Text>
            </View>
          </TouchableOpacity>

          {/* Reporte de Cartera / Créditos */}
          <TouchableOpacity
            style={[styles.reportBtn, { borderColor: '#D97706', backgroundColor: '#FFFBEB' }]}
            onPress={handleExportDebtors}
            disabled={isExporting}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.reportBtnTitle, { color: '#B45309' }]}>
                Libreta de Créditos (.xlsx)
              </Text>
              <Text style={styles.reportBtnDesc}>
                Lista de todos los clientes, teléfonos, saldos pendientes y estado de cuenta.
              </Text>
            </View>
          </TouchableOpacity>

          {/* Reporte de Inventario */}
          <TouchableOpacity
            style={[styles.reportBtn, { borderColor: '#2563EB', backgroundColor: '#EFF6FF' }]}
            onPress={handleExportInventory}
            disabled={isExporting}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.reportBtnTitle, { color: '#1D4ED8' }]}>
                Inventario y Valorización (.xlsx)
              </Text>
              <Text style={styles.reportBtnDesc}>
                Existencias, costos de compra, precios de venta y capital total invertido.
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Copia de Seguridad y Respaldo (Google Drive / WhatsApp) */}
      <View style={styles.sectionBox}>
        <Text style={styles.sectionTitle}>Copias de Seguridad y Respaldo</Text>
        <Text style={styles.sectionSubtitle}>
          Tu negocio opera 100% offline. Guarda una copia de seguridad para respaldar tus ventas, deudas e inventario en tu Google Drive personal o envíatela por WhatsApp.
        </Text>

        <View style={styles.backupCardContainer}>
          {/* Crear Copia */}
          <TouchableOpacity
            style={[styles.backupActionBtn, styles.createBackupBtn]}
            onPress={handleCreateBackup}
            disabled={isBackingUp || isRestoring}
            activeOpacity={0.8}
          >
            {isBackingUp ? (
              <View style={styles.backupLoadingRow}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.backupLoadingText}>Generando copia...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.backupBtnIcon}>📤</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.backupBtnTitle}>Crear Copia de Seguridad</Text>
                  <Text style={styles.backupBtnSub}>
                    Guarda tus datos en Google Drive, WhatsApp o tus archivos
                  </Text>
                </View>
              </>
            )}
          </TouchableOpacity>

          {/* Restaurar Copia */}
          <TouchableOpacity
            style={[styles.backupActionBtn, styles.restoreBackupBtn]}
            onPress={() => setRestoreModalVisible(true)}
            disabled={isBackingUp || isRestoring}
            activeOpacity={0.8}
          >
            {isRestoring ? (
              <View style={styles.backupLoadingRow}>
                <ActivityIndicator color="#0F172A" size="small" />
                <Text style={[styles.backupLoadingText, { color: '#0F172A' }]}>Restaurando...</Text>
              </View>
            ) : (
              <>
                <Text style={styles.backupBtnIcon}>📥</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.backupBtnTitle, { color: '#0F172A' }]}>
                    Restaurar desde Copia (.json)
                  </Text>
                  <Text style={[styles.backupBtnSub, { color: '#64748B' }]}>
                    Recupera tu negocio desde un archivo de respaldo previo
                  </Text>
                </View>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.securityBadge}>
          <Text style={styles.securityBadgeText}>
            100% Local y Privado: Tus datos nunca viajan a servidores de terceros sin tu autorización.
          </Text>
        </View>
      </View>

      {/* Configuración de Seguridad */}
      <View style={styles.sectionBox}>
        <Text style={styles.sectionTitle}>Seguridad y Configuración</Text>
        <TouchableOpacity
          style={styles.changePinBtn}
          onPress={() => setChangePinModal(true)}
        >
          <Text style={styles.changePinBtnText}>Cambiar PIN de Acceso</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.changePinBtn, { marginTop: 10 }]}
          onPress={() => setLegalTermsVisible(true)}
        >
          <Text style={styles.changePinBtnText}>Términos de Uso y Política de Privacidad</Text>
        </TouchableOpacity>
      </View>

      {/* MODAL: Cambiar PIN */}
      <Modal visible={changePinModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Cambiar PIN de Administrador</Text>

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

      {/* MODAL: Confirmar Restauración de Respaldo */}
      <Modal visible={restoreModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={{ fontSize: 36, textAlign: 'center', marginBottom: 6 }}>⚠️</Text>
            <Text style={styles.modalTitle}>¿Restaurar Copia de Seguridad?</Text>
            <Text style={[styles.modalSubtitle, { textAlign: 'center', color: '#B91C1C', fontWeight: '600' }]}>
              Atención: Esta acción reemplazará los datos actuales del dispositivo con los datos del archivo seleccionado.
            </Text>
            <Text style={{ fontSize: 13, color: '#475569', marginBottom: 16, lineHeight: 19, textAlign: 'center' }}>
              Se restaurarán todos los clientes, deudas, productos, ventas y cuentas por pagar desde el archivo .json. Te recomendamos crear una copia de seguridad antes si deseas conservar las ventas registradas hoy.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setRestoreModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.savePinBtn, { backgroundColor: '#DC2626' }]}
                onPress={handleRestoreBackup}
              >
                <Text style={styles.savePinBtnText}>Elegir Archivo y Restaurar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: Nueva Cuenta por Pagar / Factura a Proveedor */}
      <Modal visible={newBillModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nueva Cuenta por Pagar a Proveedor</Text>
            <Text style={styles.modalSubtitle}>
              Registra una factura de repartidor o compra a crédito de la tienda.
            </Text>

            <Text style={styles.fieldLabel}>Proveedor o Empresa *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ej: Bimbo, Coca-Cola, Postobón, Bolsas..."
              value={newSupplierName}
              onChangeText={setNewSupplierName}
              autoFocus
            />

            <Text style={styles.fieldLabel}>Monto de la Factura *</Text>
            <TextInput
              style={styles.priceBigInput}
              keyboardType="numeric"
              placeholder="$ 0"
              value={newBillAmount}
              onChangeText={setNewBillAmount}
            />

            <Text style={styles.fieldLabel}>Nota / Referencia (opcional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ej: Factura #1234, pagar en 8 días..."
              value={newBillNotes}
              onChangeText={setNewBillNotes}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setNewBillModalVisible(false);
                  setNewSupplierName('');
                  setNewBillAmount('');
                  setNewBillNotes('');
                }}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.savePinBtn}
                onPress={handleCreateSupplierBill}
              >
                <Text style={styles.savePinBtnText}>Guardar Factura</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Términos y Condiciones / Política de Privacidad */}
      <LegalTermsModal
        visible={legalTermsVisible}
        onClose={() => setLegalTermsVisible(false)}
      />
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
  backupCardContainer: {
    gap: 10,
    marginTop: 6,
  },
  backupActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  createBackupBtn: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  restoreBackupBtn: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  backupBtnIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  backupBtnTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  backupBtnSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  backupLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    width: '100%',
    gap: 8,
  },
  backupLoadingText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  securityBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  securityBadgeText: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
    fontWeight: '500',
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
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  priceBigInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 12,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#EA580C',
    textAlign: 'center',
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
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
  addBillBtn: {
    backgroundColor: '#EA580C',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addBillBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  emptyBillsState: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyBillsIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  emptyBillsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#15803D',
  },
  emptyBillsSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  ownerBillCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  ownerBillSupplier: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#9A3412',
  },
  ownerBillAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#EA580C',
    marginTop: 2,
  },
  ownerBillDate: {
    fontSize: 11,
    color: '#7C2D12',
    marginTop: 2,
  },
  ownerBillActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  ownerPayBillBtn: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  ownerPayBillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  ownerDeleteBillBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
  },
  ownerDeleteBillText: {
    fontSize: 15,
  },
});
