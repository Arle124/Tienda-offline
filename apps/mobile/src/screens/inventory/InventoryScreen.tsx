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
} from 'react-native';
import {
  LocalProduct,
  UserRole,
  productRepository,
  saleRepository,
  TodaySalesSummary,
} from '../../database';

interface InventoryScreenProps {
  products: LocalProduct[];
  role: UserRole;
  onRefreshData: () => Promise<void>;
}

export function InventoryScreen({
  products,
  role,
  onRefreshData,
}: InventoryScreenProps) {
  const [activeSubTab, setActiveSubTab] = useState<'stock' | 'today_sales'>('stock');
  const [searchProduct, setSearchProduct] = useState('');
  const [todaySummary, setTodaySummary] = useState<TodaySalesSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Modal para Crear / Editar Producto
  const [productModalVisible, setProductModalVisible] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodCost, setProdCost] = useState('');
  const [prodStock, setProdStock] = useState('');
  const [prodMinAlert, setProdMinAlert] = useState('3');
  const [prodIsFav, setProdIsFav] = useState(false);

  const loadDailySummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const summary = await saleRepository.getTodaySummary();
      setTodaySummary(summary);
    } catch (err) {
      console.error('Error cargando resumen del día:', err);
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    if (activeSubTab === 'today_sales') {
      loadDailySummary();
    }
  }, [activeSubTab, loadDailySummary]);

  const handleAdjustStock = async (product: LocalProduct, delta: number) => {
    try {
      await productRepository.adjustStock(product.id, delta);
      await onRefreshData();
    } catch (err: any) {
      const msg = `Error ajustando stock: ${err.message}`;
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Error', msg);
    }
  };

  const openCreateModal = () => {
    setEditingProductId(null);
    setProdName('');
    setProdPrice('');
    setProdCost('');
    setProdStock('');
    setProdMinAlert('3');
    setProdIsFav(false);
    setProductModalVisible(true);
  };

  const openEditModal = (p: LocalProduct) => {
    setEditingProductId(p.id);
    setProdName(p.name);
    setProdPrice(p.price.toString());
    setProdCost(p.cost_price ? p.cost_price.toString() : '');
    setProdStock(p.current_stock.toString());
    setProdMinAlert(p.min_stock_alert ? p.min_stock_alert.toString() : '3');
    setProdIsFav(Boolean(p.is_favorite));
    setProductModalVisible(true);
  };

  const handleSaveProduct = async () => {
    if (!prodName.trim()) {
      const msg = 'El nombre del producto es obligatorio.';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Atención', msg);
      return;
    }

    const price = parseFloat(prodPrice.replace(/[^0-9]/g, ''));
    if (isNaN(price) || price <= 0) {
      const msg = 'Ingresa un precio de venta válido.';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Atención', msg);
      return;
    }

    const stock = parseFloat(prodStock.replace(/[^0-9.-]/g, '')) || 0;
    const cost = parseFloat(prodCost.replace(/[^0-9]/g, '')) || 0;
    const minAlert = parseFloat(prodMinAlert.replace(/[^0-9]/g, '')) || 3;

    try {
      await productRepository.save({
        id: editingProductId || undefined,
        name: prodName.trim(),
        price,
        cost_price: cost,
        current_stock: stock,
        min_stock_alert: minAlert,
        is_favorite: prodIsFav,
        created_by: role,
      });

      setProductModalVisible(false);
      await onRefreshData();

      const msg = editingProductId
        ? '✅ Producto actualizado correctamente.'
        : '✅ Producto creado con éxito.';
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Listo', msg);
    } catch (err: any) {
      const msg = `Error guardando producto: ${err.message}`;
      if (Platform.OS === 'web') alert(msg);
      else Alert.alert('Error', msg);
    }
  };

  const lowStockProducts = products.filter(
    (p) => p.current_stock <= p.min_stock_alert
  );

  const filteredProducts = products.filter((p) => {
    if (!searchProduct.trim()) return true;
    return p.name.toLowerCase().includes(searchProduct.toLowerCase().trim());
  });

  return (
    <View style={styles.container}>
      {/* Pestañas de Segmento Superior */}
      <View style={styles.segmentContainer}>
        <TouchableOpacity
          style={[
            styles.segmentButton,
            activeSubTab === 'stock' && styles.segmentButtonActive,
          ]}
          onPress={() => setActiveSubTab('stock')}
        >
          <Text
            style={[
              styles.segmentText,
              activeSubTab === 'stock' && styles.segmentTextActive,
            ]}
          >
            📦 Existencias ({products.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.segmentButton,
            activeSubTab === 'today_sales' && styles.segmentButtonActive,
          ]}
          onPress={() => setActiveSubTab('today_sales')}
        >
          <Text
            style={[
              styles.segmentText,
              activeSubTab === 'today_sales' && styles.segmentTextActive,
            ]}
          >
            📊 Qué se Vendió Hoy
          </Text>
        </TouchableOpacity>
      </View>

      {/* VISTA 1: EXISTENCIAS Y CONTROL DE STOCK */}
      {activeSubTab === 'stock' && (
        <ScrollView
          style={styles.tabContent}
          contentContainerStyle={styles.scrollPadding}
        >
          {/* Banner de alerta si hay productos por agotarse */}
          {lowStockProducts.length > 0 && (
            <View style={styles.alertBanner}>
              <Text style={styles.alertBannerTitle}>
                ⚠️ Alerta de Inventario: {lowStockProducts.length} productos por agotarse
              </Text>
              <Text style={styles.alertBannerSub}>
                {lowStockProducts.map((p) => `${p.name} (${p.current_stock} uds)`).join(' • ')}
              </Text>
            </View>
          )}

          {/* Buscador y Botón Nuevo Producto */}
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="🔍 Buscar en inventario..."
              value={searchProduct}
              onChangeText={setSearchProduct}
              placeholderTextColor="#94A3B8"
            />
            <TouchableOpacity style={styles.newProdBtn} onPress={openCreateModal}>
              <Text style={styles.newProdBtnText}>+ Producto</Text>
            </TouchableOpacity>
          </View>

          {/* Lista de Productos */}
          <View style={styles.productsList}>
            {filteredProducts.map((prod) => {
              const isLow = prod.current_stock <= prod.min_stock_alert;
              return (
                <View
                  key={prod.id}
                  style={[styles.productRow, isLow && styles.productRowLow]}
                >
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => openEditModal(prod)}
                  >
                    <View style={styles.prodNameLine}>
                      <Text style={styles.prodName}>{prod.name}</Text>
                      {prod.is_favorite && (
                        <Text style={styles.starBadge}>⭐ Mostrador</Text>
                      )}
                    </View>

                    <Text style={styles.prodPrice}>
                      ${prod.price.toLocaleString()}
                      {prod.cost_price ? ` • Costo: $${prod.cost_price.toLocaleString()}` : ''}
                    </Text>

                    <Text style={[styles.prodStockLabel, isLow && styles.prodStockLowLabel]}>
                      Stock actual: {prod.current_stock} uds{' '}
                      {isLow ? `(Mínimo: ${prod.min_stock_alert})` : ''}
                    </Text>
                  </TouchableOpacity>

                  {/* Botones rápidos de ajuste de existencias */}
                  <View style={styles.stockQuickAdjust}>
                    <TouchableOpacity
                      style={styles.adjustBtn}
                      onPress={() => handleAdjustStock(prod, -1)}
                    >
                      <Text style={styles.adjustBtnText}>−</Text>
                    </TouchableOpacity>

                    <View style={styles.stockBadge}>
                      <Text
                        style={[
                          styles.stockBadgeNumber,
                          isLow && styles.stockBadgeNumberLow,
                        ]}
                      >
                        {prod.current_stock}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.adjustBtn}
                      onPress={() => handleAdjustStock(prod, 1)}
                    >
                      <Text style={styles.adjustBtnText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* VISTA 2: QUÉ SE VENDIÓ HOY */}
      {activeSubTab === 'today_sales' && (
        <ScrollView
          style={styles.tabContent}
          contentContainerStyle={styles.scrollPadding}
        >
          {loadingSummary ? (
            <ActivityIndicator
              size="large"
              color="#16A34A"
              style={{ marginVertical: 40 }}
            />
          ) : todaySummary ? (
            <View>
              {/* Tarjetas de Métricas de Hoy */}
              <View style={styles.metricsGrid}>
                <View style={[styles.metricCard, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={styles.metricCardLabel}>Dinero en Caja Hoy</Text>
                  <Text style={[styles.metricCardValue, { color: '#166534' }]}>
                    ${todaySummary.totalRevenueToday.toLocaleString()}
                  </Text>
                  <Text style={styles.metricCardSub}>
                    Ventas: ${todaySummary.totalCashSales.toLocaleString()} • Abonos: $
                    {todaySummary.totalPaymentsReceived.toLocaleString()}
                  </Text>
                </View>

                <View style={[styles.metricCard, { backgroundColor: '#FEF9C3' }]}>
                  <Text style={styles.metricCardLabel}>Fiado Hoy a Vecinos</Text>
                  <Text style={[styles.metricCardValue, { color: '#854D0E' }]}>
                    ${todaySummary.totalDebtSales.toLocaleString()}
                  </Text>
                  <Text style={styles.metricCardSub}>
                    {todaySummary.totalSalesCount} transacciones hoy
                  </Text>
                </View>
              </View>

              {/* Lista Agregada de Productos Vendidos Hoy */}
              <View style={styles.soldProductsBox}>
                <Text style={styles.soldSectionTitle}>
                  Productos Vendidos en el Día
                </Text>
                <Text style={styles.soldSectionSubtitle}>
                  Resumen de lo que salió del inventario hoy
                </Text>

                {todaySummary.productsSold.length === 0 ? (
                  <View style={styles.emptySold}>
                    <Text style={styles.emptySoldText}>
                      Aún no se han registrado salidas de mercancía hoy.
                    </Text>
                  </View>
                ) : (
                  todaySummary.productsSold.map((item, idx) => (
                    <View key={idx} style={styles.soldItemRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.soldItemName}>{item.productName}</Text>
                        <Text style={styles.soldItemQty}>
                          Cantidad vendida: {item.totalQuantity} unidades
                        </Text>
                      </View>
                      <Text style={styles.soldItemTotal}>
                        ${item.totalSubtotal.toLocaleString()}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}

      {/* MODAL: Crear o Editar Producto */}
      <Modal visible={productModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {editingProductId ? '✏️ Editar Producto' : '📦 Nuevo Producto'}
            </Text>

            <Text style={styles.inputLabel}>Nombre del Producto *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Ej: Arroz Diana 1kg, Coca Cola 1.5L"
              value={prodName}
              onChangeText={setProdName}
              autoFocus
            />

            <View style={styles.inputsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Precio Venta *</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  placeholder="$ 4.000"
                  value={prodPrice}
                  onChangeText={setProdPrice}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Costo Proveedor</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  placeholder="$ 3.200"
                  value={prodCost}
                  onChangeText={setProdCost}
                />
              </View>
            </View>

            <View style={styles.inputsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Existencias (Stock)</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  placeholder="Ej: 24"
                  value={prodStock}
                  onChangeText={setProdStock}
                />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.inputLabel}>Alerta Mínimo</Text>
                <TextInput
                  style={styles.textInput}
                  keyboardType="numeric"
                  placeholder="Ej: 3"
                  value={prodMinAlert}
                  onChangeText={setProdMinAlert}
                />
              </View>
            </View>

            {/* Switch Favorito / Mostrador */}
            <TouchableOpacity
              style={[
                styles.favToggleBtn,
                prodIsFav && styles.favToggleBtnActive,
              ]}
              onPress={() => setProdIsFav(!prodIsFav)}
            >
              <Text style={styles.favToggleText}>
                {prodIsFav
                  ? '⭐ En Mostrador Rápido (Favorito)'
                  : '☆ Agregar a Mostrador Rápido'}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setProductModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveProduct}
              >
                <Text style={styles.saveBtnText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  segmentContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderColor: '#E2E8F0',
    padding: 8,
    gap: 8,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  segmentButtonActive: {
    backgroundColor: '#0F172A',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#64748B',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  tabContent: {
    flex: 1,
  },
  scrollPadding: {
    padding: 16,
    paddingBottom: 40,
  },
  alertBanner: {
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 4,
    borderLeftColor: '#D97706',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
  },
  alertBannerTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#92400E',
  },
  alertBannerSub: {
    fontSize: 11,
    color: '#B45309',
    marginTop: 4,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
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
  newProdBtn: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  newProdBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  productsList: {
    gap: 10,
  },
  productRow: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 1,
  },
  productRowLow: {
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  prodNameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  prodName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  starBadge: {
    fontSize: 10,
    color: '#D97706',
    fontWeight: 'bold',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  prodPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: '#16A34A',
    marginTop: 3,
  },
  prodStockLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 3,
  },
  prodStockLowLabel: {
    color: '#D97706',
    fontWeight: 'bold',
  },
  stockQuickAdjust: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 2,
  },
  adjustBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
  },
  adjustBtnText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  stockBadge: {
    paddingHorizontal: 10,
  },
  stockBadgeNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  stockBadgeNumberLow: {
    color: '#D97706',
  },
  metricsGrid: {
    gap: 12,
    marginBottom: 20,
  },
  metricCard: {
    padding: 16,
    borderRadius: 14,
    elevation: 1,
  },
  metricCardLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#334155',
  },
  metricCardValue: {
    fontSize: 26,
    fontWeight: 'bold',
    marginTop: 4,
  },
  metricCardSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  soldProductsBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  soldSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  soldSectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 12,
  },
  emptySold: {
    paddingVertical: 30,
    alignItems: 'center',
  },
  emptySoldText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  soldItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  soldItemName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  soldItemQty: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  soldItemTotal: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#16A34A',
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
    marginBottom: 14,
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
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 6,
  },
  inputsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  favToggleBtn: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    marginTop: 10,
  },
  favToggleBtnActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  favToggleText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#92400E',
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
  saveBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#16A34A',
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});
