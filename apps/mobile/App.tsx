import React from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <Text style={styles.title}>El Cuaderno Digital</Text>
        <Text style={styles.subtitle}>Modo Offline Activo • Listo para vender</Text>
      </View>

      <View style={styles.dashboard}>
        <TouchableOpacity style={[styles.card, styles.posCard]}>
          <Text style={styles.cardTitle}>Venta Rápida</Text>
          <Text style={styles.cardDesc}>Mostrador y Calculadora</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.card, styles.debtCard]}>
          <Text style={styles.cardTitle}>Cuaderno de Fiados</Text>
          <Text style={styles.cardDesc}>Cuentas y Abonos</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.card, styles.inventoryCard]}>
          <Text style={styles.cardTitle}>¿Qué se está acabando?</Text>
          <Text style={styles.cardDesc}>Semáforo de Reposición</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    padding: 20,
    backgroundColor: '#1E293B',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 4,
  },
  dashboard: {
    padding: 16,
    gap: 16,
  },
  card: {
    padding: 24,
    borderRadius: 16,
    elevation: 3,
  },
  posCard: {
    backgroundColor: '#22C55E',
  },
  debtCard: {
    backgroundColor: '#EAB308',
  },
  inventoryCard: {
    backgroundColor: '#3B82F6',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  cardDesc: {
    fontSize: 14,
    color: '#F1F5F9',
    marginTop: 4,
  },
});
