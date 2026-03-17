import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { verifyToken } from '@clerk/backend';

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing authorization token');
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY!,
      });
      request.userId = decoded.sub; // Clerk user ID
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
