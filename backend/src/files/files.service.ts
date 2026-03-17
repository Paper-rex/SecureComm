import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private minioClient: Minio.Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get('MINIO_ENDPOINT', 'localhost'),
      port: parseInt(this.configService.get('MINIO_PORT', '9000')),
      useSSL: this.configService.get('MINIO_USE_SSL') === 'true',
      accessKey: this.configService.get('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.configService.get('MINIO_SECRET_KEY', 'minioadmin'),
    });
    this.bucketName = this.configService.get('MINIO_BUCKET', 'securecomm-files');
    this.ensureBucket();
  }

  private async ensureBucket(): Promise<void> {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName);
        this.logger.log(`Created MinIO bucket: ${this.bucketName}`);
      }
    } catch (error) {
      this.logger.warn(`MinIO bucket check failed (will retry on upload): ${error.message}`);
    }
  }

  async uploadFile(
    fileBuffer: Buffer,
    storageKey: string,
    mimeType: string,
  ): Promise<string> {
    await this.minioClient.putObject(
      this.bucketName,
      storageKey,
      fileBuffer,
      fileBuffer.length,
      { 'Content-Type': mimeType },
    );
    return storageKey;
  }

  async downloadFile(storageKey: string): Promise<Buffer> {
    const stream = await this.minioClient.getObject(
      this.bucketName,
      storageKey,
    );

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  async deleteFile(storageKey: string): Promise<void> {
    await this.minioClient.removeObject(this.bucketName, storageKey);
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
    // Example with clamav.js:
    // const scanner = new ClamScan({ clamdscan: { socket: '/var/run/clamav/clamd.ctl' } });
    // const { isInfected, viruses } = await scanner.scanBuffer(fileBuffer);
    this.logger.log(`Scanning file (${fileBuffer.length} bytes) for malware...`);
    return { clean: true };
  }
}
