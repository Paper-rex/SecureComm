import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type InvitationDocument = Invitation & Document;

@Schema({ timestamps: true })
export class Invitation {
  @Prop({ required: true })
  inviterEmail: string;

  @Prop({ required: true })
  inviteeEmail: string;

  @Prop({ default: 'pending', enum: ['pending', 'accepted'] })
  status: string;

  @Prop({ required: true, unique: true })
  token: string;
}

export const InvitationSchema = SchemaFactory.createForClass(Invitation);
