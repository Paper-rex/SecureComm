import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MulterModule.register({
      limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
    }),
    AuthModule,
  ],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
