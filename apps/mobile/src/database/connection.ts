import { Platform } from 'react-native';
import type { IDatabaseDriver } from './adapter';

export function getDatabaseDriver(): IDatabaseDriver {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getDatabaseDriver: getWebDriver } = require('./connection.web');
    return getWebDriver();
  } else {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getDatabaseDriver: getNativeDriver } = require('./connection.native');
    return getNativeDriver();
  }
}

export * from './adapter';
export * from './schema';
export * from './types';
