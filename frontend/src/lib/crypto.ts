/**
 * SecureComm — End-to-End Encryption Utilities
 *
 * Uses Web Crypto API for:
 * - RSA-OAEP 4096-bit key pairs (key exchange)
 * - AES-256-GCM (message/file encryption)
 *
 * The server NEVER has access to plaintext messages or private keys.
 */

// ─── RSA Key Pair Generation ─────────────────────────────────

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("spki", key);
  return bufferToBase64(exported);
}

export async function exportPrivateKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey("pkcs8", key);
  return bufferToBase64(exported);
}

export async function importPublicKey(pem: string): Promise<CryptoKey> {
  const binaryDer = base64ToBuffer(pem);
  return crypto.subtle.importKey(
    "spki",
    binaryDer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

export async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const binaryDer = base64ToBuffer(pem);
  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}

// ─── AES-256-GCM Encryption ─────────────────────────────────

export async function generateAESKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encryptMessage(
  plaintext: string,
  aesKey: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encoder.encode(plaintext)
  );
  return {
    ciphertext: bufferToBase64(encrypted),
    iv: bufferToBase64(iv.buffer),
  };
}

export async function decryptMessage(
  ciphertext: string,
  iv: string,
  aesKey: CryptoKey
): Promise<string> {
  const decoder = new TextDecoder();
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBuffer(iv) },
    aesKey,
    base64ToBuffer(ciphertext)
  );
  return decoder.decode(decrypted);
}

// ─── Hybrid Encryption (for per-message key exchange) ────────

export async function encryptAESKeyWithRSA(
  aesKey: CryptoKey,
  recipientPublicKey: CryptoKey
): Promise<string> {
  const rawKey = await crypto.subtle.exportKey("raw", aesKey);
  const encrypted = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    recipientPublicKey,
    rawKey
  );
  return bufferToBase64(encrypted);
}

export async function decryptAESKeyWithRSA(
  encryptedKey: string,
  privateKey: CryptoKey
): Promise<CryptoKey> {
  const decryptedRaw = await crypto.subtle.decrypt(
    { name: "RSA-OAEP" },
    privateKey,
    base64ToBuffer(encryptedKey)
  );
  return crypto.subtle.importKey(
    "raw",
    decryptedRaw,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

// ─── File Encryption ─────────────────────────────────────────

export async function encryptFile(
  file: File
): Promise<{ encryptedData: ArrayBuffer; iv: string; aesKey: CryptoKey }> {
  const aesKey = await generateAESKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const fileBuffer = await file.arrayBuffer();
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    fileBuffer
  );
  return {
    encryptedData: encrypted,
    iv: bufferToBase64(iv.buffer),
    aesKey,
  };
}

export async function decryptFile(
  encryptedData: ArrayBuffer,
  iv: string,
  aesKey: CryptoKey
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBuffer(iv) },
    aesKey,
    encryptedData
  );
}

// ─── Key Storage (IndexedDB) ────────────────────────────────

const DB_NAME = "securecomm-keys";
const STORE_NAME = "keypairs";

function openKeyDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function storePrivateKey(
  userId: string,
  privateKey: string
): Promise<void> {
  const db = await openKeyDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(privateKey, `private-${userId}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getStoredPrivateKey(
  userId: string
): Promise<string | null> {
  const db = await openKeyDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(`private-${userId}`);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

// ─── Utility Functions ───────────────────────────────────────

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
