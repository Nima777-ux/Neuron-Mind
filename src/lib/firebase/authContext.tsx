import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLanguage } from '../../i18n/languageContext';
import {
  trySilentGoogleTokenRefresh,
  verifyGoogleWorkspaceScopes,
} from '../../services/workspaceGoogleApi';
import { detectRuntimePlatform, secureStorage } from '../platform';
import { OperationType, handleFirestoreError } from './errorHandling';
import {
  GOOGLE_OAUTH_CLIENT_ID,
  auth,
  db,
  testFirestoreConnection,
} from './firebase';
import type { AuthStatus, AuthUser } from './types';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/calendar.events',
] as const;

const WORKSPACE_ACCOUNT_META_KEY = 'neuron_mind_workspace_account_v1';

interface RememberedWorkspaceAccount {
  connected: boolean;
  email: string;
  connectedAt: string;
}

function loadRememberedWorkspaceAccount(): RememberedWorkspaceAccount | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_ACCOUNT_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RememberedWorkspaceAccount>;
    if (!parsed.connected) return null;
    return {
      connected: true,
      email: typeof parsed.email === 'string' ? parsed.email : '',
      connectedAt:
        typeof parsed.connectedAt === 'string'
          ? parsed.connectedAt
          : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function saveRememberedWorkspaceAccount(
  meta: RememberedWorkspaceAccount | null
): void {
  if (typeof window === 'undefined') return;
  try {
    if (!meta) {
      window.localStorage.removeItem(WORKSPACE_ACCOUNT_META_KEY);
    } else {
      window.localStorage.setItem(
        WORKSPACE_ACCOUNT_META_KEY,
        JSON.stringify(meta)
      );
    }
  } catch {
    // ignore storage errors
  }
}

let inMemoryGoogleAccessToken: string | null = null;

export function getInMemoryGoogleAccessToken(): string | null {
  return inMemoryGoogleAccessToken;
}

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  googleAccessToken: string | null;
  isWorkspaceRemembered: boolean;
  workspaceAccountEmail: string | null;
  isRefreshingWorkspaceToken: boolean;
  missingWorkspaceScopes: string[];
  firebaseConfigured: boolean;
  authError: string | null;
  clearAuthError: () => void;
  clearGoogleAccessToken: () => void;
  disconnectGoogleWorkspace: () => void;
  refreshWorkspaceTokenSilently: () => Promise<string | null>;
  signInWithGoogle: () => Promise<void>;
  connectGoogleWorkspace: () => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapUser(firebaseUser: User): AuthUser {
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { language, autoDetectLanguage } = useLanguage();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(
    () => inMemoryGoogleAccessToken
  );
  const [rememberedWorkspace, setRememberedWorkspace] =
    useState<RememberedWorkspaceAccount | null>(() =>
      loadRememberedWorkspaceAccount()
    );
  const [isRefreshingWorkspaceToken, setIsRefreshingWorkspaceToken] =
    useState(false);
  const [missingWorkspaceScopes, setMissingWorkspaceScopes] = useState<
    string[]
  >([]);
  const [authError, setAuthError] = useState<string | null>(null);
  const silentRefreshAttemptedRef = useRef<string | null>(null);

  const updateInMemoryToken = useCallback((token: string | null) => {
    inMemoryGoogleAccessToken = token;
    setGoogleAccessToken(token);
  }, []);

  const persistWorkspaceRemembered = useCallback((email: string) => {
    const meta: RememberedWorkspaceAccount = {
      connected: true,
      email: email.trim(),
      connectedAt: new Date().toISOString(),
    };
    saveRememberedWorkspaceAccount(meta);
    setRememberedWorkspace(meta);
  }, []);

  const refreshWorkspaceTokenSilently = useCallback(
    async (hintEmail?: string | null): Promise<string | null> => {
      if (inMemoryGoogleAccessToken) return inMemoryGoogleAccessToken;
      if (!GOOGLE_OAUTH_CLIENT_ID) return null;
      setIsRefreshingWorkspaceToken(true);
      try {
        const token = await trySilentGoogleTokenRefresh({
          clientId: GOOGLE_OAUTH_CLIENT_ID,
          scopes: WORKSPACE_SCOPES,
          loginHint:
            hintEmail ||
            rememberedWorkspace?.email ||
            auth.currentUser?.email ||
            undefined,
        });
        if (!token) return null;
        const check = await verifyGoogleWorkspaceScopes(token, WORKSPACE_SCOPES);
        if (check.checked && check.missingScopes.length === WORKSPACE_SCOPES.length) {
          return null;
        }
        setMissingWorkspaceScopes(check.checked ? check.missingScopes : []);
        updateInMemoryToken(token);
        return token;
      } finally {
        setIsRefreshingWorkspaceToken(false);
      }
    },
    [rememberedWorkspace?.email, updateInMemoryToken]
  );

  useEffect(() => {
    void testFirestoreConnection();

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setStatus('unauthenticated');
        updateInMemoryToken(null);
        void secureStorage.clearAuthSessionMetadata();
        return;
      }

      setUser(mapUser(firebaseUser));
      setStatus('authenticated');
      void secureStorage.saveAuthSessionMetadata({
        uid: firebaseUser.uid,
        lastSignedInAt: new Date().toISOString(),
        platform: detectRuntimePlatform(),
      });

      const savedMeta = loadRememberedWorkspaceAccount();
      if (
        savedMeta?.connected &&
        !inMemoryGoogleAccessToken &&
        silentRefreshAttemptedRef.current !== firebaseUser.uid
      ) {
        silentRefreshAttemptedRef.current = firebaseUser.uid;
        void refreshWorkspaceTokenSilently(
          savedMeta.email || firebaseUser.email
        );
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        return;
      }

      const userPath = `users/${firebaseUser.uid}`;
      const privatePath = `users/${firebaseUser.uid}/private/profile`;

      try {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const existingSnap = await getDoc(userRef);

        if (!existingSnap.exists()) {
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            displayName: (firebaseUser.displayName || 'Neuron User').slice(0, 120),
            preferredLanguage: language,
            autoDetectLanguage,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(
            userRef,
            {
              uid: firebaseUser.uid,
              displayName: (firebaseUser.displayName || 'Neuron User').slice(0, 120),
              preferredLanguage: language,
              autoDetectLanguage,
              createdAt: existingSnap.data().createdAt ?? serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: false }
          );
        }

        if (firebaseUser.email) {
          const privateRef = doc(db, 'users', firebaseUser.uid, 'private', 'profile');
          await setDoc(privateRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email.slice(0, 320),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('permission')) {
          handleFirestoreError(error, OperationType.WRITE, `${userPath} / ${privatePath}`);
        }
      }
    });

    return () => unsubscribe();
  }, [
    language,
    autoDetectLanguage,
    updateInMemoryToken,
    refreshWorkspaceTokenSilently,
  ]);

  const formatAuthErrorMessage = useCallback(
    (error: unknown, fallbackEn: string): string => {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? String((error as { code?: unknown }).code ?? '')
          : '';
      const rawMsg = error instanceof Error ? error.message : fallbackEn;
      const host = typeof window !== 'undefined' ? window.location.hostname : '';

      if (code === 'auth/unauthorized-domain' || rawMsg.includes('auth/unauthorized-domain')) {
        if (host === '127.0.0.1') {
          return language === 'fa'
            ? 'ورود گوگل روی آدرس 127.0.0.1 توسط فایربیس مجاز نیست. لطفاً برنامه را با آدرس localhost یا نشانی اصلی برنامه آنلاین باز کنید.'
            : 'Firebase Auth does not authorize bare 127.0.0.1. Open the app using http://localhost or the hosted Neuron Mind URL (re-download the updated Windows kit if launching from desktop).';
        }
        return language === 'fa'
          ? `دامنه فعلی (${host || 'ناشناس'}) در فهرست دامنه‌های مجاز Firebase Auth ثبت نشده است. برای اتصال جیمیل و تقویم، برنامه را از نشانی اصلی باز کنید یا این دامنه را در تنظیمات Firebase Authentication اضافه کنید.`
          : `The current domain (${host || 'unknown'}) is not in Firebase Auth's Authorized Domains list. Open Neuron Mind from the live app URL or add "${host}" in Firebase Console → Authentication → Settings → Authorized domains.`;
      }

      if (code === 'auth/popup-blocked' || rawMsg.includes('auth/popup-blocked')) {
        return language === 'fa'
          ? 'پنجره ورود گوگل توسط مرورگر مسدود شد. لطفاً باز شدن پنجره‌های بازشو (Pop-ups) را مجاز کنید و دوباره تلاش کنید.'
          : 'Google sign-in popup was blocked by your browser. Allow popups for Neuron Mind and try again.';
      }

      if (code === 'auth/popup-closed-by-user' || rawMsg.includes('auth/popup-closed-by-user')) {
        return language === 'fa'
          ? 'پنجره تایید گوگل پیش از تکمیل بسته شد. هر زمان آماده بودید دوباره کلیک کنید.'
          : 'Google sign-in window was closed before completing authorization.';
      }

      return rawMsg;
    },
    [language]
  );

  const formatScopeLabels = useCallback(
    (scopes: string[]): string => {
      const labels: string[] = [];
      if (scopes.some((s) => s.includes('gmail.readonly'))) {
        labels.push(language === 'fa' ? 'خواندن جیمیل' : 'Read Gmail');
      }
      if (scopes.some((s) => s.includes('gmail.compose'))) {
        labels.push(language === 'fa' ? 'پیش‌نویس و ارسال جیمیل' : 'Draft & Send Gmail');
      }
      if (scopes.some((s) => s.includes('calendar.events'))) {
        labels.push(language === 'fa' ? 'رویدادهای تقویم گوگل' : 'Google Calendar Events');
      }
      return labels.join(language === 'fa' ? '، ' : ', ');
    },
    [language]
  );

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    for (const scope of WORKSPACE_SCOPES) {
      provider.addScope(scope);
    }
    provider.setCustomParameters({ include_granted_scopes: 'true' });
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken ?? null;
      if (!token) {
        updateInMemoryToken(null);
        setMissingWorkspaceScopes([]);
        return;
      }
      const check = await verifyGoogleWorkspaceScopes(token, WORKSPACE_SCOPES);
      if (check.checked && check.missingScopes.length === WORKSPACE_SCOPES.length) {
        updateInMemoryToken(null);
        setMissingWorkspaceScopes(check.missingScopes);
      } else {
        updateInMemoryToken(token);
        setMissingWorkspaceScopes(check.checked ? check.missingScopes : []);
        persistWorkspaceRemembered(result.user.email || '');
      }
    } catch (error) {
      setAuthError(formatAuthErrorMessage(error, 'Unable to sign in with Google.'));
      throw error;
    }
  }, [formatAuthErrorMessage, persistWorkspaceRemembered, updateInMemoryToken]);

  const connectGoogleWorkspace = useCallback(async (): Promise<string | null> => {
    setAuthError(null);
    const provider = new GoogleAuthProvider();
    for (const scope of WORKSPACE_SCOPES) {
      provider.addScope(scope);
    }
    provider.setCustomParameters({
      prompt: 'consent',
      include_granted_scopes: 'true',
      ...(auth.currentUser?.email ? { login_hint: auth.currentUser.email } : {}),
    });
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken ?? null;
      if (!token) {
        const msg =
          language === 'fa'
            ? 'توکن دسترسی گوگل دریافت نشد. لطفاً دوباره روی «اتصال جیمیل و تقویم گوگل» کلیک کرده و تمام تیک‌های مجوز را بزنید.'
            : 'Google did not return an access token. Please click Connect Gmail & Calendar again and approve all permission checkboxes.';
        setAuthError(msg);
        throw new Error(msg);
      }

      const check = await verifyGoogleWorkspaceScopes(token, WORKSPACE_SCOPES);
      if (check.checked && check.missingScopes.length === WORKSPACE_SCOPES.length) {
        updateInMemoryToken(null);
        setMissingWorkspaceScopes(check.missingScopes);
        const msg =
          language === 'fa'
            ? 'ورود انجام شد اما هیچ‌کدام از مجوزهای جیمیل و تقویم تیک نخوردند. لطفاً دوباره متصل شوید و در پنجره گوگل گزینه «انتخاب همه / Select all» را بزنید.'
            : 'Signed in, but Gmail & Calendar permission checkboxes were left unchecked. Reconnect and check ALL boxes ("Select all") on Google’s consent screen.';
        setAuthError(msg);
        throw new Error(msg);
      }

      if (check.checked && check.missingScopes.length > 0) {
        setMissingWorkspaceScopes(check.missingScopes);
        const missingLabel = formatScopeLabels(check.missingScopes);
        setAuthError(
          language === 'fa'
            ? `برخی مجوزها هنوز تایید نشده‌اند (${missingLabel}). برای عملکرد کامل، دوباره متصل شوید و تمام تیک‌ها را انتخاب کنید.`
            : `Partial access granted — missing: ${missingLabel}. Click Connect again and select all permission checkboxes for full Gmail & Calendar access.`
        );
      } else {
        setMissingWorkspaceScopes([]);
      }

      updateInMemoryToken(token);
      persistWorkspaceRemembered(result.user.email || auth.currentUser?.email || '');
      return token;
    } catch (error) {
      if (
        !(
          error instanceof Error &&
          (error.message.includes('Select all') ||
            error.message.includes('انتخاب همه') ||
            error.message.includes('access token') ||
            error.message.includes('توکن دسترسی'))
        )
      ) {
        setAuthError(
          formatAuthErrorMessage(error, 'Unable to connect Gmail and Google Calendar.')
        );
      }
      throw error;
    }
  }, [
    formatAuthErrorMessage,
    formatScopeLabels,
    language,
    persistWorkspaceRemembered,
    updateInMemoryToken,
  ]);

  const disconnectGoogleWorkspace = useCallback(() => {
    setMissingWorkspaceScopes([]);
    updateInMemoryToken(null);
    saveRememberedWorkspaceAccount(null);
    setRememberedWorkspace(null);
  }, [updateInMemoryToken]);

  const signOut = useCallback(async () => {
    setAuthError(null);
    setMissingWorkspaceScopes([]);
    updateInMemoryToken(null);
    saveRememberedWorkspaceAccount(null);
    setRememberedWorkspace(null);
    silentRefreshAttemptedRef.current = null;
    await firebaseSignOut(auth);
    await secureStorage.clearAuthSessionMetadata();
  }, [updateInMemoryToken]);

  const clearAuthError = useCallback(() => setAuthError(null), []);
  const clearGoogleAccessToken = useCallback(() => {
    setMissingWorkspaceScopes([]);
    updateInMemoryToken(null);
  }, [updateInMemoryToken]);

  const isWorkspaceRemembered = Boolean(
    googleAccessToken || rememberedWorkspace?.connected
  );
  const workspaceAccountEmail =
    rememberedWorkspace?.email || user?.email || null;

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      googleAccessToken,
      isWorkspaceRemembered,
      workspaceAccountEmail,
      isRefreshingWorkspaceToken,
      missingWorkspaceScopes,
      firebaseConfigured: true,
      authError,
      clearAuthError,
      clearGoogleAccessToken,
      disconnectGoogleWorkspace,
      refreshWorkspaceTokenSilently: () => refreshWorkspaceTokenSilently(),
      signInWithGoogle,
      connectGoogleWorkspace,
      signOut,
    }),
    [
      status,
      user,
      googleAccessToken,
      isWorkspaceRemembered,
      workspaceAccountEmail,
      isRefreshingWorkspaceToken,
      missingWorkspaceScopes,
      authError,
      clearAuthError,
      clearGoogleAccessToken,
      disconnectGoogleWorkspace,
      refreshWorkspaceTokenSilently,
      signInWithGoogle,
      connectGoogleWorkspace,
      signOut,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}
