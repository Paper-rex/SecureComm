import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';
import { Chat, ChatSchema } from './chat.schema';
import { AuthModule } from '../auth/auth.module';
import { MessagesModule } from '../messages/messages.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Chat.name, schema: ChatSchema }]),
    AuthModule,
    forwardRef(() => MessagesModule),
    UsersModule,
  ],
  controllers: [ChatsController],
  providers: [ChatsService],
  exports: [ChatsService],
})
export class ChatsModule {}
