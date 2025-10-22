import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { documentId } = await request.json();

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Update document status to processing
    const { error: updateError } = await supabase
      .from('documents')
      .update({ status: 'processing' })
      .eq('id', documentId);

    if (updateError) {
      console.error('Failed to update document status:', updateError);
      return NextResponse.json(
        { error: 'Failed to update document status' },
        { status: 500 }
      );
    }

    // Call Edge Function
    const functionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/parse-pdf`;

    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ document_id: documentId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Edge Function error:', errorText);

      // Update document status to error
      await supabase
        .from('documents')
        .update({
          status: 'error',
          error_msg: `Edge Function failed: ${errorText.substring(0, 500)}`
        })
        .eq('id', documentId);

      return NextResponse.json(
        { error: 'Failed to parse PDF', details: errorText },
        { status: 500 }
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      documentId,
      result,
    });
  } catch (error) {
    console.error('Parse trigger error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

