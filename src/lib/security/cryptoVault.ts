export interface VaultSecretEntry {
  id: string;
  label: string;
  username: string;
  secret: string;
  url?: string;
  notes?: string;
  updatedAt: string;
}

interface EncryptedVaultEnvelope {
  version: 1;
  saltBase64: string;
  ivBase64: string;
  cipherBase64: string;
  updatedAt: string;
}

const VAULT_STORAGE_KEY = 'neuron_mind_encrypted_vault_v1';
const ITERATIONS = 250000;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer,
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function hasInitializedVault(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.localStorage.getItem(VAULT_STORAGE_KEY));
}

export async function saveEncryptedVault(
  passphrase: string,
  entries: VaultSecretEntry[]
): Promise<void> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('WebCrypto is unavailable in this environment.');
  }
  if (!passphrase || passphrase.length < 4) {
    throw new Error('Passphrase must be at least 4 characters.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(entries));
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  const envelope: EncryptedVaultEnvelope = {
    version: 1,
    saltBase64: toBase64(salt),
    ivBase64: toBase64(iv),
    cipherBase64: toBase64(new Uint8Array(cipherBuffer)),
    updatedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(VAULT_STORAGE_KEY, JSON.stringify(envelope));
}

export async function unlockEncryptedVault(
  passphrase: string
): Promise<VaultSecretEntry[]> {
  const raw = window.localStorage.getItem(VAULT_STORAGE_KEY);
  if (!raw) return [];

  const envelope = JSON.parse(raw) as EncryptedVaultEnvelope;
  const salt = fromBase64(envelope.saltBase64);
  const iv = fromBase64(envelope.ivBase64);
  const cipher = fromBase64(envelope.cipherBase64);

  const key = await deriveAesKey(passphrase, salt);
  const plainBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer,
    },
    key,
    cipher.buffer.slice(cipher.byteOffset, cipher.byteOffset + cipher.byteLength) as ArrayBuffer
  );

  const decoded = new TextDecoder().decode(plainBuffer);
  const parsed = JSON.parse(decoded);
  return Array.isArray(parsed) ? (parsed as VaultSecretEntry[]) : [];
}

export function clearEncryptedVault(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(VAULT_STORAGE_KEY);
  }
}
