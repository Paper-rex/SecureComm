import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, index: true })
  clerkId: string;

  @Prop({ required: true, unique: true, index: true })
  email: string;

  @Prop({ required: true })
  displayName: string;

  @Prop()
  profilePicture: string;

  @Prop({ required: true })
  publicKey: string;

  @Prop({ default: 'offline', enum: ['online', 'offline'] })
  status: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
