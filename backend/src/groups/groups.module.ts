import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GroupsController } from './groups.controller';
import { GroupsService } from './groups.service';
import { Group, GroupSchema } from './group.schema';
import { AuthModule } from '../auth/auth.module';
import { MessagesModule } from '../messages/messages.module';
import { UsersModule } from '../users/users.module';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Group.name, schema: GroupSchema }]),
    AuthModule,
    forwardRef(() => MessagesModule),
    UsersModule,
    forwardRef(() => GatewayModule),
  ],
  controllers: [GroupsController],
  providers: [GroupsService],
  exports: [GroupsService],
})
export class GroupsModule {}
