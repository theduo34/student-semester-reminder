import { ConvexReactClient } from 'convex/react';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { CONVEX_URL } from '@/lib/env';

export const convex = new ConvexReactClient(CONVEX_URL, {
  unsavedChangesWarning: false,
});

// Token storage for ConvexAuthProvider, per Convex Auth's React Native guidance.
// expo-secure-store has no web implementation (its methods throw/no-op there), so this
// app is Android-first but `web` is still a valid dev target — fall back to
// localStorage there instead of crashing on mount.
export const secureStorage =
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
