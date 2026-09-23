import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Platform,
} from 'react-native';
import {
  LocalProduct,
  LocalCustomer,
  UserRole,
  saleRepository,
  customerRepository,
  supplierRepository,
} from '../../database';
import { useToast } from '../../components/Toast';
import { useSettings } from '../../context/SettingsContext';

interface PosScreenProps {
  products: LocalProduct[];
  customers: LocalCustomer[];
  role: UserRole;
  onSaleCompleted: () => Promise<void>;
  onGoToDebtors?: () => void;
}

export function PosScreen({
  products,
  customers,
  role,
  onSaleCompleted,
  onGoToDebtors,
}: PosScreenProps) {
  const { showToast } = useToast();
  const { formatMoney } = useSettings();

  // Carrito de compras
  const [cart, setCart] = useState<
    Array<{
      product: LocalProduct;
      quantity: number;
    }>
  >([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>();
  const [receivedCash, setReceivedCash] = useState<number | null>(null);
  const [searchProduct, setSearchProduct] = useState('');

  // Modal para agregar producto libre / rápido (ej: $3.000 de queso)
  const [freeItemModalVisible, setFreeItemModalVisible] = useState(false);
  const [freeItemName, setFreeItemName] = useState('');
  const [freeItemPrice, setFreeItemPrice] = useState('');

  // Modal para registrar salida de dinero / pago proveedor
  const [outflowModalVisible, setOutflowModalVisible] = useState(false);
  const [outflowAmount, setOutflowAmount] = useState('');
  const [outflowConcept, setOutflowConcept] = useState('');
  const [outflowFromDrawer, setOutflowFromDrawer] = useState(true);

  // Modal para crear cliente rápido si no está en la lista
  const [quickCustomerModal, setQuickCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustAlias, setNewCustAlias] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');

  const totalAmount = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  const changeAmount =
    receivedCash !== null && receivedCash >= totalAmount
      ? receivedCash - totalAmount
      : 0;

  const addToCart = (product: LocalProduct) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as Array<{ product: LocalProduct; quantity: number }>;
    });
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomerId(undefined);
    setReceivedCash(null);
  };

  const handleAddFreeItem = () => {
    const price = parseFloat(freeItemPrice.replace(/[^0-9]/g, ''));
    if (isNaN(price) || price <= 0) {
      showToast({
        type: 'warning',
        title: 'Precio no válido',
        message: 'Por favor ingresa un precio mayor a cero.',
      });
      return;
    }

    const name = freeItemName.trim() || `Venta Libre ${formatMoney(price)}`;
    const virtualProduct: LocalProduct = {
      id: `custom_${Date.now()}`,
      name,
      price,
      current_stock: 999,
      min_stock_alert: 0,
      is_favorite: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_deleted: false,
      sync_status: 'synced',
    };

    addToCart(virtualProduct);
    setFreeItemName('');
    setFreeItemPrice('');
    setFreeItemModalVisible(false);
  };

  const handleSaveOutflow = async () => {
    const amount = parseFloat(outflowAmount.replace(/[^0-9]/g, ''));
    if (isNaN(amount) || amount <= 0) {
      showToast({
        type: 'warning',
        title: 'Monto no válido',
        message: 'Ingresa un monto válido para la salida de dinero.',
      });
      return;
    }

    if (!outflowConcept.trim()) {
      showToast({
        type: 'warning',
        title: 'Concepto requerido',
        message: 'Indica el proveedor o concepto (ej. Bimbo, Panadería, Bolsas).',
      });
      return;
    }

    try {
      await supplierRepository.createBill({
        supplierName: outflowConcept.trim(),
        totalAmount: amount,
        isPaid: outflowFromDrawer,
        createdBy: role,
        notes: outflowFromDrawer
          ? 'Pagado en efectivo de la caja'
          : 'Factura pendiente de pago',
      });

      setOutflowAmount('');
      setOutflowConcept('');
      setOutflowModalVisible(false);
      await onSaleCompleted();

      showToast({
        type: 'success',
        title: 'Salida Registrada',
        message: `Monto: ${formatMoney(amount)} • ${outflowConcept.trim()}`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error al registrar salida',
        message: err.message,
      });
    }
  };

  const handleQuickCreateCustomer = async () => {
    if (!newCustName.trim()) {
      showToast({
        type: 'warning',
        title: 'Nombre requerido',
        message: 'El nombre del cliente es obligatorio.',
      });
      return;
    }

    try {
      const created = await customerRepository.save({
        name: newCustName.trim(),
        alias: newCustAlias.trim() || undefined,
        phone: newCustPhone.trim() || undefined,
        created_by: role,
      });

      setNewCustName('');
      setNewCustAlias('');
      setNewCustPhone('');
      setQuickCustomerModal(false);
      setSelectedCustomerId(created.id);
      await onSaleCompleted();

      showToast({
        type: 'success',
        title: 'Cliente Creado',
        message: `${created.name} agregado a la libreta.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error creando cliente',
        message: err.message,
      });
    }
  };

  const handleCashSale = async () => {
    if (cart.length === 0) return;

    try {
      await saleRepository.createSale({
        paymentType: 'cash',
        totalAmount,
        cashAmount: totalAmount,
        debtAmount: 0,
        createdBy: role,
        items: cart.map((item) => ({
          productId: item.product.id.startsWith('custom_') ? undefined : item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.price,
          subtotal: item.product.price * item.quantity,
        })),
      });

      const change = receivedCash !== null && receivedCash >= totalAmount ? receivedCash - totalAmount : 0;
      const changeText = change > 0 ? ` • Cambio: ${formatMoney(change)}` : '';

      clearCart();
      await onSaleCompleted();

      showToast({
        type: 'success',
        title: 'Venta en Efectivo Cobrada',
        message: `Total: ${formatMoney(totalAmount)}${changeText}`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error al registrar venta',
        message: err.message,
      });
    }
  };

  const handleTransferSale = async () => {
    if (cart.length === 0) return;

    try {
      await saleRepository.createSale({
        paymentType: 'transfer',
        totalAmount,
        cashAmount: 0,
        transferAmount: totalAmount,
        debtAmount: 0,
        notes: 'Pago por Nequi / Transferencia',
        createdBy: role,
        items: cart.map((item) => ({
          productId: item.product.id.startsWith('custom_') ? undefined : item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.price,
          subtotal: item.product.price * item.quantity,
        })),
      });

      clearCart();
      await onSaleCompleted();

      showToast({
        type: 'success',
        title: 'Venta Digital Registrada',
        message: `${formatMoney(totalAmount)} vía Nequi / Transferencia.`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error al registrar venta Nequi',
        message: err.message,
      });
    }
  };

  const handleDebtSale = async () => {
    if (cart.length === 0) return;
    if (!selectedCustomerId) {
      showToast({
        type: 'warning',
        title: 'Cliente no seleccionado',
        message: 'Selecciona el cliente a quien le vas a otorgar el crédito.',
      });
      return;
    }

    const customer = customers.find((c) => c.id === selectedCustomerId);

    try {
      await saleRepository.createSale({
        customerId: selectedCustomerId,
        paymentType: 'debt',
        totalAmount,
        cashAmount: 0,
        debtAmount: totalAmount,
        createdBy: role,
        items: cart.map((item) => ({
          productId: item.product.id.startsWith('custom_') ? undefined : item.product.id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.price,
          subtotal: item.product.price * item.quantity,
        })),
      });

      clearCart();
      await onSaleCompleted();

      showToast({
        type: 'success',
        title: 'Crédito Guardado en Libreta',
        message: `${customer?.name || 'Cliente'} • ${formatMoney(totalAmount)}`,
      });
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error al registrar crédito',
        message: err.message,
      });
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!searchProduct.trim()) return true;
    return p.name.toLowerCase().includes(searchProduct.toLowerCase().trim());
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Barra de Búsqueda y Botón Venta Rápida */}
      <View style={styles.topActionsRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍 Buscar producto..."
          value={searchProduct}
          onChangeText={setSearchProduct}
          placeholderTextColor="#94A3B8"
        />
        <TouchableOpacity
          style={styles.freeItemButton}
          onPress={() => setFreeItemModalVisible(true)}
        >
          <Text style={styles.freeItemButtonText}>⚡ Monto Libre</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.outflowButton}
          onPress={() => setOutflowModalVisible(true)}
        >
          <Text style={styles.outflowButtonText}>💸 Salida</Text>
        </TouchableOpacity>
      </View>

      {/* Cuadrícula de Productos */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {searchProduct.trim() ? 'Resultados' : 'Productos Frecuentes'}
        </Text>
        <Text style={styles.sectionHint}>Toca para añadir al pedido</Text>
      </View>

      <View style={styles.productGrid}>
        {filteredProducts.map((prod) => {
          const inCart = cart.find((i) => i.product.id === prod.id);
          const isLowStock = prod.current_stock <= prod.min_stock_alert;
          return (
            <TouchableOpacity
              key={prod.id}
              style={[
                styles.productCard,
                inCart && styles.productCardActive,
                isLowStock && styles.productCardLowStock,
              ]}
              onPress={() => addToCart(prod)}
            >
              <Text style={styles.productName} numberOfLines={2}>
                {prod.name}
              </Text>
              <Text style={styles.productPrice}>{formatMoney(prod.price)}</Text>
              <View style={styles.stockRow}>
                <Text
                  style={[
                    styles.productStockText,
                    isLowStock && styles.productStockLowText,
                  ]}
                >
                  Stock: {prod.current_stock}
                </Text>
              </View>
              {inCart && (
                <View style={styles.quantityBadge}>
                  <Text style={styles.quantityText}>x{inCart.quantity}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Carrito de Compra Activo */}
      {cart.length > 0 && (
        <View style={styles.cartContainer}>
          <View style={styles.cartHeader}>
            <View>
              <Text style={styles.cartTitle}>Cuenta en Curso</Text>
              <Text style={styles.cartSubtitle}>
                {cart.reduce((s, i) => s + i.quantity, 0)} artículos agregados
              </Text>
            </View>
            <TouchableOpacity onPress={clearCart} style={styles.clearBtn}>
              <Text style={styles.clearText}>Vaciar</Text>
            </TouchableOpacity>
          </View>

          {/* Lista de Items en Carrito */}
          <View style={styles.cartItemsList}>
            {cart.map((item) => (
              <View key={item.product.id} style={styles.cartItemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cartItemName}>{item.product.name}</Text>
                  <Text style={styles.cartItemPrice}>
                    {formatMoney(item.product.price)} c/u
                  </Text>
                </View>

                <View style={styles.quantityControl}>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => updateQuantity(item.product.id, -1)}
                  >
                    <Text style={styles.qtyBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyNumber}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyBtn}
                    onPress={() => updateQuantity(item.product.id, 1)}
                  >
                    <Text style={styles.qtyBtnText}>+</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.cartItemSubtotal}>
                  {formatMoney(item.product.price * item.quantity)}
                </Text>
              </View>
            ))}
          </View>

          {/* Gran Total */}
          <View style={styles.totalDisplay}>
            <Text style={styles.totalLabel}>TOTAL A COBRAR:</Text>
            <Text style={styles.totalNumber}>{formatMoney(totalAmount)}</Text>
          </View>

          {/* Atajos de Efectivo y Vuelto */}
          <Text style={styles.fieldLabel}>Efectivo recibido (Calculador de Vuelto):</Text>
          <View style={styles.cashChipsRow}>
            {[totalAmount, 5000, 10000, 20000, 50000, 100000]
              .filter(
                (val, idx, arr) => arr.indexOf(val) === idx && val >= totalAmount
              )
              .map((val) => (
                <TouchableOpacity
                  key={val}
                  style={[
                    styles.cashChip,
                    receivedCash === val && styles.cashChipActive,
                  ]}
                  onPress={() => setReceivedCash(val)}
                >
                  <Text
                    style={[
                      styles.cashChipText,
                      receivedCash === val && styles.cashChipTextActive,
                    ]}
                  >
                    {val === totalAmount ? 'Exacto' : formatMoney(val)}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>

          {receivedCash !== null && receivedCash > totalAmount && (
            <View style={styles.changeDisplay}>
              <Text style={styles.changeLabel}>CAMBIO / VUELTO:</Text>
              <Text style={styles.changeNumber}>{formatMoney(changeAmount)}</Text>
            </View>
          )}

          {/* Botones Principales de Cobro: Efectivo vs Nequi / Transferencia */}
          <View style={styles.checkoutActionsRow}>
            <TouchableOpacity style={styles.cashSaleButton} onPress={handleCashSale}>
              <Text style={styles.cashSaleButtonText}>
                💵 Efectivo ({formatMoney(totalAmount)})
              </Text>
              <Text style={styles.checkoutSubtext}>Entra al cajón físico</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.nequiSaleButton} onPress={handleTransferSale}>
              <Text style={styles.nequiSaleButtonText}>
                📲 Nequi / Transf. ({formatMoney(totalAmount)})
              </Text>
              <Text style={styles.checkoutSubtextNequi}>Entra a tu cuenta</Text>
            </TouchableOpacity>
          </View>

          {/* Sección de Asignar a Crédito */}
          <View style={styles.fiarBox}>
            <View style={styles.fiarBoxHeader}>
              <Text style={styles.fiarBoxTitle}>O Asignar a Crédito de Cliente:</Text>
              <TouchableOpacity
                onPress={() => setQuickCustomerModal(true)}
                style={styles.newCustBtn}
              >
                <Text style={styles.newCustBtnText}>+ Nuevo Cliente</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.customerChipsScroll}
            >
              {customers.map((c) => {
                const isSelected = selectedCustomerId === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[
                      styles.customerPill,
                      isSelected && styles.customerPillActive,
                    ]}
                    onPress={() =>
                      setSelectedCustomerId(isSelected ? undefined : c.id)
                    }
                  >
                    <Text
                      style={[
                        styles.customerPillName,
                        isSelected && styles.customerPillNameActive,
                      ]}
                    >
                      {c.name}
                    </Text>
                    <Text
                      style={[
                        styles.customerPillDebt,
                        isSelected && styles.customerPillDebtActive,
                      ]}
                    >
                      Saldo: {formatMoney(c.current_debt)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {selectedCustomerId && (
              <TouchableOpacity style={styles.fiarConfirmBtn} onPress={handleDebtSale}>
                <Text style={styles.fiarConfirmBtnText}>
                  📒 Registrar en Libreta de Créditos ({formatMoney(totalAmount)})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Modal para Monto Libre (Pan, Queso, etc.) */}
      <Modal visible={freeItemModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>⚡ Venta por Monto Libre</Text>
            <Text style={styles.modalDesc}>
              Para artículos sin código (ej: $2.000 de pan, $3.500 de queso).
            </Text>

            <Text style={styles.inputLabel}>¿Cuánto cuesta?</Text>
            <TextInput
              style={styles.priceBigInput}
              keyboardType="numeric"
              placeholder="$ 0"
              value={freeItemPrice}
              onChangeText={setFreeItemPrice}
              autoFocus
            />

            <Text style={styles.inputLabel}>Nombre o concepto (opcional):</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ej: Pan, Queso, Menudencias..."
              value={freeItemName}
              onChangeText={setFreeItemName}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setFreeItemModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleAddFreeItem}
              >
                <Text style={styles.modalConfirmText}>Agregar a la Cuenta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para Crear Cliente Rápido */}
      <Modal visible={quickCustomerModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>👤 Registrar Nuevo Cliente</Text>
            <Text style={styles.modalDesc}>
              Añádelo en 2 segundos para asignarle crédito de inmediato.
            </Text>

            <Text style={styles.inputLabel}>Nombre y Apellido *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ej: Don Beto"
              value={newCustName}
              onChangeText={setNewCustName}
              autoFocus
            />

            <Text style={styles.inputLabel}>Apodo o Referencia</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ej: El mecánico del taller, casa 12"
              value={newCustAlias}
              onChangeText={setNewCustAlias}
            />

            <Text style={styles.inputLabel}>Teléfono (Opcional)</Text>
            <TextInput
              style={styles.textInput}
              keyboardType="phone-pad"
              placeholder="Ej: 310 123 4567"
              value={newCustPhone}
              onChangeText={setNewCustPhone}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setQuickCustomerModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleQuickCreateCustomer}
              >
                <Text style={styles.modalConfirmText}>Crear y Seleccionar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal para Salida de Dinero / Pago a Proveedor */}
      <Modal visible={outflowModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>💸 Registrar Salida de Dinero</Text>
            <Text style={styles.modalDesc}>
              Registra pagos a proveedores (Bimbo, Postobón, etc.) o gastos para que el arqueo de caja cuadre exacto.
            </Text>

            <Text style={styles.inputLabel}>¿Cuánto dinero salió? *</Text>
            <TextInput
              style={styles.priceBigInput}
              keyboardType="numeric"
              placeholder="$ 0"
              value={outflowAmount}
              onChangeText={setOutflowAmount}
              autoFocus
            />

            <Text style={styles.inputLabel}>Proveedor o Concepto *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ej: Bimbo, Coca-Cola, Bolsas, Domicilio..."
              value={outflowConcept}
              onChangeText={setOutflowConcept}
            />

            <View style={styles.outflowSourceRow}>
              <TouchableOpacity
                style={[
                  styles.outflowSourceOption,
                  outflowFromDrawer && styles.outflowSourceActive,
                ]}
                onPress={() => setOutflowFromDrawer(true)}
              >
                <Text
                  style={[
                    styles.outflowSourceText,
                    outflowFromDrawer && styles.outflowSourceTextActive,
                  ]}
                >
                  💵 Salió de la Caja
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.outflowSourceOption,
                  !outflowFromDrawer && styles.outflowSourceActive,
                ]}
                onPress={() => setOutflowFromDrawer(false)}
              >
                <Text
                  style={[
                    styles.outflowSourceText,
                    !outflowFromDrawer && styles.outflowSourceTextActive,
                  ]}
                >
                  ⏳ Pendiente por Pagar
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setOutflowModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#DC2626' }]}
                onPress={handleSaveOutflow}
              >
                <Text style={styles.modalConfirmText}>Registrar Salida</Text>
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
  topActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
  },
  freeItemButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  freeItemButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  outflowButton: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  outflowButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  outflowSourceRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  outflowSourceOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  outflowSourceActive: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  outflowSourceText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  outflowSourceTextActive: {
    color: '#DC2626',
    fontWeight: 'bold',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  sectionHint: {
    fontSize: 12,
    color: '#64748B',
  },
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  productCard: {
    width: '31%',
    minWidth: 100,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    elevation: 1,
  },
  productCardActive: {
    borderColor: '#16A34A',
    backgroundColor: '#F0FDF4',
  },
  productCardLowStock: {
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
    minHeight: 34,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#16A34A',
    marginTop: 4,
  },
  stockRow: {
    marginTop: 4,
  },
  productStockText: {
    fontSize: 10,
    color: '#64748B',
  },
  productStockLowText: {
    color: '#D97706',
    fontWeight: 'bold',
  },
  quantityBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#16A34A',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
  },
  quantityText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  cartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: '#16A34A',
    elevation: 3,
    marginTop: 4,
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cartTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  cartSubtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  clearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  clearText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  cartItemsList: {
    borderTopWidth: 1,
    borderColor: '#F1F5F9',
    paddingVertical: 8,
  },
  cartItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#F8FAFC',
  },
  cartItemName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  cartItemPrice: {
    fontSize: 11,
    color: '#64748B',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 4,
    marginHorizontal: 10,
  },
  qtyBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  qtyBtnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  qtyNumber: {
    fontSize: 13,
    fontWeight: 'bold',
    paddingHorizontal: 6,
  },
  cartItemSubtotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    minWidth: 60,
    textAlign: 'right',
  },
  totalDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  totalNumber: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#15803D',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 6,
  },
  cashChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  cashChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  cashChipActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#16A34A',
  },
  cashChipText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  cashChipTextActive: {
    color: '#15803D',
  },
  changeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FEF9C3',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FDE047',
  },
  changeLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#854D0E',
  },
  changeNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#854D0E',
  },
  checkoutActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cashSaleButton: {
    flex: 1,
    backgroundColor: '#16A34A',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 2,
  },
  cashSaleButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkoutSubtext: {
    color: '#DCFCE7',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  nequiSaleButton: {
    flex: 1,
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    elevation: 2,
  },
  nequiSaleButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkoutSubtextNequi: {
    color: '#E0E7FF',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '600',
  },
  fiarBox: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
  },
  fiarBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fiarBoxTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#475569',
  },
  newCustBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
  },
  newCustBtnText: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: 'bold',
  },
  customerChipsScroll: {
    marginVertical: 4,
  },
  customerPill: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  customerPillActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  customerPillName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  customerPillNameActive: {
    color: '#92400E',
  },
  customerPillDebt: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  customerPillDebtActive: {
    color: '#B45309',
    fontWeight: 'bold',
  },
  fiarConfirmBtn: {
    backgroundColor: '#D97706',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  fiarConfirmBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
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
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  modalDesc: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
    marginTop: 6,
  },
  priceBigInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 12,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#15803D',
    textAlign: 'center',
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  modalCancelText: {
    color: '#64748B',
    fontWeight: 'bold',
  },
  modalConfirmBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#16A34A',
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
