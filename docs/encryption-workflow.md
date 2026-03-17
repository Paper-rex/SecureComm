# SecureComm — Encryption Workflow

## Overview

SecureComm implements **end-to-end encryption (E2E)** using the Web Crypto API. The server never has access to plaintext messages or private keys.

## Algorithms

| Purpose | Algorithm | Key Size |
|---------|-----------|----------|
| Message/File Encryption | AES-256-GCM | 256-bit |
| Key Exchange | RSA-OAEP | 4096-bit |
| Hash Function | SHA-256 | — |

## Key Lifecycle

### 1. Key Generation (On Sign-Up)
```
User registers → Browser generates RSA-4096 keypair
  ├── Public key → Sent to server, stored in Users collection
  └── Private key → Stored in browser IndexedDB (never leaves device)
```

### 2. Sending a Message
```
Sender writes message
  ├── Generate random AES-256-GCM key (one-time per message)
  ├── Generate random 12-byte IV
  ├── Encrypt message with AES key → ciphertext
  ├── For each recipient:
  │     └── Encrypt AES key with recipient's RSA public key → encryptedKey
  └── Send { ciphertext, iv, encryptedKeys } to server
```

### 3. Receiving a Message
```
Server relays encrypted message via WebSocket
  ├── Recipient locates their encryptedKey (by userId)
  ├── Decrypt AES key using own RSA private key (from IndexedDB)
  └── Decrypt ciphertext using AES key + IV → plaintext
```

### 4. File Encryption
```
User selects file
  ├── Generate random AES-256-GCM key
  ├── Encrypt entire file buffer with AES key
  ├── Upload encrypted binary to MinIO
  ├── Encrypt AES key per recipient (same as message)
  └── Store { storageKey, encryptedKeys, iv } in message
```

## Security Properties

| Property | Guarantee |
|----------|-----------|
| **Confidentiality** | AES-256-GCM — military-grade symmetric encryption |
| **Integrity** | GCM mode provides authenticated encryption (built-in AEAD) |
| **Forward Secrecy** | Per-message random AES keys — compromising one doesn't reveal others |
| **Zero Knowledge** | Server stores only ciphertext — cannot decrypt without private keys |
| **Key Isolation** | Private keys in IndexedDB — never transmitted over network |

## Group Encryption

For group messages, the sender encrypts the AES key separately for each group member using their individual RSA public keys. This ensures:
- Each member can independently decrypt
- Removing a member immediately revokes access to future messages
- The server cannot read group messages
