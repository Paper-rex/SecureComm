import {
  Controller,
  Post,
  Get,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  InternalServerErrorException,
  HttpException,
  Res,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { FilesService } from './files.service';
import { AuthGuard } from '../auth/auth.guard';
import { v4 as uuidv4 } from 'uuid';

@Controller('files')
export class FilesController {
  private readonly logger = new Logger(FilesController.name);

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
    @Query('url') url: string,
    @Res() res: Response,
  ) {
    if (!url) {
      throw new BadRequestException('URL query parameter is required');
    }
    this.logger.log(`Attempting to download file from URL: ${url}`);
    try {
      const fileBuffer = await this.filesService.downloadFile(url);
      res.set({
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileBuffer.length.toString(),
      });
      res.send(fileBuffer);
    } catch (error) {
      this.logger.error(`Download failed for URL ${url}`, error instanceof Error ? error.stack : String(error));
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(error instanceof Error ? error.message : 'Unknown error during file download');
    }
  }
}
