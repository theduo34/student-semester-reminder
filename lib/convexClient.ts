import { ConvexReactClient } from 'convex/react';
import * as SecureStore from 'expo-secure-store';

import { CONVEX_URL } from '@/lib/env';

export const convex = new ConvexReactClient(CONVEX_URL, {
  unsavedChangesWarning: false,
});

// Token storage for ConvexAuthProvider, per Convex Auth's React Native guidance.
export const secureStorage = {
  getItem: SecureStore.getItemAsync,
  setItem: SecureStore.setItemAsync,
  removeItem: SecureStore.deleteItemAsync,
};
