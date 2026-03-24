import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: true })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Chat' })
  chatId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Group' })
  groupId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: Types.ObjectId;

  @Prop({ required: true })
  encryptedContent: string;

  @Prop({ required: true })
  iv: string;

  @Prop({ type: Map, of: String, default: {} })
  encryptedKeys: Map<string, string>;

  @Prop({ default: 'text', enum: ['text', 'file'] })
  type: string;

  @Prop({
    type: {
      name: String,
      size: Number,
      mimeType: String,
      storageKey: String,
      fileUrl: String,
      encryptionIv: String,
      encryptionKey: String,
    },
  })
  fileMetadata: {
    name: string;
    size: number;
    mimeType: string;
    storageKey: string;
    fileUrl?: string;
    encryptionIv?: string;
    encryptionKey?: string;
  };

  @Prop({
    type: [{ userId: { type: Types.ObjectId, ref: 'User' }, emoji: String }],
    default: [],
  })
  reactions: { userId: Types.ObjectId; emoji: string }[];

  @Prop({ default: 'sent', enum: ['sent', 'delivered', 'read'] })
  status: string;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
