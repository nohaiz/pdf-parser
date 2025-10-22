import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { fileName, fileSize } = await request.json();

    if (!fileName) {
      return NextResponse.json(
        { error: 'File name is required' },
        { status: 400 }
      );
    }

    // Validate file is a PDF
    if (!fileName.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'Only PDF files are supported' },
        { status: 400 }
      );
    }

    // Optional: Validate file size (e.g., max 100MB)
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    if (fileSize && fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size exceeds maximum limit of 100MB' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // For demo purposes, we'll use a fixed user_id
    // In production, get this from auth session
    const userId = '00000000-0000-0000-0000-000000000000';

    // Generate unique storage key
    const timestamp = Date.now();
    const storageKey = `${userId}/${timestamp}-${fileName}`;

    // Create document record
    const { data: document, error: dbError } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        storage_key: storageKey,
        status: 'uploaded',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to create document record' },
        { status: 500 }
      );
    }

    // Generate signed upload URL
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from(process.env.NEXT_PUBLIC_STORAGE_BUCKET!)
      .createSignedUploadUrl(storageKey);

    if (uploadError) {
      console.error('Upload URL error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to generate upload URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      documentId: document.id,
      uploadUrl: uploadData.signedUrl,
      storageKey: storageKey,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

