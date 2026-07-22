import AsyncStorage from '@react-native-async-storage/async-storage';

const HAS_SEEN_LANDING_KEY = 'termio.hasSeenLanding';

type Listener = () => void;
const listeners = new Set<Listener>();

// null = not yet read from AsyncStorage — useAuthGate treats this the same as its own
// `loading` status rather than guessing. Module-level (not component state) so every
// useAuthGate() instance shares one in-flight read instead of each doing its own.
let cachedValue: boolean | null = null;
let hasStartedLoad = false;

// Deferred until the first subscribe (i.e. the first client-side render) rather than
// run at module scope: Expo web's static output pre-renders this module on Node during
// build/SSR, where AsyncStorage's web implementation reaches for `window` and throws.
// subscribe is only ever called from a client effect (useSyncExternalStore), never
// during server rendering, so gating the read behind it keeps this SSR-safe.
function ensureLoadStarted() {
  if (hasStartedLoad) return;
  hasStartedLoad = true;
  AsyncStorage.getItem(HAS_SEEN_LANDING_KEY).then((value) => {
    cachedValue = value === 'true';
    listeners.forEach((listener) => listener());
  });
}

export function subscribeHasSeenLanding(listener: Listener): () => void {
  ensureLoadStarted();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getHasSeenLandingSnapshot(): boolean | null {
  return cachedValue;
}

// Flips the in-memory value (and notifies subscribers) before the AsyncStorage write
// resolves — this is what lets useAuthGate re-evaluate the instant the landing
// carousel finishes, via useSyncExternalStore, with no navigation reload needed.
export async function markLandingSeen(): Promise<void> {
  cachedValue = true;
  listeners.forEach((listener) => listener());
  await AsyncStorage.setItem(HAS_SEEN_LANDING_KEY, 'true');
}
