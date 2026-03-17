# SecureComm — Security Model

## Defense Layers

### Layer 1: Transport Security
- **HTTPS enforcement** via HSTS headers
- **TLS encryption** for all client-server communication
- **WSS (WebSocket Secure)** for real-time messaging

### Layer 2: Authentication
- **Clerk Authentication** — managed auth service
- Email verification required
- Optional Two-Factor Authentication (2FA)
- JWT tokens for API authorization
- Tokens verified on every REST request and WebSocket connection

### Layer 3: Authorization
- **Role-Based Access Control (RBAC)** for groups
- Three-tier hierarchy: Creator > Admin > Member
- Permission checks on every group action
- Creator cannot be removed by any admin
- Auto-transfer of ownership when creator leaves

### Layer 4: End-to-End Encryption
- **AES-256-GCM** for message/file encryption
- **RSA-OAEP-4096** for key exchange
- Per-message random symmetric keys
- Private keys stored client-side (IndexedDB)
- Server is zero-knowledge — cannot read any messages

### Layer 5: Input Validation & Sanitization
- **NestJS ValidationPipe** — whitelist mode strips unknown properties
- **class-validator** decorators on all DTOs
- Regex-escaped email search (prevents injection)
- Double-extension file blocking (e.g., `file.pdf.exe`)

### Layer 6: HTTP Security Headers
- **Helmet middleware** providing:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Strict-Transport-Security`
  - `Content-Security-Policy`
  - `Referrer-Policy`

### Layer 7: Rate Limiting
- **Global**: 100 requests per 60 seconds per IP (NestJS ThrottlerGuard)
- **WebSocket**: 20 messages per 10 seconds per user (custom flood detection)
- Prevents brute-force attacks and DDoS

### Layer 8: CORS Policy
- Whitelisted origins only (frontend URL)
- Credentials required
- Restricted HTTP methods

### Layer 9: File Security
- **Type validation** — only allowed MIME types (images, PDF, docs, ZIP)
- **Size limits** — 25MB maximum
- **Double-extension blocking** — detects suspicious patterns
- **ClamAV integration** — malware scanning before storage
- **Client-side encryption** — files encrypted before upload

### Layer 10: Intrusion Detection
- **Message flooding** — detected and blocked (20 msgs/10 seconds)
- **Failed login tracking** — via Clerk's built-in brute-force protection
- **Logging** — all suspicious activities logged server-side

### Layer 11: Data Protection
- **MongoDB** — encrypted at rest (configurable)
- **Cloudinary** — encrypted file storage
- **No plaintext storage** — all messages stored as ciphertext
- **Minimal data exposure** — API returns only necessary fields

## Attack Mitigation

| Attack | Mitigation |
|--------|-----------|
| Man-in-the-Middle | TLS/HTTPS, E2E encryption |
| XSS | Helmet headers, input sanitization, CSP |
| CSRF | SameSite cookies, CORS policy |
| SQL Injection | N/A (MongoDB), but regex-escaped queries |
| Brute Force | Rate limiting, Clerk lockout |
| DDoS | ThrottlerGuard, WebSocket flood detection |
| Malware Upload | ClamAV scan, file type/size validation |
| Privilege Escalation | RBAC enforcement on every operation |
| Data Breach | E2E encryption — leaked DB is useless without private keys |
