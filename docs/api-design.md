# SecureComm — API Design

## Base URL
```
http://localhost:3001/api
```

## Authentication
All endpoints require a Clerk JWT Bearer token:
```
Authorization: Bearer <clerk_jwt_token>
```

---

## REST Endpoints

### Users

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| `POST` | `/users/sync` | Sync Clerk user to database | `{ email, displayName, profilePicture?, publicKey }` |
| `GET` | `/users/search?email=` | Search user by email | — |
| `POST` | `/users/invite` | Send email invitation | `{ email }` |
| `GET` | `/users/:id/public-key` | Get user's RSA public key | — |

### Chats (1:1)

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| `GET` | `/chats` | List user's chats | — |
| `POST` | `/chats` | Create or get existing chat | `{ participantId }` |
| `GET` | `/chats/:id/messages?page=` | Get paginated messages (50/page) | — |

### Groups

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| `GET` | `/groups` | List user's groups | — |
| `POST` | `/groups` | Create group | `{ name, description?, memberEmails[] }` |
| `PATCH` | `/groups/:id` | Update group settings | `{ name?, description?, icon? }` |
| `POST` | `/groups/:id/members` | Add member (or invite if not registered) | `{ email }` |
| `DELETE` | `/groups/:id/members/:userId` | Remove member | — |
| `PATCH` | `/groups/:id/admins` | Promote/demote admin | `{ userId, action: 'promote'|'demote' }` |
| `GET` | `/groups/:id/messages?page=` | Get paginated group messages | — |

### Files

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| `POST` | `/files/upload` | Upload encrypted file (multipart) | `FormData { file }` |
| `GET` | `/files/:key` | Download encrypted file | — |

---

## WebSocket Events

### Connection
```javascript
const socket = io('http://localhost:3001', {
  auth: { token: clerkJwtToken }
});
```

### Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `message:send` | Client → Server | `{ chatId?, groupId?, encryptedContent, iv, encryptedKeys, type?, fileMetadata? }` |
| `message:receive` | Server → Client | Full populated message object |
| `message:status` | Bidirectional | `{ messageId, status: 'delivered'|'read' }` |
| `reaction:add` | Client → Server | `{ messageId, emoji }` |
| `reaction:update` | Server → Client | `{ messageId, userId, emoji }` |
| `typing:start` | Client → Server | `{ chatId }` |
| `typing:stop` | Client → Server | `{ chatId }` |
| `user:online` | Server → Client | `{ userId, status: 'online'|'offline' }` |
| `join:chat` | Client → Server | `{ chatId }` |
| `join:group` | Client → Server | `{ groupId }` |

---

## Response Formats

### User Search — Found
```json
{
  "found": true,
  "user": {
    "_id": "...",
    "email": "alice@example.com",
    "displayName": "Alice Johnson",
    "status": "online"
  }
}
```

### User Search — Not Found
```json
{ "found": false, "user": null }
```

### File Upload Response
```json
{
  "storageKey": "uuid-filename.pdf",
  "name": "filename.pdf",
  "size": 1024000,
  "mimeType": "application/pdf"
}
```

## Rate Limiting
- **Global**: 100 requests per 60 seconds per IP
- **WebSocket flooding**: 20 messages per 10 seconds per user
