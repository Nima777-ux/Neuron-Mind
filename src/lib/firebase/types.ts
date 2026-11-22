export type AuthStatus = 'unconfigured' | 'loading' | 'unauthenticated' | 'authenticated';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  firebaseConfigured: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const FIRESTORE_COLLECTIONS = {
  users: 'users',
  conversations: 'conversations',
  messages: 'messages',
  tasks: 'tasks',
  memories: 'memories',
  automations: 'automations',
} as const;
