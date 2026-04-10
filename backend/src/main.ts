import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as dns from 'dns';

// Force DNS to prefer IPv4. This avoids ENETUNREACH issues when IPv6 is not available
// but the system attempts to use it (common with Google/Gmail SMTP servers).
dns.setDefaultResultOrder('ipv4first');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ─── Security Headers ────────────────────────────────
  app.use(helmet());

  // ─── CORS Configuration ──────────────────────────────
  app.enableCors({
    origin: [
      'https://securecomm.vercel.app',
      'http://localhost:3000',
    ],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ─── Global Validation Pipe ──────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip unknown properties
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // ─── API Prefix ──────────────────────────────────────
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🛡️  SecureComm API running on http://localhost:${port}`);
  console.log(`📡 WebSocket gateway active`);
}
bootstrap();
