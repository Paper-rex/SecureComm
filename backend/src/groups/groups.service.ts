import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Group, GroupDocument } from './group.schema';

@Injectable()
export class GroupsService {
  constructor(
    @InjectModel(Group.name) private groupModel: Model<GroupDocument>,
  ) {}

  async create(
    creatorId: string,
    data: { name: string; description?: string; memberIds: string[] },
  ): Promise<GroupDocument> {
    const cid = new Types.ObjectId(creatorId);
    const memberObjectIds = data.memberIds.map((id) => new Types.ObjectId(id));

    return this.groupModel.create({
      name: data.name,
      description: data.description || '',
      creator: cid,
      admins: [cid],
      members: [cid, ...memberObjectIds],
    });
  }

  async getUserGroups(userId: string): Promise<GroupDocument[]> {
    const uid = new Types.ObjectId(userId);
    return this.groupModel
      .find({ members: uid })
      .populate('creator', 'email displayName')
      .populate('members', 'email displayName profilePicture status')
      .populate('admins', 'email displayName')
      .sort({ 'lastMessage.timestamp': -1, createdAt: -1 })
      .exec();
  }

  async getGroup(groupId: string): Promise<GroupDocument> {
    const group = await this.groupModel
      .findById(groupId)
      .populate('creator members admins', 'email displayName profilePicture status');
    if (!group) throw new NotFoundException('Group not found');
    return group;
  }

  async updateGroup(
    groupId: string,
    userId: string,
    data: { name?: string; description?: string; icon?: string },
  ): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new NotFoundException('Group not found');

    const uid = new Types.ObjectId(userId);
    const isCreator = group.creator.equals(uid);
    const isAdmin = group.admins.some((a) => a.equals(uid));

    if (!isCreator && !isAdmin) {
      throw new ForbiddenException('Only admins can edit group settings');
    }

    if (data.name) group.name = data.name;
    if (data.description !== undefined) group.description = data.description;
    if (data.icon) group.icon = data.icon;

    return group.save();
  }

  async addMember(
    groupId: string,
    actorId: string,
    newMemberId: string,
  ): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new NotFoundException('Group not found');

    const aid = new Types.ObjectId(actorId);
    const isCreator = group.creator.equals(aid);
    const isAdmin = group.admins.some((a) => a.equals(aid));

    if (!isCreator && !isAdmin) {
      throw new ForbiddenException('Only admins can add members');
    }

    const mid = new Types.ObjectId(newMemberId);
    if (!group.members.some((m) => m.equals(mid))) {
      group.members.push(mid);
      await group.save();
    }

    return group;
  }

  async removeMember(
    groupId: string,
    actorId: string,
    targetId: string,
  ): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new NotFoundException('Group not found');

    const aid = new Types.ObjectId(actorId);
    const tid = new Types.ObjectId(targetId);

    const isCreator = group.creator.equals(aid);
    const isAdmin = group.admins.some((a) => a.equals(aid));

    if (!isCreator && !isAdmin) {
      throw new ForbiddenException('Only admins can remove members');
    }

    // Cannot remove creator
    if (group.creator.equals(tid)) {
      throw new ForbiddenException('Cannot remove the group creator');
    }

    // Admin cannot remove other admins (only creator can)
    if (!isCreator && group.admins.some((a) => a.equals(tid))) {
      throw new ForbiddenException('Only the creator can remove admins');
    }

    group.members = group.members.filter((m) => !m.equals(tid));
    group.admins = group.admins.filter((a) => !a.equals(tid));
    return group.save();
  }

  async promoteAdmin(
    groupId: string,
    actorId: string,
    targetId: string,
  ): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new NotFoundException('Group not found');

    const aid = new Types.ObjectId(actorId);
    const tid = new Types.ObjectId(targetId);

    const isCreator = group.creator.equals(aid);
    const isAdmin = group.admins.some((a) => a.equals(aid));

    if (!isCreator && !isAdmin) {
      throw new ForbiddenException('Only admins can promote members');
    }

    if (!group.admins.some((a) => a.equals(tid))) {
      group.admins.push(tid);
      await group.save();
    }

    return group;
  }

  async demoteAdmin(
    groupId: string,
    actorId: string,
    targetId: string,
  ): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new NotFoundException('Group not found');

    const aid = new Types.ObjectId(actorId);
    const tid = new Types.ObjectId(targetId);

    // Only creator can demote admins
    if (!group.creator.equals(aid)) {
      throw new ForbiddenException('Only the creator can demote admins');
    }

    group.admins = group.admins.filter((a) => !a.equals(tid));
    return group.save();
  }

  async leaveGroup(groupId: string, userId: string): Promise<GroupDocument> {
    const group = await this.groupModel.findById(groupId);
    if (!group) throw new NotFoundException('Group not found');

    const uid = new Types.ObjectId(userId);

    // If creator is leaving, transfer to first admin
    if (group.creator.equals(uid)) {
      const otherAdmins = group.admins.filter((a) => !a.equals(uid));
      if (otherAdmins.length > 0) {
        group.creator = otherAdmins[0];
      } else {
        // Transfer to first remaining member
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
      await this.groupModel.deleteOne({ _id: groupId });
      return group;
    }

    return group.save();
  }

  async updateLastMessage(
    groupId: string,
    text: string,
    senderName: string,
  ): Promise<void> {
    await this.groupModel.updateOne(
      { _id: groupId },
      { lastMessage: { text, timestamp: new Date(), senderName } },
    );
  }
}
