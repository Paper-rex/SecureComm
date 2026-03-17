import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { MessagesModule } from '../messages/messages.module';
import { ChatsModule } from '../chats/chats.module';
import { GroupsModule } from '../groups/groups.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [MessagesModule, ChatsModule, GroupsModule, UsersModule],
  providers: [ChatGateway],
})
export class GatewayModule {}
