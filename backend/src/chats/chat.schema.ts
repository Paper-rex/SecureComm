import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ChatDocument = Chat & Document;

@Schema({ timestamps: true })
export class Chat {
  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], required: true })
  participants: Types.ObjectId[];

  @Prop({ type: { text: String, timestamp: Date, senderId: String } })
  lastMessage: {
    text: string;
    timestamp: Date;
    senderId: string;
  };

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  deletedBy: Types.ObjectId[];
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
