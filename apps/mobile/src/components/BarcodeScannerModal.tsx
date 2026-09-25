import React, { useState, useEffect } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as Haptics from 'expo-haptics';

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  subtitle?: string;
}

const { width } = Dimensions.get('window');
const SCAN_BOX_SIZE = Math.min(width * 0.75, 280);

export function BarcodeScannerModal({
  visible,
  onClose,
  onScan,
  title = 'Escanear Código de Barras',
  subtitle = 'Apunta la cámara al código del empaque',
}: BarcodeScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  useEffect(() => {
    if (visible) {
      setHasScanned(false);
      setTorch(false);
    }
  }, [visible]);

  if (!visible) return null;

  const handleBarcodeScanned = async (result: BarcodeScanningResult) => {
    if (hasScanned || !result.data) return;
    setHasScanned(true);

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      // Haptics opcional
    }

    onScan(result.data.trim());
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        {/* Manejo de Permisos */}
        {!permission ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#EA580C" />
            <Text style={styles.statusText}>Preparando cámara...</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.permissionBox}>
            <Text style={styles.permissionIcon}>📷</Text>
            <Text style={styles.permissionTitle}>Permiso de Cámara Requerido</Text>
            <Text style={styles.permissionDesc}>
              Para escanear códigos de barras automáticamente, Mi Cuaderno Digital necesita acceso a la cámara.
            </Text>
            <TouchableOpacity
              style={styles.grantBtn}
              onPress={requestPermission}
              activeOpacity={0.8}
            >
              <Text style={styles.grantBtnText}>Permitir Acceso a la Cámara</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelPermissionBtn} onPress={onClose}>
              <Text style={styles.cancelPermissionBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Visor de Cámara con Detección */
          <View style={StyleSheet.absoluteFill}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              enableTorch={torch}
              barcodeScannerSettings={{
                barcodeTypes: [
                  'ean13',
                  'ean8',
                  'upc_a',
                  'upc_e',
                  'code128',
                  'code39',
                  'qr',
                ],
              }}
              onBarcodeScanned={hasScanned ? undefined : handleBarcodeScanned}
            />

            {/* Máscara y Mira de Escaneo */}
            <View style={styles.overlay}>
              {/* Barra Superior */}
              <View style={styles.header}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.headerTitle}>{title}</Text>
                  <Text style={styles.headerSubtitle}>{subtitle}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.iconButton, torch && styles.torchActive]}
                  onPress={() => setTorch(!torch)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.iconButtonText}>{torch ? '🔦 ON' : '💡 Flash'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconButton, { marginLeft: 8 }]}
                  onPress={onClose}
                  activeOpacity={0.7}
                >
                  <Text style={styles.iconButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Centro con Recuadro Guía */}
              <View style={styles.centerContainer}>
                <View style={styles.scanTargetBox}>
                  {/* Esquinas del marco */}
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                  <View style={styles.laserLine} />
                </View>
                <Text style={styles.scanHint}>
                  Centra las barras del producto dentro del marco
                </Text>
              </View>

              {/* Barra Inferior */}
              <View style={styles.footer}>
                <TouchableOpacity
                  style={styles.closeBottomBtn}
                  onPress={onClose}
                  activeOpacity={0.8}
                >
                  <Text style={styles.closeBottomBtnText}>Cerrar Escáner</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  statusText: {
    color: '#CBD5E1',
    marginTop: 12,
    fontSize: 14,
  },
  permissionBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  permissionIcon: {
    fontSize: 54,
    marginBottom: 16,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  permissionDesc: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  grantBtn: {
    backgroundColor: '#EA580C',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  grantBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 15,
  },
  cancelPermissionBtn: {
    marginTop: 14,
    paddingVertical: 10,
  },
  cancelPermissionBtnText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 2,
  },
  iconButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  torchActive: {
    backgroundColor: '#F59E0B',
    borderColor: '#D97706',
  },
  iconButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTargetBox: {
    width: SCAN_BOX_SIZE,
    height: SCAN_BOX_SIZE * 0.65,
    borderRadius: 16,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  laserLine: {
    width: '90%',
    height: 2,
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#22C55E',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  scanHint: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 18,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    alignItems: 'center',
  },
  closeBottomBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  closeBottomBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
