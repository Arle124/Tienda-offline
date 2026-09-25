import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

interface LegalTermsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function LegalTermsModal({ visible, onClose }: LegalTermsModalProps) {
  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Cabecera */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>📜 Términos y Privacidad</Text>
              <Text style={styles.subtitle}>Mi Cuaderno Digital • 100% Offline-First</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Contenido Completo de Términos y Condiciones */}
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>1. Filosofía 100% Offline y Soberanía de Datos</Text>
              <Text style={styles.sectionText}>
                Mi Cuaderno Digital opera bajo el principio de almacenamiento local soberano (Offline-First). Todos los registros de su negocio —incluyendo ventas de mostrador, inventario de existencias, costos, precios, libreta de créditos ("fiados"), nombres y números telefónicos de clientes, facturas de proveedores y cierres de caja— se almacenan única y exclusivamente en la memoria interna de su dispositivo mediante una base de datos local SQLite.
              </Text>
              <Text style={styles.sectionText}>
                Los desarrolladores de la aplicación NO recopilamos, no transmitimos a servidores en la nube, no analizamos, no monitoreamos ni comercializamos ninguna información comercial o personal del usuario. Sus datos le pertenecen al 100% a usted.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>2. Custodia de Información y Copias de Seguridad</Text>
              <Text style={styles.sectionText}>
                Al no existir servidores en la nube obligatorios para operar, la custodia y el respaldo preventivo de la información contable es potestad y responsabilidad del usuario.
              </Text>
              <Text style={styles.sectionText}>
                La aplicación dispone de herramientas integradas de "Copia de Seguridad" que le permiten generar un archivo de respaldo completo en formato estándar (.json). Este archivo puede guardarse en su cuenta personal de Google Drive, enviarse a su propio WhatsApp o almacenarse en un medio físico externo seguro.
              </Text>
              <Text style={styles.sectionText}>
                Los desarrolladores no asumen responsabilidad civil, económica o administrativa por pérdida de información derivada de daño físico, extravío, robo, formateo o desinstalación de la aplicación en el dispositivo sin una copia de seguridad previa.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>3. Herramienta de Apoyo y Exención Fiscal</Text>
              <Text style={styles.sectionText}>
                Mi Cuaderno Digital es una herramienta informática de apoyo operativo diseñada para facilitar el control de inventario y cuentas por cobrar en comercios independientes. No constituye un software de facturación electrónica avalado por autoridades tributarias locales (como DIAN, SAT, SUNAT o equivalentes) ni sustituye el asesoramiento contable o tributario profesional.
              </Text>
              <Text style={styles.sectionText}>
                Cada comerciante es el único responsable de cumplir con las declaraciones fiscales, facturación y normativas comerciales vigentes en su respectivo país.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>4. Permisos del Dispositivo y Transparencia</Text>
              <Text style={styles.sectionText}>
                La aplicación únicamente solicita los permisos técnicos estrictamente indispensables para su funcionamiento operativo:
              </Text>
              <Text style={styles.bulletText}>
                • <Text style={styles.boldText}>Cámara (Opcional):</Text> Utilizada exclusivamente cuando el comerciante activa el escáner de códigos de barras para cobrar o registrar productos.
              </Text>
              <Text style={styles.bulletText}>
                • <Text style={styles.boldText}>Almacenamiento y Compartir:</Text> Utilizado únicamente para exportar los reportes en Microsoft Excel (.xlsx) y los archivos de respaldo cuando el usuario lo solicita expresamente.
              </Text>
              <Text style={styles.sectionText}>
                La aplicación no graba audio, no accede a la ubicación geográfica ni solicita permisos invasivos de segundo plano.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>5. Licencia y Modificaciones</Text>
              <Text style={styles.sectionText}>
                Se concede al comerciante una licencia de uso personal y comercial para la gestión de su negocio. Nos reservamos el derecho de actualizar estas directrices para reflejar mejoras operativas o legales en futuras versiones de la aplicación.
              </Text>
            </View>
          </ScrollView>

          {/* Pie con Botón de Confirmación */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.acceptBtn} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.acceptBtnText}>Entendido y Aceptar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    width: '100%',
    height: '85%',
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 18,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
    marginBottom: 6,
  },
  sectionText: {
    fontSize: 12.5,
    color: '#475569',
    lineHeight: 19,
    marginBottom: 6,
  },
  bulletText: {
    fontSize: 12.5,
    color: '#334155',
    lineHeight: 18,
    marginLeft: 4,
    marginBottom: 4,
  },
  boldText: {
    fontWeight: 'bold',
    color: '#0F172A',
  },
  footer: {
    padding: 14,
    borderTopWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  acceptBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
});
