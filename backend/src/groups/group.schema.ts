import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type GroupDocument = Group & Document;

@Schema({ timestamps: true })
export class Group {
  @Prop({ required: true })
  name: string;

  @Prop()
  description: string;

  @Prop()
  icon: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  creator: Types.ObjectId;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  admins: Types.ObjectId[];

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  members: Types.ObjectId[];

  @Prop({ type: { text: String, timestamp: Date, senderName: String } })
  lastMessage: {
    text: string;
    timestamp: Date;
    senderName: string;
  };

  @Prop({ type: [{ type: Types.ObjectId, ref: 'User' }], default: [] })
  hiddenBy: Types.ObjectId[];
}

export const GroupSchema = SchemaFactory.createForClass(Group);
