# Deployment Guide

This guide walks you through deploying the PDF Parser application step-by-step.

## Prerequisites Checklist

- [ ] Node.js 18+ installed
- [ ] npm or yarn installed
- [ ] Supabase CLI installed (`npm install -g supabase`)
- [ ] Git installed (for version control)
- [ ] Vercel account (for hosting) - optional but recommended

## Step-by-Step Deployment

### Phase 1: Supabase Setup (Manual - ~10 minutes)

#### 1.1 Create Supabase Project

1. Visit [https://supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in:
   - **Organization**: Select or create one
   - **Project Name**: `pdf-parser` (or your preference)
   - **Database Password**: Generate a strong password and SAVE IT
   - **Region**: Choose closest to your users
   - **Pricing Plan**: Free tier works fine
4. Click "Create new project"
5. Wait ~2 minutes for provisioning

#### 1.2 Get Your Credentials

1. Go to **Settings** > **API**
2. Copy these values (you'll need them soon):
   ```
   Project URL: https://xxxxx.supabase.co
   anon/public key: eyJhb...
   service_role key: eyJhb... (SECRET - never commit!)
   ```
3. Keep this tab open

#### 1.3 Create Storage Bucket

1. Go to **Storage** (left sidebar)
2. Click **"New bucket"**
3. Settings:
   - **Name**: `pdf-documents`
   - **Public**: ❌ NO (keep it private!)
   - **File size limit**: 100 MB (or higher if needed)
4. Click **"Create bucket"**

### Phase 2: Local Setup

#### 2.1 Clone and Install Dependencies

```bash
cd supa-pdf-parser
npm install
```

#### 2.2 Configure Environment Variables

Create `.env.local` file:

```bash
# Replace with YOUR values from Step 1.2
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...your-service-role-key
NEXT_PUBLIC_STORAGE_BUCKET=pdf-documents
```

**⚠️ Important**: NEVER commit `.env.local` to git!

#### 2.3 Link to Supabase Project

```bash
# Login to Supabase CLI
supabase login

# Get your project ref from the Project URL
# Example: https://abcdefg.supabase.co → project ref is "abcdefg"

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF
```

### Phase 3: Database Setup (Manual - ~5 minutes)

#### 3.1 Deploy Database Schema

**Option A: Using Supabase CLI (Recommended)**

```bash
supabase db push
```

This will apply `supabase/migrations/001_initial_schema.sql` to your database.

**Option B: Manual SQL Execution**

1. Open Supabase Dashboard
2. Go to **SQL Editor** (left sidebar)
3. Click **"New query"**
4. Copy entire contents of `supabase/migrations/001_initial_schema.sql`
5. Paste and click **"Run"**

#### 3.2 Verify Schema

1. Go to **Table Editor** in Supabase Dashboard
2. You should see:
   - `documents` table
   - `doc_chunks` table
3. Click on each table to verify columns

#### 3.3 Verify RLS Policies

1. Go to **Authentication** > **Policies**
2. You should see policies for:
   - documents (4 policies: SELECT, INSERT, UPDATE, DELETE)
   - doc_chunks (4 policies: SELECT, INSERT, UPDATE, DELETE)

### Phase 4: Edge Function Deployment (Manual - ~5 minutes)

#### 4.1 Deploy the Parse PDF Function

```bash
supabase functions deploy parse-pdf
```

Wait for deployment to complete. You should see:
```
Deployed Function parse-pdf in 15s
```

#### 4.2 Set Edge Function Secrets

```bash
# Set environment variables for the Edge Function
supabase secrets set SUPABASE_URL=https://xxxxx.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...your-service-role-key
supabase secrets set STORAGE_BUCKET=pdf-documents
```

#### 4.3 Verify Edge Function

Test the function is deployed:

```bash
supabase functions list
```

You should see `parse-pdf` in the list.

### Phase 5: Local Testing

#### 5.1 Start Development Server

```bash
npm run dev
```

#### 5.2 Test the Application

1. Open [http://localhost:3000](http://localhost:3000)
2. Download a test PDF:
   - Small test: [Constitution PDF](https://www.archives.gov/founding-docs/constitution-transcript)
   - Large test: [Tesla 10-K Report](https://ir.tesla.com/)
3. Upload the PDF
4. Verify:
   - Upload succeeds
   - Status shows "Processing"
   - Status changes to "Ready"
   - Statistics are displayed
   - Sample chunks appear
   - Search works

### Phase 6: Production Deployment (Manual - ~10 minutes)

#### 6.1 Deploy to Vercel (Recommended)

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm install -g vercel
   ```

2. **Deploy**:
   ```bash
   vercel
   ```

3. **Follow prompts**:
   - Link to existing project? → No (first time)
   - What's your project name? → `supa-pdf-parser`
   - Which directory is your code? → `.`
   - Override settings? → No

4. **Wait for deployment** (~2 minutes)

5. **Set Environment Variables**:
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   # Paste your value, select Production, press Enter
   
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   # Paste your value, select Production, press Enter
   
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   # Paste your value, select Production, press Enter
   
   vercel env add NEXT_PUBLIC_STORAGE_BUCKET
   # Type: pdf-documents, select Production, press Enter
   ```

6. **Redeploy with environment variables**:
   ```bash
   vercel --prod
   ```

7. **Access your app**:
   - Vercel will give you a URL like `https://supa-pdf-parser.vercel.app`
   - Open it and test!

#### 6.2 Alternative: Deploy to Other Platforms

**Netlify**:
```bash
npm run build
# Upload .next folder to Netlify
# Set environment variables in Netlify dashboard
```

**Railway**:
- Connect your GitHub repo
- Set environment variables in Railway dashboard
- Railway auto-deploys on push

**Self-hosted**:
```bash
npm run build
npm start
```

### Phase 7: Post-Deployment Verification

#### 7.1 Smoke Test

1. Upload a PDF
2. Verify processing completes
3. Check Supabase logs:
   - Go to **Functions** > **Logs** (check for errors)
   - Go to **Database** > **Logs** (check for RLS issues)

#### 7.2 Monitor Performance

1. **Supabase Dashboard**:
   - Database size (should grow with chunks)
   - Storage usage (should grow with PDFs)
   - Edge Function invocations

2. **Vercel Dashboard** (if using Vercel):
   - Response times
   - Error rates
   - Build logs

### Troubleshooting

#### Issue: Edge Function times out

**Solution**: 
- Check function logs: `supabase functions logs parse-pdf`
- Reduce PDF size or page count
- Consider background processing for large PDFs

#### Issue: RLS policy errors

**Solution**:
- Verify policies are created: `supabase db pull`
- Check user_id matches in database
- For testing, you can temporarily disable RLS (NOT recommended for production)

#### Issue: Storage upload fails

**Solution**:
- Verify bucket name matches environment variable
- Check bucket is private (not public)
- Verify file size is under limit

#### Issue: Can't connect to Supabase

**Solution**:
- Check environment variables are set correctly
- Verify Supabase project is active (not paused)
- Check network/firewall settings

## Maintenance

### Regular Tasks

1. **Monitor Storage**: Supabase free tier has 1GB storage limit
2. **Check Logs**: Review Edge Function logs weekly
3. **Update Dependencies**: `npm update` monthly
4. **Backup Database**: Supabase auto-backups, but verify

### Scaling Considerations

As usage grows:
- Upgrade Supabase plan (more storage, bandwidth, edge function time)
- Add caching (Redis) for frequent searches
- Implement rate limiting
- Add monitoring (Sentry, LogRocket)

## Cost Estimation (Supabase Free Tier)

- **Storage**: 1 GB included
  - ~100 PDFs at 10MB each
- **Database**: 500 MB included
  - ~50K chunks at 1KB each
- **Bandwidth**: 2 GB included
  - ~200 PDF downloads
- **Edge Functions**: 500K invocations
  - ~500K PDF parses

After free tier:
- Storage: $0.021/GB/month
- Bandwidth: $0.09/GB
- Edge Functions: $2 per 1M invocations

## Security Checklist

- [ ] `.env.local` is in `.gitignore`
- [ ] Service role key NEVER exposed to client
- [ ] RLS policies are active on all tables
- [ ] Storage bucket is private
- [ ] CORS is configured for Edge Functions
- [ ] File size limits are enforced

## Next Steps

- [ ] Set up monitoring (Sentry, Datadog)
- [ ] Add user authentication (Supabase Auth)
- [ ] Implement rate limiting
- [ ] Add webhook notifications
- [ ] Set up CI/CD pipeline
- [ ] Add OCR for image-based PDFs

---

**Deployment Complete! 🎉**

Your PDF Parser is now live and ready to process documents!

