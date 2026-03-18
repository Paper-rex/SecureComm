import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import type { UploadApiResponse } from 'cloudinary';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);

  constructor(private configService: ConfigService) {
    cloudinary.config({
      cloud_name: this.configService.get('CLOUDINARY_CLOUD_NAME', ''),
      api_key: this.configService.get('CLOUDINARY_API_KEY', ''),
      api_secret: this.configService.get('CLOUDINARY_API_SECRET', ''),
    });
    this.logger.log('Cloudinary storage configured');
  }

  /**
   * Upload an encrypted file buffer to Cloudinary.
   * Uses resource_type "raw" since files are encrypted binary.
   * Returns { url, publicId }.
   */
  async uploadFile(
    fileBuffer: Buffer,
    storageKey: string,
    _mimeType: string,
  ): Promise<{ url: string; publicId: string }> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          resource_type: 'raw',
          public_id: storageKey,
          folder: 'securecomm-files',
          overwrite: true,
        },
        (error, result?: UploadApiResponse) => {
          if (error || !result) {
            this.logger.error('Cloudinary upload failed', error);
            return reject(error || new Error('Upload failed'));
          }
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        },
      );
      uploadStream.end(fileBuffer);
    });
  }

  /**
   * Download a file by its Cloudinary URL.
   * Returns the file as a Buffer.
   */
  async downloadFile(fileUrl: string): Promise<Buffer> {
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new HttpException(`Failed to download file from Cloudinary: ${response.status} ${response.statusText}`, response.status === 404 ? HttpStatus.NOT_FOUND : HttpStatus.BAD_GATEWAY);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (err: any) {
      this.logger.error(`Error fetching file: ${fileUrl}`, err);
      if (err instanceof HttpException) throw err;
      throw new HttpException(`Network error fetching file: ${err.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Delete a file from Cloudinary by its public_id.
   */
  async deleteFile(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });
  }

  /**
   * Basic file validation
   * In production, integrate ClamAV for malware scanning
   */
  validateFile(
    filename: string,
    size: number,
    mimeType: string,
  ): { valid: boolean; error?: string } {
    const MAX_SIZE = 25 * 1024 * 1024; // 25MB
    const ALLOWED_TYPES = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip', 'application/x-zip-compressed',
      'application/octet-stream', // Required for client-side encrypted blobs
    ];

    if (size > MAX_SIZE) {
      return { valid: false, error: `File too large. Maximum: ${MAX_SIZE / (1024 * 1024)}MB` };
    }

    if (!ALLOWED_TYPES.includes(mimeType)) {
      return { valid: false, error: 'File type not allowed' };
    }

    // Block double extensions (e.g., "file.pdf.exe")
    const parts = filename.split('.');
    if (parts.length > 2) {
      const suspiciousExtensions = ['exe', 'bat', 'cmd', 'sh', 'ps1', 'vbs', 'js'];
      if (suspiciousExtensions.includes(parts[parts.length - 1].toLowerCase())) {
        return { valid: false, error: 'Suspicious file extension detected' };
      }
    }

    return { valid: true };
  }

  /**
   * Placeholder for ClamAV malware scanning.
   * In production: connect to clamd socket and scan the buffer.
   */
  async scanForMalware(fileBuffer: Buffer): Promise<{ clean: boolean; threat?: string }> {
    // TODO: Integrate ClamAV via clamd socket
    this.logger.log(`Scanning file (${fileBuffer.length} bytes) for malware...`);
    return { clean: true };
  }
}
