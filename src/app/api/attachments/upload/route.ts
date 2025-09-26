import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;
    const eventId = data.get('eventId') as string;
    const entityId = data.get('entityId') as string;
    const attachmentType = data.get('type') as string || 'other';

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!eventId && !entityId) {
      return NextResponse.json({ error: 'Event ID or Entity ID is required' }, { status: 400 });
    }

    // Validate file size (50MB limit)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size too large. Maximum 50MB allowed.' }, { status: 400 });
    }

    // Generate unique filename
    const fileExtension = file.name.split('.').pop() || '';
    const uniqueFilename = `${uuidv4()}.${fileExtension}`;

    // Create upload directory path
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'attachments');

    // Ensure directory exists
    try {
      const { mkdir } = await import('fs/promises');
      await mkdir(uploadDir, { recursive: true });
    } catch (error) {
      // Directory might already exist, continue
    }

    const filepath = join(uploadDir, uniqueFilename);

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filepath, buffer);

    // Determine attachment type from MIME type if not provided
    let finalType = attachmentType;
    if (!attachmentType || attachmentType === 'other') {
      if (file.type.startsWith('image/')) finalType = 'photo';
      else if (file.type.startsWith('video/')) finalType = 'video';
      else if (file.type.startsWith('audio/')) finalType = 'audio';
      else if (file.type === 'application/pdf') finalType = 'document';
      else if (file.type.includes('text/')) finalType = 'document';
      else finalType = 'other';
    }

    // Create attachment record in database
    const attachmentData = {
      filename: uniqueFilename,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      url: `/uploads/attachments/${uniqueFilename}`,
      type: finalType,
      ...(eventId && { eventId }),
      ...(entityId && { entityId }),
      createdBy: session.user.id,
    };

    // Save to database (we'll implement this API endpoint)
    const createResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/attachments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || ''
      },
      body: JSON.stringify(attachmentData),
    });

    if (!createResponse.ok) {
      // Clean up uploaded file if database save failed
      try {
        const { unlink } = await import('fs/promises');
        await unlink(filepath);
      } catch (error) {
        console.error('Error cleaning up file:', error);
      }

      return NextResponse.json({ error: 'Failed to save attachment record' }, { status: 500 });
    }

    const attachment = await createResponse.json();

    return NextResponse.json({
      message: 'File uploaded successfully',
      attachment,
    });

  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Configure API route
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';