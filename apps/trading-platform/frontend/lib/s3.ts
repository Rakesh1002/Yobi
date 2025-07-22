import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Initialize S3 client
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'trading-platform-documents'

// Document types configuration
export const DOCUMENT_TYPES = {
  REPORTS: 'reports',
  STATEMENTS: 'statements',
  CONTRACTS: 'contracts',
  RESEARCH: 'research',
  KYC: 'kyc',
} as const

// File size limits (in bytes)
const MAX_FILE_SIZE = {
  [DOCUMENT_TYPES.REPORTS]: 50 * 1024 * 1024, // 50MB
  [DOCUMENT_TYPES.STATEMENTS]: 10 * 1024 * 1024, // 10MB
  [DOCUMENT_TYPES.CONTRACTS]: 20 * 1024 * 1024, // 20MB
  [DOCUMENT_TYPES.RESEARCH]: 100 * 1024 * 1024, // 100MB
  [DOCUMENT_TYPES.KYC]: 5 * 1024 * 1024, // 5MB
}

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'text/csv',
]

export interface UploadOptions {
  userId: string
  documentType: keyof typeof DOCUMENT_TYPES
  fileName: string
  fileType: string
  metadata?: Record<string, string>
}

export interface DocumentMetadata {
  userId: string
  documentType: string
  originalName: string
  uploadedAt: string
  size: number
  contentType: string
  [key: string]: any
}

// Generate unique S3 key for documents
function generateS3Key(options: UploadOptions): string {
  const timestamp = Date.now()
  const sanitizedFileName = options.fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
  return `${options.documentType}/${options.userId}/${timestamp}-${sanitizedFileName}`
}

// Upload document to S3
export async function uploadDocument(
  file: Buffer | Uint8Array,
  options: UploadOptions
): Promise<{ key: string; url: string }> {
  // Validate file type
  if (!ALLOWED_MIME_TYPES.includes(options.fileType)) {
    throw new Error('Invalid file type')
  }

  // Validate file size
  const maxSize = MAX_FILE_SIZE[options.documentType as keyof typeof MAX_FILE_SIZE]
  if (file.byteLength > maxSize) {
    throw new Error(`File size exceeds limit of ${maxSize / 1024 / 1024}MB`)
  }

  const key = generateS3Key(options)
  
  const metadata: DocumentMetadata = {
    userId: options.userId,
    documentType: options.documentType,
    originalName: options.fileName,
    uploadedAt: new Date().toISOString(),
    size: file.byteLength,
    contentType: options.fileType,
    ...options.metadata,
  }

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: file,
    ContentType: options.fileType,
    Metadata: metadata as Record<string, string>,
  })

  await s3Client.send(command)

  // Generate signed URL for immediate access
  const url = await generatePresignedUrl(key, 'get')

  return { key, url }
}

// Generate presigned URL for secure access
export async function generatePresignedUrl(
  key: string,
  operation: 'get' | 'put' = 'get',
  expiresIn: number = 3600 // 1 hour
): Promise<string> {
  const command = operation === 'get'
    ? new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key })
    : new PutObjectCommand({ Bucket: BUCKET_NAME, Key: key })

  return await getSignedUrl(s3Client, command, { expiresIn })
}

// Delete document from S3
export async function deleteDocument(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  })

  await s3Client.send(command)
}

// Helper function for React component file upload
export async function uploadFileFromForm(
  file: File,
  userId: string,
  documentType: keyof typeof DOCUMENT_TYPES,
  metadata?: Record<string, string>
): Promise<{ key: string; url: string }> {
  const buffer = await file.arrayBuffer()
  
  return uploadDocument(new Uint8Array(buffer), {
    userId,
    documentType,
    fileName: file.name,
    fileType: file.type,
    metadata,
  })
}

// Utility to get document URL with caching
const urlCache = new Map<string, { url: string; expires: number }>()

export async function getDocumentUrl(key: string, useCache: boolean = true): Promise<string> {
  if (useCache) {
    const cached = urlCache.get(key)
    if (cached && cached.expires > Date.now()) {
      return cached.url
    }
  }

  const url = await generatePresignedUrl(key)
  const expires = Date.now() + 55 * 60 * 1000 // 55 minutes (5 min buffer)
  
  urlCache.set(key, { url, expires })
  
  return url
} 