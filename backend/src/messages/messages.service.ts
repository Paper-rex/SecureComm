import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Message, MessageDocument } from './message.schema';

const PAGE_SIZE = 50;

@Injectable()
export class MessagesService {
  constructor(
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  async createMessage(data: {
    chatId?: string;
    groupId?: string;
    senderId: string;
    encryptedContent: string;
    iv: string;
    encryptedKeys: Record<string, string>;
    type: string;
    fileMetadata?: {
      name: string;
      size: number;
      mimeType: string;
      storageKey: string;
      fileUrl?: string;
      encryptionIv?: string;
      encryptionKey?: string;
    };
  }): Promise<MessageDocument> {
    return this.messageModel.create({
      chatId: data.chatId ? new Types.ObjectId(data.chatId) : undefined,
      groupId: data.groupId ? new Types.ObjectId(data.groupId) : undefined,
      sender: new Types.ObjectId(data.senderId),
      encryptedContent: data.encryptedContent,
      iv: data.iv,
      encryptedKeys: data.encryptedKeys,
      type: data.type || 'text',
      fileMetadata: data.fileMetadata,
    });
  }

  async getChatMessages(
    chatId: string,
    page: number,
    userId?: string,
  ): Promise<MessageDocument[]> {
    const filter: any = { chatId: new Types.ObjectId(chatId) };
    if (userId) {
      filter.deletedFor = { $nin: [new Types.ObjectId(userId)] };
    }
    return this.messageModel
      .find(filter)
      .populate('sender', 'email displayName profilePicture')
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .exec();
  }

  async getMessageById(messageId: string): Promise<MessageDocument | null> {
    return this.messageModel
      .findById(messageId)
      .populate('sender', 'email displayName profilePicture')
      .exec();
  }

  async getGroupMessages(
    groupId: string,
    page: number,
    userId?: string,
  ): Promise<MessageDocument[]> {
    const filter: any = { groupId: new Types.ObjectId(groupId) };
    if (userId) {
      filter.deletedFor = { $nin: [new Types.ObjectId(userId)] };
    }
    return this.messageModel
      .find(filter)
      .populate('sender', 'email displayName profilePicture')
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .exec();
  }

  async updateMessageStatus(
    messageId: string,
    status: 'delivered' | 'read',
  ): Promise<void> {
    await this.messageModel.updateOne(
      { _id: messageId },
      { status },
    );
  }

  // ─── Reactions ────────────────────────────────────────

  async addReaction(
    messageId: string,
    userId: string,
    emoji: string,
  ): Promise<MessageDocument | null> {
    const uid = new Types.ObjectId(userId);

    // Remove existing reaction from same user, then add new
    await this.messageModel.updateOne(
      { _id: messageId },
      { $pull: { reactions: { userId: uid } } },
    );
    await this.messageModel.updateOne(
      { _id: messageId },
      { $push: { reactions: { userId: uid, emoji } } },
    );
    return this.getMessageById(messageId);
  }

  async removeReaction(
    messageId: string,
    userId: string,
  ): Promise<MessageDocument | null> {
    const uid = new Types.ObjectId(userId);
    await this.messageModel.updateOne(
      { _id: messageId },
      { $pull: { reactions: { userId: uid } } },
    );
    return this.getMessageById(messageId);
  }

  // ─── Delete Messages ─────────────────────────────────

  async deleteForMe(
    messageId: string,
    userId: string,
  ): Promise<void> {
    const uid = new Types.ObjectId(userId);
    await this.messageModel.updateOne(
      { _id: messageId },
      { $addToSet: { deletedFor: uid } },
    );
  }

  async deleteForEveryone(
    messageId: string,
    senderId: string,
  ): Promise<void> {
    const message = await this.messageModel.findById(messageId);
    if (!message) return;

    // Only the sender can delete for everyone
    if (message.sender.toString() !== senderId) {
      throw new ForbiddenException('Only the sender can delete for everyone');
    }

    await this.messageModel.deleteOne({ _id: messageId });
  }

  // ─── Bulk Delete ──────────────────────────────────────

  async deleteAllGroupMessages(groupId: string): Promise<void> {
    await this.messageModel.deleteMany({ groupId: new Types.ObjectId(groupId) });
  }
}
