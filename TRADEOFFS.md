# Design Trade-offs and Decisions

This document explains the key architectural decisions, trade-offs considered, and rationale behind the PDF Parser implementation.

## 1. Chunking Strategy

### Decision: Sentence-Boundary Aware Chunking

**Alternatives Considered**:
1. **Fixed-size chunking** (e.g., every 1000 characters)
2. **Paragraph-based chunking**
3. **Sliding window with fixed overlap**
4. **Semantic chunking** (ML-based topic detection)

**Why Sentence-Boundary**:
- ✅ Preserves semantic meaning (doesn't cut mid-sentence)
- ✅ Flexible enough to handle various document structures
- ✅ Simple to implement without ML dependencies
- ✅ Good balance between precision and context
- ❌ Can create variable-sized chunks (but within acceptable range)

**Trade-off**: Slightly more complex than fixed-size, but significantly better for downstream tasks (search, embeddings, Q&A).

---

## 2. Token Count Target: 600-1200 tokens

### Decision: 600-1200 token range per chunk

**Alternatives Considered**:
- 256-512 tokens (smaller, more precise)
- 1500-2000 tokens (larger, more context)
- No limit (paragraph-based)

**Why 600-1200**:
- ✅ Matches common embedding model limits (1536 for OpenAI)
- ✅ Large enough to preserve context
- ✅ Small enough for precise retrieval
- ✅ Leaves room for prompt engineering (system prompts + chunk)
- ✅ Balances storage cost with retrieval quality

**Trade-off**: Larger chunks = more context but less precise search. Our range optimizes for RAG (Retrieval-Augmented Generation) use cases.

---

## 3. Overlap: 10-15%

### Decision: 10-15% overlap between consecutive chunks

**Alternatives Considered**:
- 0% overlap (no duplication)
- 25-50% overlap (high redundancy)
- Fixed token overlap (e.g., always 100 tokens)

**Why 10-15%**:
- ✅ Prevents information loss at chunk boundaries
- ✅ Minimal storage overhead (~12% increase)
- ✅ Improves context continuity for embeddings
- ✅ Catches references that span boundaries
- ❌ Slight duplication in storage and search results

**Trade-off**: Small storage cost for significant improvement in retrieval quality. Critical for cases where key information spans chunk boundaries.

---

## 4. Idempotency: Content Hash + Unique Constraint

### Decision: SHA-256 hash of content with DB constraint

**Alternatives Considered**:
1. **Delete all + rewrite** (simpler, chosen initially)
2. **Upsert by hash** (more complex queries)
3. **Sequence number versioning** (keep history)
4. **No idempotency** (allow duplicates)

**Why Content Hash**:
- ✅ Simple and deterministic
- ✅ DB-enforced uniqueness (can't accidentally duplicate)
- ✅ Works even if chunk order changes
- ✅ Fast lookups (indexed hash)
- ❌ Extra 64 bytes per chunk for hash storage

**Implementation**: "Clear + Rewrite"
- Delete existing chunks for document_id before inserting new ones
- Simpler than upsert logic
- Acceptable for our use case (re-parsing is infrequent)

**Trade-off**: Storing hash uses ~64 bytes per chunk, but prevents costly duplicates and enables fast idempotency checks.

---

## 5. Token Counting: Character-based Approximation

### Decision: Simple approximation (1 token ≈ 4 characters)

**Alternatives Considered**:
1. **tiktoken library** (accurate but requires Node.js native modules)
2. **Word-based approximation** (1 token ≈ 0.75 words)
3. **GPT-3 tokenizer API** (accurate but slow, costs money)
4. **No token counting** (just character count)

**Why Simple Approximation**:
- ✅ Works in Deno Edge Functions (no native modules)
- ✅ Fast (no external dependencies)
- ✅ Sufficient accuracy for chunking (~10% error)
- ✅ No API calls or external dependencies
- ❌ Not exact for embeddings/LLM cost estimation

**When to Upgrade**:
- If using embeddings: switch to tiktoken with cl100k_base encoding
- If billing by tokens: use model-specific tokenizer
- For now: approximation is good enough for chunking

**Trade-off**: Accuracy vs. simplicity. For chunking boundaries, approximation is sufficient. For billing/embeddings, upgrade to tiktoken.

---

## 6. Search: pg_trgm Full-Text Search

### Decision: PostgreSQL trigram similarity search

**Alternatives Considered**:
1. **Basic LIKE queries** (slow, no fuzzy matching)
2. **PostgreSQL FTS (tsvector)** (good, but requires language config)
3. **Elasticsearch** (powerful but adds complexity)
4. **Vector embeddings + similarity search** (semantic but expensive)

**Why pg_trgm**:
- ✅ Built into PostgreSQL (no extra infrastructure)
- ✅ Fuzzy matching (handles typos)
- ✅ Fast with GIN indexes
- ✅ Simple to implement
- ❌ Not semantic (won't match synonyms)
- ❌ Less powerful than dedicated search engines

**Future Upgrade Path**:
- Add pgvector for semantic search
- Hybrid search: keyword (pg_trgm) + semantic (vectors)
- Keep pg_trgm for exact phrase matching

**Trade-off**: Good enough for MVP, easy to upgrade later. Avoids premature optimization.

---

## 7. Storage: Supabase Storage vs. Database BLOBs

### Decision: Store PDFs in Supabase Storage, chunks in PostgreSQL

**Alternatives Considered**:
1. **Store PDFs as BLOBs in PostgreSQL**
2. **Store chunks in separate JSON files in Storage**
3. **External S3 bucket**

**Why Supabase Storage**:
- ✅ Cheaper for large files ($0.021/GB vs. DB cost)
- ✅ Better for streaming/downloading
- ✅ Signed URLs for secure access
- ✅ Separate scaling (storage vs. DB)
- ✅ Built-in CDN

**Why PostgreSQL for Chunks**:
- ✅ Excellent for searchable text
- ✅ ACID guarantees
- ✅ RLS for security
- ✅ Powerful querying (JOIN, aggregate, full-text)
- ✅ Indexes for fast search

**Trade-off**: Two systems to manage, but optimal cost and performance for each data type.

---

## 8. Processing: Edge Function vs. Background Jobs

### Decision: Supabase Edge Function (synchronous-ish)

**Alternatives Considered**:
1. **Serverless function (AWS Lambda, Vercel)**
2. **Background job queue (BullMQ, Supabase Queue)**
3. **Client-side processing (WebAssembly PDF.js)**
4. **Dedicated worker server**

**Why Edge Function**:
- ✅ Integrated with Supabase (auth, storage, DB)
- ✅ No separate infrastructure
- ✅ Auto-scaling
- ✅ Cost-effective (pay per invocation)
- ❌ 60-second timeout (limits very large PDFs)
- ❌ Cold start latency

**When to Upgrade**:
- PDFs > 500 pages: background queue
- High concurrency: dedicated workers
- Complex ML (OCR, embeddings): GPU workers

**Trade-off**: Simplicity and cost-effectiveness vs. processing limits. Edge Functions perfect for 80% of use cases.

---

## 9. User Authentication: Demo User vs. Real Auth

### Current: Fixed demo user_id

**Why Not Real Auth (for now)**:
- ✅ Simplifies demo/testing
- ✅ Focuses on core chunking logic
- ✅ Easy to add later (just replace user_id)
- ❌ NOT production-ready
- ❌ All users share data (demo mode)

**Production Upgrade**:
```typescript
// Get user from Supabase Auth session
const { data: { user } } = await supabase.auth.getUser();
const userId = user.id;
```

**Trade-off**: Ship faster with demo, add auth later. RLS policies already in place, just need to connect real users.

---

## 10. Polling vs. WebSockets for Status Updates

### Decision: HTTP polling every 2 seconds

**Alternatives Considered**:
1. **WebSockets (real-time)**
2. **Server-Sent Events (SSE)**
3. **Long polling**
4. **Webhook callbacks**

**Why Polling**:
- ✅ Simple to implement
- ✅ Works everywhere (no WebSocket compatibility issues)
- ✅ Stateless (no connection management)
- ✅ Sufficient for our use case (processing takes ~30s)
- ❌ Not true real-time
- ❌ More API calls (but minimal with 2s interval)

**When to Upgrade**:
- High user count: WebSockets or SSE
- Real-time dashboard: WebSockets
- For now: polling is fine (processing is relatively slow anyway)

**Trade-off**: Simplicity vs. real-time. Polling adds negligible load for our scale.

---

## 11. OCR: Not Implemented (Documented Approach)

### Decision: Detect but don't process image-only pages

**Why Not Implement OCR**:
- ⏱️ Time-boxed project (4-6 hours)
- 💰 OCR APIs cost money or are slow
- 🎯 Core focus was chunking, not OCR
- 📝 Documented approach for future implementation

**Recommended Approach** (when needed):
1. **Detect**: `if (pageText.length < 10) { /* image-only */ }`
2. **Tesseract.js** for MVP (free, open-source)
3. **Cloud OCR** for production (Google Vision, AWS Textract)

**Trade-off**: Shipped core functionality faster, OCR is an additive feature.

---

## 12. Testing: Unit Tests for Chunker Only

### Decision: Comprehensive unit tests, documented integration tests

**What's Tested**:
- ✅ Chunking logic (boundaries, overlap, tokens)
- ✅ Edge cases (empty, special chars, single sentence)
- ✅ Token counting accuracy
- ✅ Content hashing

**What's Not Tested (yet)**:
- ❌ API routes (integration tests)
- ❌ Edge Function (E2E tests)
- ❌ UI components (React testing)

**Why This Approach**:
- ✅ Chunker is the most critical logic (deserves thorough testing)
- ✅ Pure functions are easy to test
- ✅ Integration tests documented in README (manual testing)
- ⏱️ Time-boxed project

**Future Testing**:
- Add Playwright for E2E
- Add MSW for API mocking
- Add Supabase local dev for integration tests

**Trade-off**: Focus testing effort on highest-value, most complex logic.

---

## Summary: Key Trade-offs

| Decision | Simplicity | Performance | Cost | Maintainability |
|----------|-----------|-------------|------|-----------------|
| Sentence-boundary chunking | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 600-1200 token chunks | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Content hash idempotency | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Character-based tokens | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| pg_trgm search | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Edge Functions | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| HTTP polling | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

**Overall Philosophy**: Ship a working, well-architected MVP fast. Each decision has a clear upgrade path for when scale demands it.

---

## What I'd Do Differently at Scale

### At 1,000+ users:
- Add WebSocket for real-time updates
- Implement caching (Redis) for frequent searches
- Add rate limiting and quotas
- Use tiktoken for accurate token counts

### At 10,000+ users:
- Background job queue for processing
- Dedicated workers with GPUs (for OCR/embeddings)
- Elasticsearch or Algolia for search
- CDN for PDF downloads
- Comprehensive monitoring (Datadog, Sentry)

### At 100,000+ users:
- Microservices architecture
- Separate DB for chunks (time-series DB?)
- Vector DB for semantic search (Pinecone, Weaviate)
- Multi-region deployment
- Auto-scaling worker pools

---

**The beauty of this architecture**: It works great now, and there's a clear path to scale. No premature optimization, but also no dead ends.

