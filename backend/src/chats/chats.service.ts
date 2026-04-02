import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Chat, ChatDocument } from './chat.schema';

@Injectable()
export class ChatsService {
  constructor(@InjectModel(Chat.name) private chatModel: Model<ChatDocument>) {}

  async findOrCreate(userId: string, participantId: string): Promise<ChatDocument> {
    const uid = new Types.ObjectId(userId);
    const pid = new Types.ObjectId(participantId);

    // Check if chat already exists
    const existing = await this.chatModel.findOne({
      participants: { $all: [uid, pid] },
    });

    if (existing) {
      // If the chat was previously hidden by this user, unhide it
      if (existing.deletedBy?.some((id: any) => id.toString() === userId)) {
        await this.chatModel.updateOne(
          { _id: existing._id },
          { $pull: { deletedBy: uid } },
        );
      }
      return existing;
    }

    return this.chatModel.create({
      participants: [uid, pid],
    });
  }

  async getUserChats(userId: string): Promise<ChatDocument[]> {
    const uid = new Types.ObjectId(userId);
    return this.chatModel
      .find({
        participants: uid,
        deletedBy: { $nin: [uid] },
      })
      .populate('participants', 'email displayName profilePicture status')
      .sort({ 'lastMessage.timestamp': -1, createdAt: -1 })
      .exec();
  }

  async updateLastMessage(
    chatId: string,
    text: string,
    senderId: string,
  ): Promise<void> {
    await this.chatModel.updateOne(
      { _id: chatId },
      {
        lastMessage: { text, timestamp: new Date(), senderId },
        // Auto-unhide the chat for all participants when a new message arrives
        deletedBy: [],
      },
    );
  }

  async deleteChat(chatId: string, userId: string): Promise<void> {
    const uid = new Types.ObjectId(userId);
    await this.chatModel.updateOne(
      { _id: chatId, participants: uid },
      { $addToSet: { deletedBy: uid } },
    );
  }

  async unhideChat(chatId: string, userId: string): Promise<void> {
    const uid = new Types.ObjectId(userId);
    await this.chatModel.updateOne(
      { _id: chatId },
      { $pull: { deletedBy: uid } },
    );
  }
}
