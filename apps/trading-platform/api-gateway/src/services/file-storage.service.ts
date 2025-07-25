import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import crypto from 'crypto'
import winston from 'winston'

export interface FileUploadResult {
  s3Key: string
  s3Bucket: string
  fileSize: number
  contentType: string
  etag?: string
}

export interface FileDownloadInfo {
  presignedUrl: string
  expiresIn: number
  originalFilename?: string
  contentType?: string
}

export class FileStorageService {
  private s3Client: S3Client | null = null
  private bucketName: string
  private logger: winston.Logger

  constructor(logger: winston.Logger) {
    this.logger = logger
    this.bucketName = process.env.AWS_S3_BUCKET || 'trading-platform-documents'
    
    // Initialize S3 client if credentials are available
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      })
      this.logger.info('S3 client initialized successfully for file storage')
    } else {
      this.logger.warn('S3 credentials not found - file uploads will fail')
    }
  }

  /**
   * Check if S3 is available
   */
  isS3Available(): boolean {
    return this.s3Client !== null
  }

  /**
   * Upload file to S3
   */
  async uploadFile(
    buffer: Buffer,
    originalFilename: string,
    contentType: string,
    category: string = 'knowledge',
    metadata: Record<string, string> = {}
  ): Promise<FileUploadResult> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized - check AWS credentials')
    }

    try {
      // Generate unique S3 key
      const s3Key = this.generateS3Key(category, originalFilename)
      
      // Upload file to S3
      const uploadCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        Body: buffer,
        ContentType: contentType,
        Metadata: {
          originalFilename,
          category,
          uploadedAt: new Date().toISOString(),
          contentHash: this.generateContentHash(buffer),
          ...metadata
        }
      })

      const response = await this.s3Client.send(uploadCommand)
      
      this.logger.info(`File uploaded to S3: ${s3Key}`, {
        originalFilename,
        size: buffer.length,
        contentType,
        etag: response.ETag
      })

      return {
        s3Key,
        s3Bucket: this.bucketName,
        fileSize: buffer.length,
        contentType,
        etag: response.ETag
      }

    } catch (error) {
      this.logger.error('Failed to upload file to S3:', error)
      throw new Error(`S3 upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Generate pre-signed URL for file download
   */
  async getDownloadUrl(
    s3Key: string,
    expiresIn: number = 3600,
    originalFilename?: string
  ): Promise<FileDownloadInfo> {
    if (!this.s3Client) {
      throw new Error('S3 client not initialized')
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key,
        ResponseContentDisposition: originalFilename 
          ? `attachment; filename="${originalFilename}"`
          : undefined
      })

      const presignedUrl = await getSignedUrl(this.s3Client, command, { expiresIn })

      this.logger.debug(`Generated pre-signed URL for ${s3Key}`, {
        expiresIn,
        originalFilename
      })

      return {
        presignedUrl,
        expiresIn,
        originalFilename
      }

    } catch (error) {
      this.logger.error(`Failed to generate pre-signed URL for ${s3Key}:`, error)
      throw new Error(`Failed to generate download URL: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Get file content directly (for processing)
   */
  async getFileContent(s3Key: string): Promise<Buffer | null> {
    if (!this.s3Client) {
      return null
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      })

      const response = await this.s3Client.send(command)
      if (response.Body) {
        return Buffer.from(await response.Body.transformToByteArray())
      }

      return null

    } catch (error) {
      this.logger.error(`Failed to retrieve file content from S3: ${s3Key}`, error)
      return null
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFile(s3Key: string): Promise<boolean> {
    if (!this.s3Client) {
      return false
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: s3Key
      })

      await this.s3Client.send(command)
      this.logger.info(`File deleted from S3: ${s3Key}`)
      return true

    } catch (error) {
      this.logger.error(`Failed to delete file from S3: ${s3Key}`, error)
      return false
    }
  }

  /**
   * Health check for S3 connection
   */
  async healthCheck(): Promise<boolean> {
    if (!this.s3Client) {
      return false
    }

    try {
      // Try to get a non-existent object to test connection
      await this.s3Client.send(new GetObjectCommand({
        Bucket: this.bucketName,
        Key: 'health-check-non-existent'
      }))
      return true
    } catch (error) {
      // If it's a NoSuchKey error, S3 is accessible
      if (error instanceof Error && error.name === 'NoSuchKey') {
        return true
      }
      return false
    }
  }

  /**
   * Helper methods
   */
  private generateS3Key(category: string, originalFilename: string): string {
    const timestamp = Date.now()
    const randomId = crypto.randomBytes(8).toString('hex')
    const sanitizedFilename = originalFilename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .substring(0, 100)
    
    return `${category}/${timestamp}-${randomId}-${sanitizedFilename}`
  }

  private generateContentHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex')
  }
} 