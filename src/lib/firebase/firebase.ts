import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import firebaseConfig from '../../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const GOOGLE_OAUTH_CLIENT_ID =
  (firebaseConfig as { oAuthClientId?: string }).oAuthClientId ?? '';
export const GOOGLE_CLOUD_PROJECT_NUMBER =
  (firebaseConfig as { messagingSenderId?: string }).messagingSenderId ??
  '1022597897742';
const firestoreDatabaseId =
  (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId ??
  'ai-studio-meridian-10b985b7-0ac9-4a45-b817-2fa175efaad4';

function createPersistentFirestore(): Firestore {
  const isBrowser = typeof window !== 'undefined';
  const transportSettings = isBrowser
    ? { experimentalForceLongPolling: true }
    : {};

  try {
    return initializeFirestore(
      app,
      {
        ...transportSettings,
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      firestoreDatabaseId
    );
  } catch {
    try {
      return initializeFirestore(app, transportSettings, firestoreDatabaseId);
    } catch {
      return getFirestore(app, firestoreDatabaseId);
    }
  }
}

export const db = createPersistentFirestore();
export const auth = getAuth(app);

let connectionTested = false;

export async function testFirestoreConnection(): Promise<void> {
  if (connectionTested) return;
  connectionTested = true;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
