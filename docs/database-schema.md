# SecureComm — Database Schema

## Collections

### Users
```javascript
{
  clerkId:        String  // Unique, indexed — Clerk authentication ID
  email:          String  // Unique, indexed — user email
  displayName:    String  // User's display name
  profilePicture: String  // Optional — URL to profile image
  publicKey:      String  // RSA-4096 public key (Base64 SPKI format)
  status:         String  // Enum: 'online' | 'offline'
  createdAt:      Date
  updatedAt:      Date
}
```

### Chats (1:1 Conversations)
```javascript
{
  participants:   [ObjectId]  // Array of 2 User references
  lastMessage: {
    text:         String     // Preview text (encrypted label)
    timestamp:    Date
    senderId:     String
  }
  createdAt:      Date
  updatedAt:      Date
}
```

### Groups
```javascript
{
  name:           String     // Group name
  description:    String     // Optional description
  icon:           String     // Optional icon/emoji
  creator:        ObjectId   // User ref — immutable super admin
  admins:         [ObjectId] // User refs — includes creator
  members:        [ObjectId] // User refs — includes admins + creator
  lastMessage: {
    text:         String
    timestamp:    Date
    senderName:   String
  }
  createdAt:      Date
  updatedAt:      Date
}
```

### Messages
```javascript
{
  chatId:          ObjectId      // Ref to Chat (for DMs)
  groupId:         ObjectId      // Ref to Group (for groups)
  sender:          ObjectId      // Ref to User
  encryptedContent: String      // AES-256-GCM ciphertext (Base64)
  iv:              String        // Initialization vector (Base64)
  encryptedKeys:   Map<String>  // userId → RSA-encrypted AES key
  type:            String        // Enum: 'text' | 'file'
  fileMetadata: {
    name:          String
    size:          Number
    mimeType:      String
    storageKey:    String       // MinIO object key
  }
  reactions:       [{
    userId:        ObjectId
    emoji:         String
  }]
  status:          String        // Enum: 'sent' | 'delivered' | 'read'
  createdAt:       Date
  updatedAt:       Date
}
```

### Invitations
```javascript
{
  inviterEmail:   String   // Email of the user who sent the invite
  inviteeEmail:   String   // Email of the invited user
  status:         String   // Enum: 'pending' | 'accepted'
  token:          String   // Unique invitation token for sign-up URL
  createdAt:      Date
  updatedAt:      Date
}
```

## Indexes
- `users.clerkId` — unique
- `users.email` — unique
- `invitations.token` — unique
- `messages.chatId` + `createdAt` — compound (query performance)
- `messages.groupId` + `createdAt` — compound (query performance)
