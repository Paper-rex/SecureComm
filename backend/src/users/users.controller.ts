import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Query,
  Param,
  Body,
  UseGuards,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@Req() req: any) {
    const user = await this.usersService.findByClerkId(req.userId);
    if (!user) throw new NotFoundException('User not found');
    return {
      _id: user._id,
      clerkId: user.clerkId,
      email: user.email,
      displayName: user.displayName,
      profilePicture: user.profilePicture,
      status: user.status,
    };
  }

  @Post('sync')
  async syncUser(
    @Req() req: any,
    @Body()
    body: {
      email: string;
      displayName: string;
      profilePicture?: string;
      publicKey: string;
    },
  ) {
    return this.usersService.syncUser({
      clerkId: req.userId,
      ...body,
    });
  }

  @Get('search')
  async searchByEmail(@Query('email') email: string) {
    const user = await this.usersService.searchByEmail(email);
    if (!user) {
      return { found: false, user: null };
    }
    return {
      found: true,
      user: {
        _id: user._id,
        email: user.email,
        displayName: user.displayName,
        profilePicture: user.profilePicture,
        status: user.status,
      },
    };
  }

  @Post('invite')
  async inviteUser(@Req() req: any, @Body() body: { email: string }) {
    const inviter = await this.usersService.findByClerkId(req.userId);
    if (!inviter) {
      throw new NotFoundException('User not found');
    }
    await this.usersService.inviteUser(inviter.email, body.email);
    return { success: true, message: 'Invitation sent' };
  }

  @Patch('status')
  async updateStatus(
    @Req() req: any,
    @Body() body: { status: 'online' | 'offline' },
  ) {
    await this.usersService.updateStatus(req.userId, body.status);
    return { success: true };
  }

  @Get(':id/public-key')
  async getPublicKey(@Param('id') id: string) {
    const publicKey = await this.usersService.getPublicKey(id);
    return { publicKey };
  }

  @Delete('me')
  async deleteAccount(@Req() req: any) {
    await this.usersService.deleteUser(req.userId);
    return { success: true, message: 'Account and all associated data deleted' };
  }
}
