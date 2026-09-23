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
  ActivityIndicator,
  Linking,
} from 'react-native';
import {
  LocalCustomer,
  UserRole,
  customerRepository,
  debtRepository,
  CustomerLedgerItem,
} from '../../database';
import { CustomAlert, AlertType } from '../../components/CustomAlert';

interface DebtorsScreenProps {
  customers: LocalCustomer[];
  role: UserRole;
  onRefreshData: () => Promise<void>;
}

export function DebtorsScreen({
  customers,
  role,
  onRefreshData,
}: DebtorsScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<LocalCustomer | null>(null);
  const [ledgerItems, setLedgerItems] = useState<CustomerLedgerItem[]>([]);
  const [loadingLedger, setLoadingLedger] = useState(false);

  // Modal para registrar abono
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>('cash');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Modal para registrar nuevo cliente
  const [newCustomerModalVisible, setNewCustomerModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAlias, setNewAlias] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Alerta modal personalizada
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    type?: AlertType;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    showCancel?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showAlert = (options: {
    type?: AlertType;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    showCancel?: boolean;
    onConfirm?: () => void;
    onCancel?: () => void;
  }) => {
    setAlertConfig({
      visible: true,
      type: options.type || 'info',
      title: options.title,
      message: options.message,
      confirmText: options.confirmText || 'Aceptar',
      cancelText: options.cancelText || 'Cancelar',
      showCancel: Boolean(options.showCancel),
      onConfirm: () => {
        setAlertConfig((prev) => ({ ...prev, visible: false }));
        if (options.onConfirm) options.onConfirm();
      },
      onCancel: () => {
        setAlertConfig((prev) => ({ ...prev, visible: false }));
        if (options.onCancel) options.onCancel();
      },
    });
  };

  // Cargar el historial tipo "hoja de cuaderno" cuando se selecciona un cliente
  const loadCustomerLedger = useCallback(async (customerId: string) => {
    setLoadingLedger(true);
    try {
      const ledger = await debtRepository.getCustomerLedger(customerId);
      setLedgerItems(ledger);
    } catch (err) {
      console.error('Error cargando historial de fiados:', err);
    } finally {
      setLoadingLedger(false);
    }
  }, []);

  const openCustomerSheet = (customer: LocalCustomer) => {
    setSelectedCustomer(customer);
    loadCustomerLedger(customer.id);
  };

  const promptDeleteCustomer = () => {
    if (!selectedCustomer) return;

    const hasDebt = (selectedCustomer.current_debt || 0) > 0;
    const debtStr = (selectedCustomer.current_debt || 0).toLocaleString();

    showAlert({
      type: hasDebt ? 'warning' : 'danger',
      title: hasDebt ? '⚠️ Vecino con deuda pendiente' : '¿Eliminar vecino?',
      message: hasDebt
        ? `"${selectedCustomer.name}" todavía tiene un saldo pendiente de $${debtStr} en la libreta.\n\nSi lo eliminas, su deuda quedará archivada. ¿Seguro que deseas eliminarlo de todas formas?`
        : `¿Estás seguro de que deseas eliminar a "${selectedCustomer.name}" de la libreta de fiados?`,
      confirmText: hasDebt ? 'Sí, archivar y eliminar' : 'Sí, eliminar',
      cancelText: 'Cancelar',
      showCancel: true,
      onConfirm: async () => {
        try {
          const customerName = selectedCustomer.name;
          await customerRepository.softDelete(selectedCustomer.id);
          setSelectedCustomer(null);
          await onRefreshData();
          showAlert({
            type: 'success',
            title: 'Vecino eliminado',
            message: `"${customerName}" fue retirado de la libreta de fiados.`,
          });
        } catch (err: any) {
          showAlert({
            type: 'danger',
            title: 'Error al eliminar',
            message: `No se pudo eliminar al cliente: ${err.message}`,
          });
        }
      },
    });
  };

  const handleRecordPayment = async () => {
    if (!selectedCustomer) return;

    const amount = parseFloat(paymentAmount.replace(/[^0-9]/g, ''));
    if (isNaN(amount) || amount <= 0) {
      showAlert({
        type: 'warning',
        title: 'Monto inválido',
        message: 'Ingresa un valor de abono válido mayor a $0.',
      });
      return;
    }

    try {
      await debtRepository.recordPayment({
        customerId: selectedCustomer.id,
        amountPaid: amount,
        paymentMethod,
        notes: paymentNotes.trim() || undefined,
        createdBy: role,
      });

      const methodTxt = paymentMethod === 'transfer' ? 'por Nequi/Transferencia' : 'en efectivo';
      setPaymentAmount('');
      setPaymentNotes('');
      setPaymentMethod('cash');
      setPaymentModalVisible(false);

      await onRefreshData();

      // Recargar datos actualizados del cliente en la hoja
      const updated = await customerRepository.getById(selectedCustomer.id);
      if (updated) setSelectedCustomer(updated);
      await loadCustomerLedger(selectedCustomer.id);

      showAlert({
        type: 'success',
        title: 'Abono Guardado',
        message: `Se registró un abono de $${amount.toLocaleString()} (${methodTxt}) para ${selectedCustomer.name}.`,
      });
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Error en abono',
        message: `No se pudo registrar el abono: ${err.message}`,
      });
    }
  };

  const handleShareWhatsApp = async () => {
    if (!selectedCustomer) return;

    const customerName = selectedCustomer.name;
    const debtStr = (selectedCustomer.current_debt || 0).toLocaleString();

    let movementsText = '';
    if (ledgerItems.length > 0) {
      const topMovements = ledgerItems.slice(0, 5);
      movementsText = topMovements
        .map((m) => {
          const dateStr = new Date(m.date).toLocaleDateString([], {
            day: '2-digit',
            month: '2-digit',
          });
          if (m.type === 'debt') {
            const itemsSummary =
              m.items && m.items.length > 0
                ? `\n   ${m.items.map((i) => `• ${i.quantity}x ${i.productName}`).join('\n   ')}`
                : '';
            return `📅 ${dateStr} - Compra Fiada: +$${m.amount.toLocaleString()}${itemsSummary}`;
          } else {
            const methodLabel = m.paymentMethod === 'transfer' ? ' (Nequi)' : ' (Efectivo)';
            return `💵 ${dateStr} - Abono recibido${methodLabel}: -$${m.amount.toLocaleString()}${
              m.notes ? ` (${m.notes})` : ''
            }`;
          }
        })
        .join('\n');
    } else {
      movementsText = 'Sin compras recientes registradas.';
    }

    const message =
      `🛒 *EL CUADERNO DIGITAL - ESTADO DE CUENTA*\n\n` +
      `Hola *${customerName}*, le compartimos el detalle de su saldo en la tienda:\n\n` +
      `💰 *SALDO TOTAL PENDIENTE: $${debtStr}*\n\n` +
      `📝 *Últimos movimientos:*\n${movementsText}\n\n` +
      `¡Muchas gracias por su confianza y preferencia! 🙏`;

    let cleanPhone = (selectedCustomer.phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10 && cleanPhone.startsWith('3')) {
      cleanPhone = `57${cleanPhone}`;
    }

    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `whatsapp://send?text=${encodeURIComponent(message)}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        await Linking.openURL(
          `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`
        );
      }
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Error de WhatsApp',
        message: `No se pudo abrir WhatsApp: ${err.message}`,
      });
    }
  };

  const handleCreateCustomer = async () => {
    if (!newName.trim()) {
      showAlert({
        type: 'warning',
        title: 'Nombre obligatorio',
        message: 'Por favor ingresa el nombre del vecino.',
      });
      return;
    }

    try {
      await customerRepository.save({
        name: newName.trim(),
        alias: newAlias.trim() || undefined,
        phone: newPhone.trim() || undefined,
        notes: newNotes.trim() || undefined,
        created_by: role,
      });

      setNewName('');
      setNewAlias('');
      setNewPhone('');
      setNewNotes('');
      setNewCustomerModalVisible(false);

      await onRefreshData();

      showAlert({
        type: 'success',
        title: 'Vecino registrado',
        message: `"${newName.trim()}" fue agregado a la libreta de fiados.`,
      });
    } catch (err: any) {
      showAlert({
        type: 'danger',
        title: 'Error al registrar',
        message: `No se pudo registrar el vecino: ${err.message}`,
      });
    }
  };

  const totalDebtInStreet = customers.reduce(
    (sum, c) => sum + (c.current_debt || 0),
    0
  );

  const customersWithDebtCount = customers.filter(
    (c) => (c.current_debt || 0) > 0
  ).length;

  const filteredCustomers = customers
    .filter((c) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        c.name.toLowerCase().includes(q) ||
        (c.alias && c.alias.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q))
      );
    })
    .sort((a, b) => (b.current_debt || 0) - (a.current_debt || 0));

  return (
    <View style={styles.container}>
      {/* Tarjeta Resumen Superior */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.summaryLabel}>Total Fiados en la Calle</Text>
            <Text style={styles.summaryValue}>
              ${totalDebtInStreet.toLocaleString()}
            </Text>
          </View>
          <View style={styles.debtorsCountBadge}>
            <Text style={styles.debtorsCountNumber}>{customersWithDebtCount}</Text>
            <Text style={styles.debtorsCountLabel}>vecinos con saldo</Text>
          </View>
        </View>
      </View>

      {/* Barra de Búsqueda y Botón Nuevo */}
      <View style={styles.searchBarRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Buscar por nombre o apodo..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#94A3B8"
        />
        <TouchableOpacity
          style={styles.newButton}
          onPress={() => setNewCustomerModalVisible(true)}
        >
          <Text style={styles.newButtonText}>+ Nuevo Vecino</Text>
        </TouchableOpacity>
      </View>

      {/* Lista de Clientes / Cuaderno */}
      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={styles.listContent}
      >
        <Text style={styles.listHeaderTitle}>
          Hojas de la Libreta ({filteredCustomers.length})
        </Text>

        {filteredCustomers.map((cust) => {
          const hasDebt = (cust.current_debt || 0) > 0;
          return (
            <TouchableOpacity
              key={cust.id}
              style={[styles.customerCard, hasDebt && styles.customerCardWithDebt]}
              onPress={() => openCustomerSheet(cust)}
            >
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.customerName}>{cust.name}</Text>
                  {cust.alias && (
                    <View style={styles.aliasBadge}>
                      <Text style={styles.aliasBadgeText}>{cust.alias}</Text>
                    </View>
                  )}
                </View>

                {cust.phone && (
                  <Text style={styles.customerPhone}>📞 {cust.phone}</Text>
                )}

                <Text style={styles.cardHint}>Toca para abrir hoja de cuenta</Text>
              </View>

              <View style={styles.debtColumn}>
                <View
                  style={[
                    styles.debtStatusBadge,
                    hasDebt ? styles.badgeDebt : styles.badgeUpToDate,
                  ]}
                >
                  <Text
                    style={[
                      styles.debtStatusText,
                      hasDebt ? styles.textDebt : styles.textUpToDate,
                    ]}
                  >
                    {hasDebt
                      ? `$${cust.current_debt.toLocaleString()}`
                      : 'Al día ✅'}
                  </Text>
                </View>
                {hasDebt && <Text style={styles.debtSub}>Saldo pendiente</Text>}
              </View>
            </TouchableOpacity>
          );
        })}

        {filteredCustomers.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📖</Text>
            <Text style={styles.emptyTitle}>No hay clientes encontrados</Text>
            <Text style={styles.emptySub}>
              Puedes registrar un nuevo vecino con el botón superior.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* MODAL: Hoja de Libreta del Cliente */}
      <Modal
        visible={Boolean(selectedCustomer)}
        animationType="slide"
        transparent={false}
      >
        {selectedCustomer && (
          <View style={styles.sheetContainer}>
            {/* Cabecera de la Hoja */}
            <View style={styles.sheetHeader}>
              <TouchableOpacity
                style={styles.closeSheetBtn}
                onPress={() => setSelectedCustomer(null)}
              >
                <Text style={styles.closeSheetBtnText}>✕ Cerrar</Text>
              </TouchableOpacity>
              <Text style={styles.sheetHeaderTitle}>Hoja de Cuenta</Text>
              <View style={{ width: 60 }} />
            </View>

            <ScrollView contentContainerStyle={styles.sheetContent}>
              {/* Tarjeta del Cliente y Saldo Gigante */}
              <View style={styles.sheetProfileCard}>
                <Text style={styles.sheetCustName}>{selectedCustomer.name}</Text>
                {selectedCustomer.alias && (
                  <Text style={styles.sheetCustAlias}>
                    «{selectedCustomer.alias}»
                  </Text>
                )}
                {selectedCustomer.phone && (
                  <Text style={styles.sheetCustPhone}>
                    📞 {selectedCustomer.phone}
                  </Text>
                )}

                <View style={styles.sheetDebtCard}>
                  <Text style={styles.sheetDebtLabel}>SALDO TOTAL QUE DEBE:</Text>
                  <Text style={styles.sheetDebtValue}>
                    ${selectedCustomer.current_debt.toLocaleString()}
                  </Text>
                </View>

                {/* Botón Grande: Registrar Abono */}
                <TouchableOpacity
                  style={styles.recordPaymentBtn}
                  onPress={() => setPaymentModalVisible(true)}
                >
                  <Text style={styles.recordPaymentBtnText}>
                    💵 Registrar Abono de Dinero
                  </Text>
                </TouchableOpacity>

                {/* Botón WhatsApp: Enviar Estado de Cuenta */}
                <TouchableOpacity
                  style={styles.shareWhatsAppBtn}
                  onPress={handleShareWhatsApp}
                >
                  <Text style={styles.shareWhatsAppBtnText}>
                    📲 Enviar Cuenta por WhatsApp
                  </Text>
                </TouchableOpacity>

                {/* Botón Eliminar Vecino */}
                <TouchableOpacity
                  style={styles.deleteCustomerBtn}
                  onPress={promptDeleteCustomer}
                  activeOpacity={0.7}
                >
                  <Text style={styles.deleteCustomerBtnText}>
                    🗑️ Eliminar este Vecino de la Libreta
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Historial Detallado de Renglones (El Cuaderno) */}
              <View style={styles.ledgerSection}>
                <Text style={styles.ledgerSectionTitle}>
                  Anotaciones en la Libreta
                </Text>
                <Text style={styles.ledgerSectionSubtitle}>
                  Detalle de compras fiadas y abonos realizados
                </Text>

                {loadingLedger ? (
                  <ActivityIndicator
                    size="large"
                    color="#D97706"
                    style={{ marginVertical: 30 }}
                  />
                ) : ledgerItems.length === 0 ? (
                  <View style={styles.emptyLedger}>
                    <Text style={styles.emptyLedgerText}>
                      No hay compras fiadas ni abonos registrados para este cliente.
                    </Text>
                  </View>
                ) : (
                  ledgerItems.map((item) => {
                    const isDebt = item.type === 'debt';
                    return (
                      <View
                        key={item.id}
                        style={[
                          styles.ledgerCard,
                          isDebt ? styles.ledgerDebtCard : styles.ledgerPaymentCard,
                        ]}
                      >
                        <View style={styles.ledgerCardHeader}>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.ledgerBadgeText,
                                isDebt
                                  ? styles.ledgerDebtText
                                  : styles.ledgerPaymentText,
                              ]}
                            >
                              {isDebt
                                ? `📝 Compra Fiada ${
                                    item.saleNumber ? `#${item.saleNumber}` : ''
                                  }`
                                : item.paymentMethod === 'transfer'
                                ? '📲 Abono por Nequi / Transf.'
                                : '💵 Abono en Efectivo (Caja)'}
                            </Text>
                            <Text style={styles.ledgerDate}>
                              {new Date(item.date).toLocaleDateString()} •{' '}
                              {new Date(item.date).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </Text>
                          </View>

                          <Text
                            style={[
                              styles.ledgerAmount,
                              isDebt ? styles.amountDebt : styles.amountPayment,
                            ]}
                          >
                            {isDebt ? '+' : '−'}$
                            {item.amount.toLocaleString()}
                          </Text>
                        </View>

                        {/* Desglose de Artículos Comprados */}
                        {item.items && item.items.length > 0 && (
                          <View style={styles.itemsBreakdown}>
                            <Text style={styles.itemsBreakdownTitle}>
                              Artículos fiados:
                            </Text>
                            {item.items.map((art, idx) => (
                              <View key={idx} style={styles.itemLine}>
                                <Text style={styles.itemLineName}>
                                  • {art.quantity}x {art.productName}
                                </Text>
                                <Text style={styles.itemLinePrice}>
                                  ${art.subtotal.toLocaleString()}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {item.notes && (
                          <Text style={styles.ledgerNotes}>
                            Nota: {item.notes}
                          </Text>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* SUB-MODAL: Registrar Abono */}
      <Modal visible={paymentModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>💵 Registrar Abono</Text>
            <Text style={styles.modalSubtitle}>
              Cliente: {selectedCustomer?.name}
            </Text>
            <Text style={styles.modalDebtHint}>
              Deuda actual: ${selectedCustomer?.current_debt.toLocaleString()}
            </Text>

            <Text style={styles.inputLabel}>¿Cuánto va a abonar?</Text>
            <TextInput
              style={styles.priceBigInput}
              keyboardType="numeric"
              placeholder="$ 0"
              value={paymentAmount}
              onChangeText={setPaymentAmount}
              autoFocus
            />

            {/* Atajos de Abono Rápido */}
            <View style={styles.shortcutsRow}>
              {selectedCustomer && selectedCustomer.current_debt > 0 && (
                <TouchableOpacity
                  style={styles.shortcutChip}
                  onPress={() =>
                    setPaymentAmount(selectedCustomer.current_debt.toString())
                  }
                >
                  <Text style={styles.shortcutChipText}>Saldar Todo</Text>
                </TouchableOpacity>
              )}
              {[5000, 10000, 20000, 50000].map((val) => (
                <TouchableOpacity
                  key={val}
                  style={styles.shortcutChip}
                  onPress={() => setPaymentAmount(val.toString())}
                >
                  <Text style={styles.shortcutChipText}>
                    ${val.toLocaleString()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>¿Cómo pagó el vecino? *</Text>
            <View style={styles.methodSelectorRow}>
              <TouchableOpacity
                style={[
                  styles.methodBtn,
                  paymentMethod === 'cash' && styles.methodBtnActiveCash,
                ]}
                onPress={() => setPaymentMethod('cash')}
              >
                <Text
                  style={[
                    styles.methodBtnText,
                    paymentMethod === 'cash' && styles.methodBtnTextActiveCash,
                  ]}
                >
                  💵 Efectivo en Caja
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.methodBtn,
                  paymentMethod === 'transfer' && styles.methodBtnActiveTransfer,
                ]}
                onPress={() => setPaymentMethod('transfer')}
              >
                <Text
                  style={[
                    styles.methodBtnText,
                    paymentMethod === 'transfer' && styles.methodBtnTextActiveTransfer,
                  ]}
                >
                  📲 Nequi / Transf.
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Nota o referencia (opcional):</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ej: Envió con el hijo, efectivo..."
              value={paymentNotes}
              onChangeText={setPaymentNotes}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setPaymentModalVisible(false);
                  setPaymentAmount('');
                  setPaymentNotes('');
                }}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmPaymentBtn}
                onPress={handleRecordPayment}
              >
                <Text style={styles.confirmPaymentBtnText}>Guardar Abono</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: Nuevo Vecino */}
      <Modal
        visible={newCustomerModalVisible}
        transparent
        animationType="slide"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>👤 Abrir Hoja en la Libreta</Text>
            <Text style={styles.modalSubtitle}>
              Registra un nuevo cliente para fiarle o llevar su cuenta.
            </Text>

            <Text style={styles.inputLabel}>Nombre completo *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ej: Don Pedro Gómez"
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />

            <Text style={styles.inputLabel}>Apodo o referencia</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ej: El del taller, vecino casa 4"
              value={newAlias}
              onChangeText={setNewAlias}
            />

            <Text style={styles.inputLabel}>Teléfono (Opcional)</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="phone-pad"
              placeholder="Ej: 300 123 4567"
              value={newPhone}
              onChangeText={setNewPhone}
            />

            <Text style={styles.inputLabel}>Notas de confianza (Opcional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ej: Paga cada quincena..."
              value={newNotes}
              onChangeText={setNewNotes}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setNewCustomerModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmCustomerBtn}
                onPress={handleCreateCustomer}
              >
                <Text style={styles.confirmCustomerBtnText}>Crear Vecino</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Alerta Modal Personalizada */}
      <CustomAlert
        visible={alertConfig.visible}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        confirmText={alertConfig.confirmText}
        cancelText={alertConfig.cancelText}
        showCancel={alertConfig.showCancel}
        onConfirm={alertConfig.onConfirm}
        onCancel={alertConfig.onCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  summaryCard: {
    backgroundColor: '#92400E',
    margin: 16,
    marginBottom: 10,
    borderRadius: 14,
    padding: 16,
    elevation: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    color: '#FEF3C7',
    fontSize: 13,
    fontWeight: '600',
  },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: 'bold',
    marginTop: 4,
  },
  debtorsCountBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  debtorsCountNumber: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  debtorsCountLabel: {
    color: '#FEF3C7',
    fontSize: 10,
    marginTop: 2,
  },
  searchBarRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  newButton: {
    backgroundColor: '#D97706',
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  newButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  listHeaderTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#64748B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  customerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 1,
  },
  customerCardWithDebt: {
    borderLeftWidth: 4,
    borderLeftColor: '#D97706',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  customerName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  aliasBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aliasBadgeText: {
    fontSize: 11,
    color: '#92400E',
    fontWeight: '600',
  },
  customerPhone: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  cardHint: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  debtColumn: {
    alignItems: 'flex-end',
  },
  debtStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeDebt: {
    backgroundColor: '#FEF3C7',
  },
  badgeUpToDate: {
    backgroundColor: '#DCFCE7',
  },
  debtStatusText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  textDebt: {
    color: '#B45309',
  },
  textUpToDate: {
    color: '#15803D',
  },
  debtSub: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#475569',
  },
  emptySub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  sheetContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  sheetHeader: {
    backgroundColor: '#0F172A',
    paddingTop: 45,
    paddingBottom: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeSheetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#334155',
    borderRadius: 6,
  },
  closeSheetBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  sheetHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
  sheetContent: {
    padding: 16,
    paddingBottom: 50,
  },
  sheetProfileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    alignItems: 'center',
    elevation: 2,
  },
  sheetCustName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  sheetCustAlias: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2,
  },
  sheetCustPhone: {
    fontSize: 13,
    color: '#3B82F6',
    marginTop: 4,
  },
  sheetDebtCard: {
    backgroundColor: '#FEF3C7',
    width: '100%',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 14,
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  sheetDebtLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#92400E',
  },
  sheetDebtValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#B45309',
    marginTop: 4,
  },
  recordPaymentBtn: {
    backgroundColor: '#16A34A',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 2,
  },
  recordPaymentBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  shareWhatsAppBtn: {
    backgroundColor: '#25D366',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    elevation: 2,
  },
  shareWhatsAppBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  deleteCustomerBtn: {
    backgroundColor: '#FEE2E2',
    width: '100%',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  deleteCustomerBtnText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: 'bold',
  },
  ledgerSection: {
    marginBottom: 20,
  },
  ledgerSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  ledgerSectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  emptyLedger: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyLedgerText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
  },
  ledgerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  ledgerDebtCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#D97706',
  },
  ledgerPaymentCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#16A34A',
  },
  ledgerCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  ledgerBadgeText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  ledgerDebtText: {
    color: '#B45309',
  },
  ledgerPaymentText: {
    color: '#15803D',
  },
  ledgerDate: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  ledgerAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  amountDebt: {
    color: '#B45309',
  },
  amountPayment: {
    color: '#15803D',
  },
  itemsBreakdown: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
  },
  itemsBreakdownTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 4,
  },
  itemLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  itemLineName: {
    fontSize: 12,
    color: '#334155',
  },
  itemLinePrice: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  ledgerNotes: {
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
    marginTop: 6,
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
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
    fontWeight: '600',
  },
  modalDebtHint: {
    fontSize: 12,
    color: '#D97706',
    marginTop: 2,
    marginBottom: 12,
    fontWeight: 'bold',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
    marginTop: 8,
  },
  priceBigInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 12,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#15803D',
    textAlign: 'center',
    backgroundColor: '#F8FAFC',
    marginBottom: 6,
  },
  shortcutsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  shortcutChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  shortcutChipText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#334155',
  },
  methodSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  methodBtnActiveCash: {
    borderColor: '#16A34A',
    backgroundColor: '#DCFCE7',
  },
  methodBtnActiveTransfer: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  methodBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  methodBtnTextActiveCash: {
    color: '#166534',
    fontWeight: 'bold',
  },
  methodBtnTextActiveTransfer: {
    color: '#3730A3',
    fontWeight: 'bold',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 6,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
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
  confirmPaymentBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#16A34A',
  },
  confirmPaymentBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  confirmCustomerBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#D97706',
  },
  confirmCustomerBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
