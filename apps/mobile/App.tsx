import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  initDatabase,
  productRepository,
  saleRepository,
  customerRepository,
  debtRepository,
  supplierRepository,
  settingsRepository,
  LocalProduct,
  LocalCustomer,
  LocalSupplierBill,
  UserRole,
} from './src/database';
import { PosScreen } from './src/screens/pos/PosScreen';
import { DebtorsScreen } from './src/screens/debtors/DebtorsScreen';
import { InventoryScreen } from './src/screens/inventory/InventoryScreen';
import { OwnerScreen } from './src/screens/owner/OwnerScreen';
import { ToastProvider } from './src/components/Toast';
import { SettingsProvider } from './src/context/SettingsContext';
import { SettingsModal } from './src/components/SettingsModal';

type TabKey = 'pos' | 'debtors' | 'inventory' | 'owner';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('pos');
  const [role, setRole] = useState<UserRole>('tendera');

  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [customers, setCustomers] = useState<LocalCustomer[]>([]);
  const [pendingBills, setPendingBills] = useState<LocalSupplierBill[]>([]);
  const [pendingCount, setPendingCount] = useState(0);

  // Modal de PIN para Administración desde la barra superior
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Modal de Ajustes
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [
        allProds,
        allCusts,
        unpaidBills,
        pendingSales,
        pendingProds,
        pendingCusts,
        pendingDebts,
        pendingSuppliers,
      ] = await Promise.all([
        productRepository.getAll(),
        customerRepository.getAll(),
        supplierRepository.getPendingBills(),
        saleRepository.getPendingSync(),
        productRepository.getPendingSync(),
        customerRepository.getPendingSync(),
        debtRepository.getPendingSync(),
        supplierRepository.getPendingSync(),
      ]);

      setProducts(allProds);
      setCustomers(allCusts);
      setPendingBills(unpaidBills);
      setPendingCount(
        pendingSales.sales.length +
          pendingSales.items.length +
          pendingProds.length +
          pendingCusts.length +
          pendingDebts.debts.length +
          pendingDebts.payments.length +
          pendingSuppliers.length
      );
    } catch (err) {
      console.error('Error cargando datos locales:', err);
    }
  }, []);

  useEffect(() => {
    initDatabase()
      .then(() => {
        setIsReady(true);
        return loadData();
      })
      .catch((err) => {
        console.error('Error inicializando base de datos:', err);
      });
  }, [loadData]);

  const handleUnlockDueña = async () => {
    setPinError('');
    const isValid = await settingsRepository.verifyOwnerPin(enteredPin);
    if (isValid) {
      setRole('duena');
      setPinModalVisible(false);
      setEnteredPin('');
      setActiveTab('owner');
    } else {
      setPinError('PIN incorrecto. (Por defecto: 1234)');
    }
  };

  if (!isReady) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.centerContainer}>
          <Text style={styles.loadingText}>Iniciando base de datos offline...</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // Cálculos para badges de las pestañas
  const debtorsWithBalance = customers.filter(
    (c) => (c.current_debt || 0) > 0
  ).length;

  const lowStockCount = products.filter(
    (p) => p.current_stock <= p.min_stock_alert
  ).length;

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <ToastProvider>
          <SafeAreaView style={styles.container}>
            <StatusBar style="light" />

            {/* Cabecera Superior */}
            <View style={styles.header}>
              <View style={styles.headerTop}>
                <View style={styles.titleContainer}>
                  <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                    Mi Cuaderno Digital
                  </Text>
                  <Text style={styles.subtitle} numberOfLines={1}>
                    Modo Offline Activo • SQLite Local
                  </Text>
                </View>

                <View style={styles.headerRight}>
                  {role === 'tendera' ? (
                    <TouchableOpacity
                      style={styles.tenderaBadge}
                      onPress={() => setPinModalVisible(true)}
                    >
                      <Text style={styles.badgeText}>👤 Mostrador</Text>
                      <Text style={styles.badgeSubtext}>PIN Admin</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={styles.duenaBadge}
                      onPress={() => setRole('tendera')}
                    >
                      <Text style={styles.badgeText}>💼 Admin</Text>
                      <Text style={styles.badgeSubtext}>Salir</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.settingsButton}
                    onPress={() => setSettingsModalVisible(true)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.settingsIcon}>⚙️</Text>
                  </TouchableOpacity>
                </View>
              </View>

        {/* Barra de sincronización offline */}
        <View style={styles.syncRow}>
          <Text style={styles.syncText}>
            ☁️ {pendingCount === 0 ? 'Al día con la nube' : `${pendingCount} cambios por subir`}
          </Text>
        </View>
      </View>

      {/* Contenido de la Pantalla Activa */}
      <View style={styles.content}>
        {activeTab === 'pos' && (
          <PosScreen
            products={products}
            customers={customers}
            pendingBills={pendingBills}
            role={role}
            onSaleCompleted={loadData}
            onGoToDebtors={() => setActiveTab('debtors')}
          />
        )}

        {activeTab === 'debtors' && (
          <DebtorsScreen
            customers={customers}
            pendingBills={pendingBills}
            role={role}
            onRefreshData={loadData}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryScreen
            products={products}
            role={role}
            onRefreshData={loadData}
          />
        )}

        {activeTab === 'owner' && (
          <OwnerScreen
            role={role}
            customers={customers}
            products={products}
            pendingBills={pendingBills}
            pendingCount={pendingCount}
            onRoleChange={setRole}
            onRefreshData={loadData}
          />
        )}
      </View>

      {/* Barra de Navegación Inferior (Tabs Táctiles) */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'pos' && styles.tabButtonActive]}
          onPress={() => setActiveTab('pos')}
        >
          <Text style={styles.tabIcon}>🛒</Text>
          <Text
            style={[styles.tabLabel, activeTab === 'pos' && styles.tabLabelActive]}
          >
            Mostrador
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'debtors' && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab('debtors')}
        >
          <View style={{ position: 'relative' }}>
            <Text style={styles.tabIcon}>📒</Text>
            {(debtorsWithBalance > 0 || pendingBills.length > 0) && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>
                  {debtorsWithBalance + pendingBills.length}
                </Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'debtors' && styles.tabLabelActive,
            ]}
          >
            Créditos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'inventory' && styles.tabButtonActive,
          ]}
          onPress={() => setActiveTab('inventory')}
        >
          <View style={{ position: 'relative' }}>
            <Text style={styles.tabIcon}>📦</Text>
            {lowStockCount > 0 && (
              <View style={[styles.tabBadge, { backgroundColor: '#F59E0B' }]}>
                <Text style={styles.tabBadgeText}>!</Text>
              </View>
            )}
          </View>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'inventory' && styles.tabLabelActive,
            ]}
          >
            Inventario
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'owner' && styles.tabButtonActive,
          ]}
          onPress={() => {
            if (role === 'duena') {
              setActiveTab('owner');
            } else {
              setPinModalVisible(true);
            }
          }}
        >
          <Text style={styles.tabIcon}>💼</Text>
          <Text
            style={[
              styles.tabLabel,
              activeTab === 'owner' && styles.tabLabelActive,
            ]}
          >
            Admin
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal de PIN para Administración */}
      <Modal visible={pinModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Acceso Administración (PIN)</Text>
            <Text style={styles.modalSubtitle}>
              Ingresa el PIN de 4 dígitos para acceder a finanzas, cierre y reportes.
            </Text>

            <TextInput
              style={styles.pinInput}
              secureTextEntry
              keyboardType="numeric"
              maxLength={4}
              placeholder="••••"
              value={enteredPin}
              onChangeText={setEnteredPin}
              autoFocus
            />

            {Boolean(pinError) && <Text style={styles.errorText}>{pinError}</Text>}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setPinModalVisible(false);
                  setEnteredPin('');
                  setPinError('');
                }}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleUnlockDueña}
              >
                <Text style={styles.confirmButtonText}>Entrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Ajustes */}
      <SettingsModal
        visible={settingsModalVisible}
        onClose={() => {
          setSettingsModalVisible(false);
          loadData();
        }}
        currentRole={role}
        onRoleChange={setRole}
      />
        </SafeAreaView>
      </ToastProvider>
    </SettingsProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
  loadingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  titleContainer: {
    flex: 1,
    marginRight: 6,
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 6,
  },
  settingsButton: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: {
    fontSize: 15,
  },
  tenderaBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  duenaBadge: {
    backgroundColor: '#7C2D12',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F97316',
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 11,
  },
  badgeSubtext: {
    color: '#CBD5E1',
    fontSize: 9,
  },
  syncRow: {
    marginTop: 6,
  },
  syncText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  content: {
    flex: 1,
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 6,
    elevation: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  tabButtonActive: {
    borderTopWidth: 2,
    borderColor: '#0F172A',
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  tabLabelActive: {
    color: '#0F172A',
    fontWeight: 'bold',
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -10,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
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
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 16,
  },
  pinInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    fontSize: 24,
    textAlign: 'center',
    paddingVertical: 10,
    letterSpacing: 10,
    marginBottom: 10,
    backgroundColor: '#F8FAFC',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  cancelButtonText: {
    color: '#475569',
    fontWeight: 'bold',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#EA580C',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
