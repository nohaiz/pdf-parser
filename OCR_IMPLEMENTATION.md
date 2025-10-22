# OCR Implementation Guide

This document provides implementation guidance for adding OCR (Optical Character Recognition) fallback for image-based PDFs.

## Current State

The Edge Function detects image-only or empty pages but does not process them:

```typescript
if (!pageText || pageText.length < 10) {
  console.log(`Page ${i} appears to be empty or image-only (OCR candidate)`);
  pages.push({
    pageNo: i,
    text: '[Empty or image-only page - OCR not implemented]',
  });
}
```

## Implementation Options

### Option 1: Tesseract.js (Client-Side)

**Pros**:
- Free and open-source
- Runs in browser (no backend costs)
- No API keys needed
- Works offline

**Cons**:
- Slow (5-10 seconds per page)
- CPU-intensive (drains battery on mobile)
- Lower accuracy than cloud solutions
- Requires WASM support

**Implementation**:

```typescript
// Install
npm install tesseract.js

// In component
import Tesseract from 'tesseract.js';

async function ocrPage(imageBuffer: ArrayBuffer) {
  const { data: { text } } = await Tesseract.recognize(
    imageBuffer,
    'eng',
    {
      logger: m => console.log(m) // Progress logging
    }
  );
  return text;
}
```

**Best for**: Low-volume, privacy-sensitive applications

---

### Option 2: Google Cloud Vision API

**Pros**:
- High accuracy (98%+ for clear text)
- Fast (1-2 seconds per page)
- Handles complex layouts
- Multi-language support

**Cons**:
- Costs $1.50 per 1,000 pages
- Requires Google Cloud account
- API key management

**Implementation**:

```typescript
// In Edge Function
async function ocrPageWithGoogleVision(imageBuffer: ArrayBuffer, pageNo: number) {
  const apiKey = Deno.env.get('GOOGLE_VISION_API_KEY');
  
  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          image: {
            content: btoa(String.fromCharCode(...new Uint8Array(imageBuffer)))
          },
          features: [{ type: 'DOCUMENT_TEXT_DETECTION' }]
        }]
      })
    }
  );

  const result = await response.json();
  return result.responses[0].fullTextAnnotation?.text || '';
}
```

**Setup**:
1. Enable Cloud Vision API in Google Cloud Console
2. Create API key
3. Set as Edge Function secret: `supabase secrets set GOOGLE_VISION_API_KEY=xxx`

**Best for**: Production applications with budget

---

### Option 3: AWS Textract

**Pros**:
- Excellent for structured documents (tables, forms)
- High accuracy
- Async processing for large batches
- Pay per page ($1.50 per 1,000 pages)

**Cons**:
- Requires AWS account
- More complex setup (IAM, S3)
- Overkill for simple text extraction

**Implementation**:

```typescript
import { TextractClient, DetectDocumentTextCommand } from "@aws-sdk/client-textract";

const client = new TextractClient({ 
  region: "us-east-1",
  credentials: {
    accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID')!,
    secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY')!
  }
});

async function ocrWithTextract(imageBuffer: ArrayBuffer) {
  const command = new DetectDocumentTextCommand({
    Document: { Bytes: new Uint8Array(imageBuffer) }
  });
  
  const response = await client.send(command);
  
  return response.Blocks
    ?.filter(block => block.BlockType === 'LINE')
    .map(block => block.Text)
    .join(' ') || '';
}
```

**Best for**: Document processing pipelines with AWS infrastructure

---

### Option 4: Azure Computer Vision

**Pros**:
- Good accuracy
- Generous free tier (5,000 pages/month)
- Fast processing
- Handles handwriting

**Cons**:
- Requires Azure account
- API key management

**Implementation**:

```typescript
async function ocrWithAzure(imageUrl: string) {
  const endpoint = Deno.env.get('AZURE_VISION_ENDPOINT');
  const apiKey = Deno.env.get('AZURE_VISION_KEY');
  
  const response = await fetch(
    `${endpoint}/vision/v3.2/read/analyze`,
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url: imageUrl })
    }
  );
  
  const operationLocation = response.headers.get('Operation-Location');
  
  // Poll for results
  let result;
  do {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const resultResponse = await fetch(operationLocation!, {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey! }
    });
    result = await resultResponse.json();
  } while (result.status === 'running');
  
  return result.analyzeResult.readResults
    .flatMap(page => page.lines)
    .map(line => line.text)
    .join(' ');
}
```

**Best for**: Microsoft ecosystem, generous free tier

---

## Recommended Implementation (Edge Function)

Here's how to integrate OCR into the existing Edge Function:

### 1. Update `supabase/functions/parse-pdf/index.ts`

```typescript
// Add OCR configuration
const OCR_ENABLED = Deno.env.get('OCR_ENABLED') === 'true';
const OCR_PROVIDER = Deno.env.get('OCR_PROVIDER') || 'google'; // google | aws | azure

async function ocrPage(
  page: any, // PDF.js page object
  pageNo: number
): Promise<string> {
  try {
    // Render page to canvas
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = new OffscreenCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');
    
    await page.render({
      canvasContext: context,
      viewport: viewport
    }).promise;
    
    // Convert to image buffer
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    const imageBuffer = await blob.arrayBuffer();
    
    // Call OCR service
    switch (OCR_PROVIDER) {
      case 'google':
        return await ocrWithGoogle(imageBuffer);
      case 'aws':
        return await ocrWithAWS(imageBuffer);
      case 'azure':
        return await ocrWithAzure(imageBuffer);
      default:
        throw new Error(`Unknown OCR provider: ${OCR_PROVIDER}`);
    }
  } catch (error) {
    console.error(`OCR failed for page ${pageNo}:`, error);
    return '[OCR failed]';
  }
}

// In the main parsing loop
for (let i = 1; i <= pageCount; i++) {
  const page = await pdf.getPage(i);
  const textContent = await page.getTextContent();
  
  let pageText = textContent.items
    .map((item: any) => item.str)
    .join(' ')
    .trim();

  // Check for empty pages
  if (!pageText || pageText.length < 10) {
    console.log(`Page ${i} appears to be empty or image-only`);
    
    if (OCR_ENABLED) {
      console.log(`Running OCR on page ${i}...`);
      pageText = await ocrPage(page, i);
      console.log(`OCR extracted ${pageText.length} characters`);
    } else {
      pageText = '[Empty or image-only page - OCR not enabled]';
    }
  }

  pages.push({
    pageNo: i,
    text: pageText,
  });
}
```

### 2. Set Environment Variables

```bash
# Enable OCR
supabase secrets set OCR_ENABLED=true

# Choose provider (google | aws | azure)
supabase secrets set OCR_PROVIDER=google

# Provider-specific credentials
supabase secrets set GOOGLE_VISION_API_KEY=your-key-here
# OR
supabase secrets set AWS_ACCESS_KEY_ID=xxx
supabase secrets set AWS_SECRET_ACCESS_KEY=xxx
# OR
supabase secrets set AZURE_VISION_ENDPOINT=xxx
supabase secrets set AZURE_VISION_KEY=xxx
```

### 3. Update Document Metadata

Add OCR metadata to chunks:

```typescript
{
  ...chunk,
  meta: {
    ...chunk.meta,
    ocr_processed: true,
    ocr_confidence: 0.95 // if available from provider
  }
}
```

---

## Testing OCR

### 1. Create Test PDF with Images

```bash
# Download an image-based PDF
wget https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf
```

### 2. Upload and Verify

1. Upload the PDF
2. Check Edge Function logs: `supabase functions logs parse-pdf`
3. Verify chunks contain OCR'd text
4. Compare accuracy with original

### 3. Benchmark Performance

```typescript
// Add timing
const ocrStart = Date.now();
const ocrText = await ocrPage(page, i);
const ocrDuration = Date.now() - ocrStart;

console.log(`OCR took ${ocrDuration}ms for page ${i}`);
```

---

## Cost Optimization

### 1. Cache OCR Results

```sql
ALTER TABLE doc_chunks ADD COLUMN ocr_cached BOOLEAN DEFAULT false;

-- Before OCR, check cache
SELECT content FROM doc_chunks 
WHERE content_hash = hash_of_image 
AND ocr_cached = true;
```

### 2. Batch Processing

Process multiple pages in parallel:

```typescript
const ocrPromises = emptyPages.map(page => ocrPage(page.page, page.no));
const ocrResults = await Promise.all(ocrPromises);
```

### 3. Use Free Tiers

- Azure: 5,000 pages/month free
- Google: $300 credit for new accounts
- AWS: 1,000 pages/month free (first year)

### 4. Selective OCR

Only OCR if explicitly requested:

```typescript
// Add option to upload form
const { documentId, enableOCR } = await request.json();

// Store in document metadata
await supabase
  .from('documents')
  .update({ meta: { ocr_enabled: enableOCR } })
  .eq('id', documentId);
```

---

## Handling OCR Errors

### Retry Logic

```typescript
async function ocrWithRetry(imageBuffer: ArrayBuffer, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await ocrPage(imageBuffer);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      console.log(`OCR attempt ${attempt} failed, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

### Fallback Strategy

```typescript
async function extractTextWithFallback(page, pageNo) {
  // Try text extraction
  let text = await extractText(page);
  
  if (text.length < 10) {
    // Try OCR
    try {
      text = await ocrPage(page, pageNo);
    } catch (error) {
      console.error('OCR failed:', error);
      text = '[Text extraction and OCR both failed]';
    }
  }
  
  return text;
}
```

---

## Monitoring OCR Usage

### Track Costs

```sql
CREATE TABLE ocr_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID REFERENCES documents(id),
  pages_processed INTEGER,
  provider TEXT,
  cost_estimate DECIMAL(10, 4),
  processing_time_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Dashboard

```typescript
// Get monthly OCR stats
const { data: stats } = await supabase
  .from('ocr_usage')
  .select('pages_processed, cost_estimate')
  .gte('created_at', startOfMonth)
  .lte('created_at', endOfMonth);

const totalPages = stats.reduce((sum, s) => sum + s.pages_processed, 0);
const totalCost = stats.reduce((sum, s) => sum + s.cost_estimate, 0);
```

---

## Next Steps

1. **Choose Provider**: Start with Azure (generous free tier)
2. **Implement Basic OCR**: Add to Edge Function
3. **Test Thoroughly**: Verify accuracy and performance
4. **Monitor Costs**: Track usage and set alerts
5. **Optimize**: Cache, batch, selective processing

---

**Estimated Effort**: 4-6 hours for basic implementation, 1-2 days for production-ready with error handling and monitoring.

