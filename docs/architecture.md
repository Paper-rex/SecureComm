# SecureComm — System Architecture

## Overview

SecureComm is a secure communication platform built with a modern microservices-inspired architecture, emphasizing end-to-end encryption, real-time messaging, and cybersecurity best practices.

## Architecture Diagram

```
┌──────────────────────────────────────────────────┐
│                   CLIENT (Browser)                │
│                                                    │
│  Next.js 14 (App Router)                          │
│  ├── Clerk Auth (Email + 2FA)                     │
│  ├── Web Crypto API (E2E Encryption)              │
│  ├── Socket.io Client (Real-time)                 │
│  └── TailwindCSS + ShadCN UI + Framer Motion     │
│                                                    │
│  Private keys stored in IndexedDB (never leaves   │
│  the client device)                                │
└─────────────────┬──────────────┬──────────────────┘
                  │ HTTPS/REST   │ WSS/Socket.io
                  │              │
┌─────────────────▼──────────────▼──────────────────┐
│                BACKEND (NestJS)                    │
│                                                    │
│  Security Layer                                    │
│  ├── Helmet (Secure Headers)                       │
│  ├── CORS (Whitelisted Origins)                    │
│  ├── ThrottlerGuard (Rate Limiting)                │
│  └── ValidationPipe (Input Sanitization)           │
│                                                    │
│  Auth Layer                                        │
│  └── Clerk JWT Verification Guard                  │
│                                                    │
│  API Modules                                       │
│  ├── Users (Sync, Search, Invite, Public Keys)     │
│  ├── Chats (1:1 Conversations)                     │
│  ├── Groups (RBAC: Creator/Admin/Member)           │
│  ├── Messages (Encrypted Storage, Pagination)      │
│  ├── Files (MinIO Upload/Download, Validation)     │
│  └── Gateway (WebSocket: Messaging, Typing, Status)│
│                                                    │
│  Intrusion Detection                               │
│  ├── Message Flood Detection (20 msgs/10s)         │
│  └── Failed Login Tracking                         │
└─────────────────┬──────────────┬──────────────────┘
                  │              │
         ┌────────▼───┐   ┌─────▼──────┐
         │  MongoDB    │   │   MinIO    │
         │  (Data)     │   │  (Files)   │
         └─────────────┘   └────────────┘
```

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 14, TypeScript | App Router, SSR |
| UI | TailwindCSS, ShadCN UI | Component library |
| Animation | Framer Motion | Page transitions, micro-animations |
| Auth | Clerk | Email login, 2FA, JWT tokens |
| Backend | NestJS, TypeScript | REST API + WebSocket gateway |
| Database | MongoDB + Mongoose | Document storage |
| File Storage | MinIO (S3-compatible) | Encrypted file storage |
| Real-time | Socket.io | WebSocket messaging |
| Encryption | Web Crypto API | AES-256-GCM + RSA-OAEP |
| Security | Helmet, ThrottlerGuard | Headers, rate limiting |

## Data Flow

1. **Authentication**: User → Clerk → JWT Token → Backend Auth Guard
2. **Messaging**: Plaintext → Client AES-256-GCM Encrypt → Server Store → WebSocket Relay → Client Decrypt
3. **File Sharing**: File → Client AES-256-GCM Encrypt → Server Validate + Malware Scan → MinIO Store → Download → Client Decrypt
4. **Key Exchange**: Sender → Generate AES Key → Encrypt with Recipient's RSA Public Key → Store per-user encrypted keys
