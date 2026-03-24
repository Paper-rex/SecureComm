import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './user.schema';
import { Invitation, InvitationDocument } from './invitation.schema';
import { Chat, ChatDocument } from '../chats/chat.schema';
import { Group, GroupDocument } from '../groups/group.schema';
import { Message, MessageDocument } from '../messages/message.schema';
import { v4 as uuidv4 } from 'uuid';
import * as nodemailer from 'nodemailer';

@Injectable()
export class UsersService {
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Invitation.name) private invitationModel: Model<InvitationDocument>,
    @InjectModel(Chat.name) private chatModel: Model<ChatDocument>,
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async syncUser(data: {
    clerkId: string;
    email: string;
    displayName: string;
    profilePicture?: string;
    publicKey: string;
  }): Promise<UserDocument> {
    const existing = await this.userModel.findOne({ clerkId: data.clerkId });
    if (existing) {
      existing.publicKey = data.publicKey;
      existing.displayName = data.displayName;
      existing.status = 'online';
      if (data.profilePicture) existing.profilePicture = data.profilePicture;
      return existing.save();
    }

    const user = new this.userModel({ ...data, status: 'online' });
    await user.save();

    // Check for pending invitations and mark as accepted
    await this.invitationModel.updateMany(
      { inviteeEmail: data.email, status: 'pending' },
      { status: 'accepted' },
    );

    return user;
  }

  async searchByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({
      email: { $regex: new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
    });
  }

  async getPublicKey(userId: string): Promise<string> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return user.publicKey;
  }

  async inviteUser(inviterEmail: string, inviteeEmail: string): Promise<void> {
    const token = uuidv4();

    await this.invitationModel.create({
      inviterEmail,
      inviteeEmail,
      token,
    });

    // Send invitation email
    const signUpUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/sign-up?invite=${token}`;

    try {
      await this.transporter.sendMail({
        from: `"SecureComm" <${process.env.SMTP_USER}>`,
        to: inviteeEmail,
        subject: 'You\'ve been invited to SecureComm',
        html: `
          <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; width: 48px; height: 48px; background: #6366f1; border-radius: 12px; line-height: 48px; text-align: center;">
                <span style="color: white; font-size: 20px;">🛡️</span>
              </div>
              <h1 style="font-size: 24px; margin: 12px 0 4px;">SecureComm</h1>
              <p style="color: #888; font-size: 14px;">Encrypted Communication Platform</p>
            </div>
            <p style="font-size: 15px; color: #333;">
              <strong>${inviterEmail}</strong> invited you to chat securely on SecureComm.
            </p>
            <p style="font-size: 14px; color: #666; margin: 16px 0;">
              All messages and files are end-to-end encrypted using AES-256-GCM + RSA-4096.
            </p>
            <a href="${signUpUrl}" style="display: inline-block; background: #6366f1; color: white; padding: 12px 32px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 14px;">
              Join SecureComm
            </a>
          </div>
        `,
      });
    } catch (error) {
      console.error('Failed to send invitation email:', error);
      // Don't fail the request if email fails — invitation is still created
    }
  }

  async updateStatus(clerkId: string, status: 'online' | 'offline'): Promise<void> {
    await this.userModel.updateOne({ clerkId }, { status });
  }

  async findByClerkId(clerkId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ clerkId });
  }

  /**
   * Delete a user and clean up all associated data:
   * - Remove user from groups (transfer creator if needed)
   * - Delete DM chats and their messages
   * - Delete user's messages from groups
   * - Delete invitations
   * - Delete user document
   */
  async deleteUser(clerkId: string): Promise<void> {
    const user = await this.userModel.findOne({ clerkId });
    if (!user) throw new NotFoundException('User not found');

    const uid = user._id as Types.ObjectId;

    // 1) Remove user from all groups (transfer creator if needed)
    const groups = await this.groupModel.find({ members: uid });
    for (const group of groups) {
      if (group.creator.equals(uid)) {
        // Transfer creator to first admin or first member
        const otherAdmins = group.admins.filter((a) => !a.equals(uid));
        if (otherAdmins.length > 0) {
          group.creator = otherAdmins[0];
        } else {
          const otherMembers = group.members.filter((m) => !m.equals(uid));
          if (otherMembers.length > 0) {
            group.creator = otherMembers[0];
            group.admins.push(otherMembers[0]);
          }
        }
      }
      group.members = group.members.filter((m) => !m.equals(uid));
      group.admins = group.admins.filter((a) => !a.equals(uid));

      if (group.members.length === 0) {
        await this.groupModel.deleteOne({ _id: group._id });
        await this.messageModel.deleteMany({ groupId: group._id });
      } else {
        await group.save();
      }
    }

    // 2) Delete DM chats and their messages
    const chats = await this.chatModel.find({ participants: uid });
    for (const chat of chats) {
      await this.messageModel.deleteMany({ chatId: chat._id });
      await this.chatModel.deleteOne({ _id: chat._id });
    }

    // 3) Clean up invitations
    await this.invitationModel.deleteMany({
      $or: [{ inviterEmail: user.email }, { inviteeEmail: user.email }],
    });

    // 4) Delete the user document
    await this.userModel.deleteOne({ _id: uid });
  }
}
