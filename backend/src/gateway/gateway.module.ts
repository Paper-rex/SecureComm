import { Module, forwardRef } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { MessagesModule } from '../messages/messages.module';
import { ChatsModule } from '../chats/chats.module';
import { GroupsModule } from '../groups/groups.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MessagesModule,
    forwardRef(() => ChatsModule),
    forwardRef(() => GroupsModule),
    UsersModule,
  ],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class GatewayModule {}
