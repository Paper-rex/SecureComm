import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { ChatsService } from './chats.service';
import { MessagesService } from '../messages/messages.service';
import { UsersService } from '../users/users.service';
import { AuthGuard } from '../auth/auth.guard';
import { ChatGateway } from '../gateway/chat.gateway';

@Controller('chats')
@UseGuards(AuthGuard)
export class ChatsController {
  constructor(
    private readonly chatsService: ChatsService,
    private readonly messagesService: MessagesService,
    private readonly usersService: UsersService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get()
  async listChats(@Req() req: any) {
    const user = await this.usersService.findByClerkId(req.userId);
    if (!user) throw new NotFoundException('User not found');
    return this.chatsService.getUserChats(user._id.toString());
  }

  @Post()
  async createChat(@Req() req: any, @Body() body: { participantId: string }) {
    const user = await this.usersService.findByClerkId(req.userId);
    if (!user) throw new NotFoundException('User not found');
    return this.chatsService.findOrCreate(
      user._id.toString(),
      body.participantId,
    );
  }

  @Get(':id/messages')
  async getMessages(
    @Param('id') chatId: string,
    @Query('page') page: string,
    @Req() req: any,
  ) {
    const user = await this.usersService.findByClerkId(req.userId);
    if (!user) throw new NotFoundException('User not found');
    return this.messagesService.getChatMessages(
      chatId,
      parseInt(page || '1'),
      user._id.toString(),
    );
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id') chatId: string,
    @Req() req: any,
    @Body()
    body: {
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
    const user = await this.usersService.findByClerkId(req.userId);
    if (!user) throw new NotFoundException('User not found');

    const message = await this.messagesService.createMessage({
      chatId,
      senderId: user._id.toString(),
      encryptedContent: body.encryptedContent,
      iv: body.iv,
      encryptedKeys: body.encryptedKeys || {},
      type: body.type || 'text',
      fileMetadata: body.fileMetadata,
    });

    // Update last message on the chat
    await this.chatsService.updateLastMessage(
      chatId,
      body.encryptedContent.substring(0, 50),
      user._id.toString(),
    );

    // Re-fetch with populated sender
    const populated = await this.messagesService.getMessageById(message._id.toString());

    // Emit WebSocket event so other clients get real-time updates
    this.chatGateway.emitNewMessage('chat', chatId, populated);

    return populated;
  }

  // ─── Delete Chat (soft-hide for calling user) ────────

  @Delete(':id')
  async deleteChat(@Param('id') chatId: string, @Req() req: any) {
    const user = await this.usersService.findByClerkId(req.userId);
    if (!user) throw new NotFoundException('User not found');
    await this.chatsService.deleteChat(chatId, user._id.toString());
    this.chatGateway.emitChatDeleted(chatId, user._id.toString());
    return { success: true };
  }

  // ─── Reactions ────────────────────────────────────────

  @Post('messages/:messageId/reactions')
  async addReaction(
    @Param('messageId') messageId: string,
    @Req() req: any,
    @Body() body: { emoji: string },
  ) {
    const user = await this.usersService.findByClerkId(req.userId);
    if (!user) throw new NotFoundException('User not found');
    const updated = await this.messagesService.addReaction(
      messageId,
      user._id.toString(),
      body.emoji,
    );
    // Broadcast updated reactions in real-time
    if (updated) {
      const chatId = updated.chatId?.toString();
      const groupId = updated.groupId?.toString();
      if (chatId) {
        this.chatGateway.emitReactionUpdate('chat', chatId, messageId, updated.reactions);
      } else if (groupId) {
        this.chatGateway.emitReactionUpdate('group', groupId, messageId, updated.reactions);
      }
    }
    return { success: true };
  }

  @Delete('messages/:messageId/reactions')
  async removeReaction(
    @Param('messageId') messageId: string,
    @Req() req: any,
  ) {
    const user = await this.usersService.findByClerkId(req.userId);
    if (!user) throw new NotFoundException('User not found');
    const updated = await this.messagesService.removeReaction(
      messageId,
      user._id.toString(),
    );
    // Broadcast updated reactions in real-time
    if (updated) {
      const chatId = updated.chatId?.toString();
      const groupId = updated.groupId?.toString();
      if (chatId) {
        this.chatGateway.emitReactionUpdate('chat', chatId, messageId, updated.reactions);
      } else if (groupId) {
        this.chatGateway.emitReactionUpdate('group', groupId, messageId, updated.reactions);
      }
    }
    return { success: true };
  }

  // ─── Delete Message ───────────────────────────────────

  @Delete('messages/:messageId')
  async deleteMessage(
    @Param('messageId') messageId: string,
    @Query('mode') mode: string,
    @Req() req: any,
  ) {
    const user = await this.usersService.findByClerkId(req.userId);
    if (!user) throw new NotFoundException('User not found');

    const message = await this.messagesService.getMessageById(messageId);
    if (!message) throw new NotFoundException('Message not found');

    const chatId = message.chatId?.toString();
    const groupId = message.groupId?.toString();

    if (mode === 'forEveryone') {
      await this.messagesService.deleteForEveryone(messageId, user._id.toString());
      // Broadcast hard delete to room
      const roomType = chatId ? 'chat' : 'group';
      const roomId = chatId || groupId;
      if (roomId) {
        this.chatGateway.emitMessageDeleted(roomType as 'chat' | 'group', roomId, messageId);
      }
    } else {
      // Default: delete for me
      await this.messagesService.deleteForMe(messageId, user._id.toString());
    }

    return { success: true };
  }
}
