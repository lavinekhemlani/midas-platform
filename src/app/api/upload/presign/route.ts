// src/app/api/upload/presign/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyCognitoToken } from '@/lib/cognito-auth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

// Initialize S3Client
const S3_UPLOADS_BUCKET_NAME = process.env.S3_UPLOADS_BUCKET_NAME;
const AWS_S3_REGION = process.env.AWS_S3_REGION;

let s3Client: S3Client; 
if (AWS_S3_REGION) {
  s3Client = new S3Client({ region: AWS_S3_REGION });
} else {
  console.warn('AWS_S3_REGION is not set. S3Client might not be properly initialized.');
}

const uploadConfigurations = {
  manual_financials: {
    pathPrefix: 'manual-financials/',
    allowedFileTypes: ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/pdf'],
    maxFileSizeMB: 5,
  },
  corp_profile: {
    pathPrefix: 'corp-profile/',
    allowedFileTypes: ['application/pdf', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    maxFileSizeMB: 10,
  },
};

type UploadType = keyof typeof uploadConfigurations;

export async function GET(req: NextRequest) {
  try {
    const { userId } = await verifyCognitoToken(req);
    
    if (!AWS_S3_REGION || !s3Client) {
        console.error('S3 region or client is missing or incomplete.');
        return NextResponse.json({ error: 'Server configuration error for S3 uploads.' }, { status: 500 });
    }

    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get('type') as UploadType | null;
    const fileName = searchParams.get('fileName');
    const contentType = searchParams.get('contentType');

    if (!type || !uploadConfigurations[type]) {
      return NextResponse.json({ error: 'Invalid or missing upload type specified.' }, { status: 400 });
    }
    if (!fileName || !contentType) {
      return NextResponse.json({ error: 'Missing fileName or contentType parameter.' }, { status: 400 });
    }

    const config = uploadConfigurations[type];

    if (!config.allowedFileTypes.includes(contentType.toLowerCase())) {
        return NextResponse.json({ error: `Invalid file type: ${contentType}. Allowed types for '${type}': ${config.allowedFileTypes.join(', ')}` }, { status: 400 });
    }
    
    if (!S3_UPLOADS_BUCKET_NAME) {
      console.error('S3_UPLOADS_BUCKET_NAME environment variable is not set');
      return NextResponse.json({ error: 'Server configuration error: Upload bucket not configured.' }, { status: 500 });
    }

    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const orgIdParam = searchParams.get('orgId');
    const userIdParam = searchParams.get('userId');
    
    const userIdToUse = userIdParam || userId;
    const orgIdToUse = orgIdParam?.replace('ORG#', '');
    
    const uniqueFileKey = orgIdToUse 
      ? `${config.pathPrefix}${userIdToUse}/org_${orgIdToUse}/${randomUUID()}-${sanitizedFileName}`
      : `${config.pathPrefix}${userIdToUse}/${randomUUID()}-${sanitizedFileName}`;
      
    console.log(`[S3 Upload] Generated file key: ${uniqueFileKey}`);
    console.log(`[S3 Upload] Using bucket: ${S3_UPLOADS_BUCKET_NAME} for upload type: ${type}`);

    const command = new PutObjectCommand({
      Bucket: S3_UPLOADS_BUCKET_NAME,
      Key: uniqueFileKey,
      ContentType: contentType,
      Metadata: {
        'upload-type': type,
        'user-id': userIdToUse,
        'original-filename': fileName,
        'organization-id': orgIdToUse || 'none'
      },
    });

    const expiresInSeconds = 300;
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });

    return NextResponse.json({
      success: true,
      uploadUrl: uploadUrl,
      key: uniqueFileKey, 
      method: 'PUT',
      expiresIn: expiresInSeconds,
    });

  } catch (error) {
    console.error('Error in /api/upload/presign:', error);
    if (error instanceof Error && (error.message.includes('Token is not valid') || error.message.includes('Authorization header is missing'))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to generate presigned URL.', details: errorMessage }, { status: 500 });
  }
}
