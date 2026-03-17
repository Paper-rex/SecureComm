import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { FilesService } from './files.service';
import { AuthGuard } from '../auth/auth.guard';
import { v4 as uuidv4 } from 'uuid';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) { }

  @Post('upload')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Validate
    const validation = this.filesService.validateFile(
      file.originalname,
      file.size,
      file.mimetype,
    );
    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    // Malware scan
    const scanResult = await this.filesService.scanForMalware(file.buffer);
    if (!scanResult.clean) {
      throw new BadRequestException(
        `Malware detected: ${scanResult.threat}. Upload blocked.`,
      );
    }

    // Upload encrypted file to Cloudinary
    const storageKey = `${uuidv4()}-${file.originalname}`;
    const { url, publicId } = await this.filesService.uploadFile(
      file.buffer,
      storageKey,
      file.mimetype,
    );

    return {
      fileUrl: url,
      publicId,
      storageKey,
      name: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    };
  }

  @Get('download')
  @UseGuards(AuthGuard)
  async downloadFile(
    @Param('url') url: string,
    @Res() res: Response,
  ) {
    const fileBuffer = await this.filesService.downloadFile(url);
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Length': fileBuffer.length.toString(),
    });
    res.send(fileBuffer);
  }
}
