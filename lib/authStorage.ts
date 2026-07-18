import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// expo-secure-store has no web implementation (its methods throw/no-op there), and
// `web` is still a valid dev target — fall back to localStorage there instead of
// crashing on mount.
export const authStorage =
  Platform.OS === 'web'
    ? {
        getItem: async (key: string) => localStorage.getItem(key),
        setItem: async (key: string, value: string) => localStorage.setItem(key, value),
        removeItem: async (key: string) => localStorage.removeItem(key),
      }
    : {
        getItem: SecureStore.getItemAsync,
        setItem: SecureStore.setItemAsync,
        removeItem: SecureStore.deleteItemAsync,
      };
