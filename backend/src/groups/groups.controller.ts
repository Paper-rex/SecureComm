import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { MessagesService } from '../messages/messages.service';
import { UsersService } from '../users/users.service';
import { AuthGuard } from '../auth/auth.guard';
import { ChatGateway } from '../gateway/chat.gateway';

@Controller('groups')
@UseGuards(AuthGuard)
export class GroupsController {
  constructor(
    private readonly groupsService: GroupsService,
    private readonly messagesService: MessagesService,
    private readonly usersService: UsersService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get()
  async listGroups(@Req() req: any) {
    const user = await this.usersService.findByClerkId(req.userId);
    if (!user) throw new NotFoundException('User not found');
    return this.groupsService.getUserGroups(user._id.toString());
  }

  @Post()
  async createGroup(
    @Req() req: any,
    @Body() body: { name: string; description?: string; memberEmails: string[] },
  ) {
    const user = await this.usersService.findByClerkId(req.userId);
    if (!user) throw new NotFoundException('User not found');

    // Resolve member emails to IDs
    const memberIds: string[] = [];
    for (const email of body.memberEmails || []) {
      const member = await this.usersService.searchByEmail(email);
      if (member) memberIds.push(member._id.toString());
    }

    return this.groupsService.create(user._id.toString(), {
      name: body.name,
      description: body.description,
      memberIds,
    });
  }

  @Patch(':id')
  async updateGroup(
    @Req() req: any,
    @Param('id') groupId: string,
    @Body() body: { name?: string; description?: string; icon?: string },
  ) {
    const user = await this.usersService.findByClerkId(req.userId);
    if (!user) throw new NotFoundException('User not found');
    return this.groupsService.updateGroup(
      groupId,
      user._id.toString(),
      body,
    );
  }

  @Post(':id/members')
  async addMember(
    @Req() req: any,
    @Param('id') groupId: string,
    @Body() body: { email: string },
  ) {
    const user = await this.usersService.findByClerkId(req.userId);
    if (!user) throw new NotFoundException('User not found');
    const member = await this.usersService.searchByEmail(body.email);
    if (!member) {
      // Invite the user
      await this.usersService.inviteUser(user.email, body.email);
      return { invited: true, message: `Invitation sent to ${body.email}` };
    }
    // Prevent adding yourself
    if (member._id.toString() === user._id.toString()) {
      return { error: true, message: 'You are already a member of this group' };
    }
    return this.groupsService.addMember(
      groupId,
      user._id.toString(),
      member._id.toString(),
    );
  }

  @Delete(':id/members/:userId')
  async removeMember(
    @Req() req: any,
    @Param('id') groupId: string,
    @Param('userId') targetId: string,
  ) {
    const user = await this.usersService.findByClerkId(req.userId);
    if (!user) throw new NotFoundException('User not found');
    return this.groupsService.removeMember(
      groupId,
      user._id.toString(),
      targetId,
    );
  }

  @Post(':id/leave')
  async leaveGroup(
    @Req() req: any,
    @Param('id') groupId: string,
  ) {
    const user = await this.usersService.findByClerkId(req.userId);
    if (!user) throw new NotFoundException('User not found');
    await this.groupsService.leaveGroup(groupId, user._id.toString());
    // Notify all clients so sidebars refresh
    this.chatGateway.server.emit('group:updated', { groupId });
    return { success: true };
  }

  @Patch(':id/admins')
  async manageAdmin(
    @Req() req: any,
    @Param('id') groupId: string,
    @Body() body: { userId: string; action: 'promote' | 'demote' },
  ) {
    const user = await this.usersService.findByClerkId(req.userId);
    if (!user) throw new NotFoundException('User not found');
    if (body.action === 'promote') {
      return this.groupsService.promoteAdmin(
        groupId,
        user._id.toString(),
        body.userId,
      );
    }
    return this.groupsService.demoteAdmin(
      groupId,
      user._id.toString(),
      body.userId,
    );
  }

  // ─── Hard Delete (creator only, remove group + messages) ─

  @Delete(':id/permanent')
  async hardDeleteGroup(@Param('id') groupId: string, @Req() req: any) {
    const user = await this.usersService.findByClerkId(req.userId);
    if (!user) throw new NotFoundException('User not found');

    // Delete all messages belonging to this group
    await this.messagesService.deleteAllGroupMessages(groupId);

    // Delete the group itself
    await this.groupsService.hardDeleteGroup(groupId, user._id.toString());

    // Notify all connected clients so sidebars update
    this.chatGateway.emitGroupDeleted(groupId);

    return { success: true };
  }

  // ─── Soft Delete (hide from sidebar for the user) ─────

  @Delete(':id')
  async softDeleteGroup(@Param('id') groupId: string, @Req() req: any) {
    const user = await this.usersService.findByClerkId(req.userId);
    if (!user) throw new NotFoundException('User not found');
    await this.groupsService.softDeleteGroup(groupId, user._id.toString());
    return { success: true };
  }

  @Get(':id/messages')
  async getMessages(
    @Param('id') groupId: string,
    @Query('page') page: string,
    @Req() req: any,
  ) {
    const user = await this.usersService.findByClerkId(req.userId);
    if (!user) throw new NotFoundException('User not found');
    return this.messagesService.getGroupMessages(
      groupId,
      parseInt(page || '1'),
      user._id.toString(),
    );
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id') groupId: string,
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
      groupId,
      senderId: user._id.toString(),
      encryptedContent: body.encryptedContent,
      iv: body.iv,
      encryptedKeys: body.encryptedKeys || {},
      type: body.type || 'text',
      fileMetadata: body.fileMetadata,
    });

    // Update last message + unhide group for all users who soft-deleted it
    await this.groupsService.updateLastMessage(
      groupId,
      '[Encrypted]',
      user.displayName,
    );

    const populated = await this.messagesService.getMessageById(message._id.toString());

    // Emit WebSocket event so other clients get real-time updates
    this.chatGateway.emitNewMessage('group', groupId, populated);

    return populated;
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
      const roomType = chatId ? 'chat' : 'group';
      const roomId = chatId || groupId;
      if (roomId) {
        this.chatGateway.emitMessageDeleted(roomType as 'chat' | 'group', roomId, messageId);
      }
    } else {
      await this.messagesService.deleteForMe(messageId, user._id.toString());
    }

    return { success: true };
  }
}
