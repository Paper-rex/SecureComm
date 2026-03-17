export interface User {
  _id: string;
  clerkId: string;
  email: string;
  displayName: string;
  profilePicture?: string;
  publicKey: string;
  status: "online" | "offline";
  createdAt: string;
}

export interface Chat {
  _id: string;
  participants: User[];
  lastMessage?: {
    text: string;
    timestamp: string;
    senderId: string;
  };
  createdAt: string;
  unreadCount?: number;
}

export interface Group {
  _id: string;
  name: string;
  description?: string;
  icon?: string;
  creator: User;
  admins: User[];
  members: User[];
  lastMessage?: {
    text: string;
    timestamp: string;
    senderName: string;
  };
  createdAt: string;
  unreadCount?: number;
}

export interface Message {
  _id: string;
  chatId?: string;
  groupId?: string;
  sender: User;
  content?: string; // decrypted content (client-only)
  encryptedContent: string;
  iv: string;
  encryptedKeys: Record<string, string>;
  type: "text" | "file";
  fileMetadata?: FileMetadata;
  reactions: Reaction[];
  status: "sent" | "delivered" | "read";
  createdAt: string;
}

export interface FileMetadata {
  name: string;
  size: number;
  mimeType: string;
  storageKey: string;
}

export interface Reaction {
  userId: string;
  emoji: string;
}

export interface Invitation {
  _id: string;
  inviterEmail: string;
  inviteeEmail: string;
  status: "pending" | "accepted";
  token: string;
  createdAt: string;
}

export type ConversationType = "chat" | "group";

export interface Conversation {
  id: string;
  type: ConversationType;
  name: string;
  avatar?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  unreadCount?: number;
  online?: boolean;
  participants?: User[];
}
