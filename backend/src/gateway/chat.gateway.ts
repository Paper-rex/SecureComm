import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { verifyToken } from '@clerk/backend';
import { MessagesService } from '../messages/messages.service';
import { ChatsService } from '../chats/chats.service';
import { GroupsService } from '../groups/groups.service';
import { UsersService } from '../users/users.service';

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

@WebSocketGateway({
  cors: {
    origin: [
      'https://securecomm.vercel.app',
      'http://localhost:3000',
    ],
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  // Map: clerkId → socketId
  private userSockets = new Map<string, string>();
  // Intrusion detection: track message flood
  private messageTimestamps = new Map<string, number[]>();

  constructor(
    private messagesService: MessagesService,
    private chatsService: ChatsService,
    private groupsService: GroupsService,
    private usersService: UsersService,
  ) { }

  // ─── Connection Lifecycle ─────────────────────────────

  async handleConnection(socket: Socket) {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) {
        socket.disconnect();
        return;
      }

      const decoded = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
      });
      const clerkId = decoded.sub;

      socket.data.clerkId = clerkId;
      this.userSockets.set(clerkId, socket.id);

      // Update user status
      await this.usersService.updateStatus(clerkId, 'online');

      // Broadcast online status
      this.server.emit('user:online', { userId: clerkId, status: 'online' });

      this.logger.log(`User connected: ${clerkId}`);
    } catch (error: any) {
      this.logger.warn(`Authentication failed for socket: ${error.message}`);
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: Socket) {
    const clerkId = socket.data.clerkId;
    if (clerkId) {
      this.userSockets.delete(clerkId);
      await this.usersService.updateStatus(clerkId, 'offline');
      this.server.emit('user:online', { userId: clerkId, status: 'offline' });
      this.logger.log(`User disconnected: ${clerkId}`);
    }
  }

  // ─── Message Handling ─────────────────────────────────

  @SubscribeMessage('message:send')
  async handleMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    data: {
      chatId?: string;
      groupId?: string;
      encryptedContent: string;
      iv: string;
      encryptedKeys: Record<string, string>;
      type?: string;
      fileMetadata?: {
        name: string;
        size: number;
        mimeType: string;
        storageKey: string;
        fileUrl?: string;
        encryptionIv?: string;
        encryptionKey?: string;
      };
    },
  ) {
    const clerkId = socket.data.clerkId;
    if (!clerkId) return;

    // ─── Intrusion Detection: Message Flood ─────────────
    if (this.isFlooding(clerkId)) {
      socket.emit('error', {
        message: 'Rate limit exceeded. Please slow down.',
      });
      this.logger.warn(`Message flooding detected from user: ${clerkId}`);
      return;
    }

    const user = await this.usersService.findByClerkId(clerkId);
    if (!user) return;

    // Store encrypted message
    const message = await this.messagesService.createMessage({
      chatId: data.chatId,
      groupId: data.groupId,
      senderId: user._id.toString(),
      encryptedContent: data.encryptedContent,
      iv: data.iv,
      encryptedKeys: data.encryptedKeys,
      type: data.type || 'text',
      fileMetadata: data.fileMetadata,
    });

    // Populate sender info
    const populated = await message.populate(
      'sender',
      'email displayName profilePicture',
    );

    if (data.chatId) {
      // DM: emit to both participants
      this.server.to(`chat:${data.chatId}`).emit('message:receive', populated);
      await this.chatsService.updateLastMessage(
        data.chatId,
        '[Encrypted]',
        user._id.toString(),
      );
    } else if (data.groupId) {
      // Group: emit to group room
      this.server.to(`group:${data.groupId}`).emit('message:receive', populated);
      await this.groupsService.updateLastMessage(
        data.groupId,
        '[Encrypted]',
        user.displayName,
      );
    }
  }

  // ─── Message Status ───────────────────────────────────

  @SubscribeMessage('message:status')
  async handleMessageStatus(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { messageId: string; status: 'delivered' | 'read' },
  ) {
    await this.messagesService.updateMessageStatus(data.messageId, data.status);
    // Broadcast status update
    socket.broadcast.emit('message:status', data);
  }

  // ─── Reactions ────────────────────────────────────────

  @SubscribeMessage('reaction:add')
  async handleReaction(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { messageId: string; emoji: string },
  ) {
    const clerkId = socket.data.clerkId;
    const user = await this.usersService.findByClerkId(clerkId);
    if (!user) return;

    await this.messagesService.addReaction(
      data.messageId,
      user._id.toString(),
      data.emoji,
    );

    // Broadcast reaction
    socket.broadcast.emit('reaction:update', {
      messageId: data.messageId,
      userId: user._id.toString(),
      emoji: data.emoji,
    });
  }

  // ─── Typing Indicators ───────────────────────────────

  @SubscribeMessage('typing:start')
  handleTypingStart(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    socket.broadcast
      .to(`chat:${data.chatId}`)
      .emit('typing:start', { userId: socket.data.clerkId });
  }

  @SubscribeMessage('typing:stop')
  handleTypingStop(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    socket.broadcast
      .to(`chat:${data.chatId}`)
      .emit('typing:stop', { userId: socket.data.clerkId });
  }

  // ─── Room Management ─────────────────────────────────

  @SubscribeMessage('join:chat')
  handleJoinChat(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { chatId: string },
  ) {
    socket.join(`chat:${data.chatId}`);
  }

  @SubscribeMessage('join:group')
  handleJoinGroup(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { groupId: string },
  ) {
    socket.join(`group:${data.groupId}`);
  }

  // ─── Real-Time Profile & Group Updates ────────────────

  @SubscribeMessage('user:update')
  handleUserUpdate(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { userId: string; displayName?: string; profilePicture?: string },
  ) {
    // Broadcast to all clients so sidebars can refresh
    this.server.emit('user:updated', {
      userId: data.userId,
      displayName: data.displayName,
      profilePicture: data.profilePicture,
    });
  }

  @SubscribeMessage('group:update')
  handleGroupUpdate(
    @ConnectedSocket() socket: Socket,
    @MessageBody() data: { groupId: string; name?: string; icon?: string; description?: string },
  ) {
    // Broadcast to all clients (group members will filter)
    this.server.emit('group:updated', {
      groupId: data.groupId,
      name: data.name,
      icon: data.icon,
      description: data.description,
    });
  }

  // ─── Intrusion Detection ─────────────────────────────

  private isFlooding(clerkId: string): boolean {
    const now = Date.now();
    const timestamps = this.messageTimestamps.get(clerkId) || [];

    // Keep only timestamps from the last 10 seconds
    const recent = timestamps.filter((t) => now - t < 10000);
    recent.push(now);
    this.messageTimestamps.set(clerkId, recent);

    // More than 20 messages in 10 seconds = flooding
    return recent.length > 20;
  }

  // ─── Public API for REST Controllers ──────────────────

  /**
   * Emit a new message event to a chat or group room.
   * Called by REST controllers after saving a message via HTTP.
   */
  emitNewMessage(roomType: 'chat' | 'group', roomId: string, populatedMessage: any): void {
    this.server.to(`${roomType}:${roomId}`).emit('message:receive', populatedMessage);
    // Also broadcast globally so sidebar can update for users not in the room
    this.server.emit('sidebar:new-message', {
      chatId: roomType === 'chat' ? roomId : undefined,
      groupId: roomType === 'group' ? roomId : undefined,
    });
  }

  /**
   * Emit a chat deleted event.
   * Only sent to the specific user who deleted/hid the chat.
   */
  emitChatDeleted(chatId: string, userId: string): void {
    // Find the socket of the user who deleted
    for (const [clerkId, socketId] of this.userSockets.entries()) {
      // We broadcast to all clients — the frontend filters by userId
      this.server.to(socketId).emit('chat:deleted', { chatId, userId });
    }
    // Also broadcast globally for sidebar updates
    this.server.emit('chat:deleted', { chatId, userId });
  }

  /**
   * Emit a message deleted event to the room.
   * All participants in the room remove this message.
   */
  emitMessageDeleted(roomType: 'chat' | 'group', roomId: string, messageId: string): void {
    this.server.to(`${roomType}:${roomId}`).emit('message:deleted', { messageId, roomType, roomId });
  }

  /**
   * Emit updated reactions for a message to all room members.
   */
  emitReactionUpdate(
    roomType: 'chat' | 'group',
    roomId: string,
    messageId: string,
    reactions: any[],
  ): void {
    this.server.to(`${roomType}:${roomId}`).emit('reaction:update', {
      messageId,
      reactions,
    });
  }

  /**
   * Emit a group deleted event to all clients.
   * Used when the creator permanently deletes a group.
   */
  emitGroupDeleted(groupId: string): void {
    this.server.emit('group:deleted', { groupId });
  }
}
