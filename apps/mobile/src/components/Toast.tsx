import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { useSettings } from '../context/SettingsContext';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  type?: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextData {
  showToast: (options: ToastOptions) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextData>({
  showToast: () => {},
  hideToast: () => {},
});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { hapticEnabled } = useSettings();
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerHaptic = (type: ToastType) => {
    if (!hapticEnabled) return;
    try {
      if (Platform.OS !== 'web') {
        if (type === 'success') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (type === 'error') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else if (type === 'warning') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else {
          Haptics.selectionAsync();
        }
      }
    } catch {
      // Haptics not available, ignore
    }
  };

  const hideToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -120,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setToast(null);
    });
  }, [translateY, opacity]);

  const showToast = useCallback(
    ({ type = 'success', title, message, duration = 3000 }: ToastOptions) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      setToast({ type, title, message, duration });
      triggerHaptic(type);

      // Reset animation values before showing
      translateY.setValue(-120);
      opacity.setValue(0);

      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      timerRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    },
    [translateY, opacity, hideToast]
  );

  const getToastDetails = (type: ToastType = 'info') => {
    switch (type) {
      case 'success':
        return {
          icon: '✓',
          iconColor: '#10B981',
          iconBg: 'rgba(16, 185, 129, 0.18)',
          accentBorder: '#059669',
        };
      case 'error':
        return {
          icon: '✕',
          iconColor: '#EF4444',
          iconBg: 'rgba(239, 68, 68, 0.18)',
          accentBorder: '#DC2626',
        };
      case 'warning':
        return {
          icon: '⚠️',
          iconColor: '#F59E0B',
          iconBg: 'rgba(245, 158, 11, 0.18)',
          accentBorder: '#D97706',
        };
      default:
        return {
          icon: 'ℹ️',
          iconColor: '#38BDF8',
          iconBg: 'rgba(56, 189, 248, 0.18)',
          accentBorder: '#0284C7',
        };
    }
  };

  const details = getToastDetails(toast?.type);

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {toast && (
        <Animated.View
          style={[
            styles.container,
            {
              top: Math.max(insets.top + 8, 20),
              transform: [{ translateY }],
              opacity,
            },
          ]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={[styles.toastCard, { borderLeftColor: details.accentBorder }]}
            activeOpacity={0.9}
            onPress={hideToast}
          >
            <View style={[styles.iconCircle, { backgroundColor: details.iconBg }]}>
              <Text style={[styles.iconText, { color: details.iconColor }]}>
                {details.icon}
              </Text>
            </View>

            <View style={styles.textContainer}>
              <Text style={styles.titleText} numberOfLines={1}>
                {toast.title}
              </Text>
              {toast.message ? (
                <Text style={styles.messageText} numberOfLines={2}>
                  {toast.message}
                </Text>
              ) : null}
            </View>

            <TouchableOpacity
              onPress={hideToast}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 99999,
    alignItems: 'center',
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#0F172A', // Elegante pizarra oscura
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderLeftWidth: 4,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 12,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  messageText: {
    fontSize: 12.5,
    color: '#CBD5E1',
    marginTop: 2,
    lineHeight: 17,
  },
  closeButton: {
    padding: 6,
    marginLeft: 8,
    opacity: 0.6,
  },
  closeText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
