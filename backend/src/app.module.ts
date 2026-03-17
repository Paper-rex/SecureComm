import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from './users/users.module';
import { ChatsModule } from './chats/chats.module';
import { GroupsModule } from './groups/groups.module';
import { MessagesModule } from './messages/messages.module';
import { FilesModule } from './files/files.module';
import { GatewayModule } from './gateway/gateway.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    // ─── Configuration ──────────────────────────────────
    ConfigModule.forRoot({ isGlobal: true }),

    // ─── Database ───────────────────────────────────────
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/securecomm',
    ),

    // ─── Rate Limiting (DDoS / Brute Force Protection) ──
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL || '60000'),
        limit: parseInt(process.env.THROTTLE_LIMIT || '100'),
      },
    ]),

    // ─── Feature Modules ────────────────────────────────
    AuthModule,
    UsersModule,
    ChatsModule,
    GroupsModule,
    MessagesModule,
    FilesModule,
    GatewayModule,
  ],
  providers: [
    // Apply rate limiting globally
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
