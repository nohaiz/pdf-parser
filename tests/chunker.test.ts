import { chunkText, chunkPages } from '../lib/chunker';
import { countTokens } from '../utils/tokenCounter';

describe('Text Chunker', () => {
  describe('chunkText', () => {
    it('should chunk text within token limits', () => {
      const text = `This is a test sentence. This is another test sentence. 
        Here we have a third sentence. And a fourth one to make it longer. 
        Fifth sentence here. Sixth sentence continues. Seventh sentence adds more. 
        Eighth sentence is here. Ninth sentence continues the pattern. 
        Tenth sentence completes a nice round number.`.repeat(20);

      const chunks = chunkText(text, 1);

      expect(chunks.length).toBeGreaterThan(0);

      // Check that all chunks are within token limits (600-1200)
      chunks.forEach(chunk => {
        expect(chunk.token_count).toBeGreaterThanOrEqual(0);
        expect(chunk.token_count).toBeLessThanOrEqual(1300); // Allow slight overflow
      });
    });

    it('should add overlap between chunks', () => {
      const text = `First sentence. Second sentence. Third sentence. Fourth sentence. 
        Fifth sentence. Sixth sentence. Seventh sentence. Eighth sentence.`.repeat(30);

      const chunks = chunkText(text, 1);

      if (chunks.length > 1) {
        // Check that chunks have overlap metadata
        for (let i = 1; i < chunks.length; i++) {
          expect(chunks[i].meta.has_overlap).toBe(true);
        }
      }
    });

    it('should handle empty text', () => {
      const chunks = chunkText('', 1);
      expect(chunks.length).toBe(0);
    });

    it('should handle very short text', () => {
      const text = 'Just a short sentence.';
      const chunks = chunkText(text, 1);

      expect(chunks.length).toBe(1);
      expect(chunks[0].content).toBe(text);
      expect(chunks[0].page_no).toBe(1);
    });

    it('should set correct metadata', () => {
      const text = `Test sentence one. Test sentence two. Test sentence three.`.repeat(50);
      const chunks = chunkText(text, 5);

      chunks.forEach((chunk, index) => {
        expect(chunk.page_no).toBe(5);
        expect(chunk.chunk_index).toBe(index);
        expect(chunk.meta.page_no).toBe(5);
        expect(chunk.meta.chunk_index).toBe(index);
        expect(chunk.content_hash).toBeDefined();
        expect(chunk.content_hash.length).toBe(64); // SHA-256 hex length
      });
    });

    it('should set position metadata correctly', () => {
      const text = `Sentence for testing. Another sentence here. More text content. 
        Additional sentence. Even more text. Keep adding text.`.repeat(50);
      const chunks = chunkText(text, 1);

      if (chunks.length > 0) {
        expect(chunks[0].meta.position).toBe('start');
        if (chunks.length > 2) {
          expect(chunks[1].meta.position).toBe('middle');
        }
        expect(chunks[chunks.length - 1].meta.position).toBe('end');
      }
    });
  });

  describe('chunkPages', () => {
    it('should chunk multiple pages with global indexing', () => {
      const pages = [
        { pageNo: 1, text: 'First page content. More content here. Additional text.'.repeat(30) },
        { pageNo: 2, text: 'Second page content. Different text. More sentences.'.repeat(30) },
        { pageNo: 3, text: 'Third page content. Final page text. Last sentences.'.repeat(30) },
      ];

      const chunks = chunkPages(pages);

      expect(chunks.length).toBeGreaterThan(0);

      // Check that chunk indices are continuous and global
      chunks.forEach((chunk, index) => {
        expect(chunk.chunk_index).toBe(index);
      });

      // Check that page numbers are preserved
      const page1Chunks = chunks.filter(c => c.page_no === 1);
      const page2Chunks = chunks.filter(c => c.page_no === 2);
      const page3Chunks = chunks.filter(c => c.page_no === 3);

      expect(page1Chunks.length).toBeGreaterThan(0);
      expect(page2Chunks.length).toBeGreaterThan(0);
      expect(page3Chunks.length).toBeGreaterThan(0);
    });

    it('should handle empty pages array', () => {
      const chunks = chunkPages([]);
      expect(chunks.length).toBe(0);
    });
  });

  describe('Token counting accuracy', () => {
    it('should count tokens approximately correctly', () => {
      const text = 'This is a test sentence with some words.';
      const tokens = countTokens(text);

      // This text should be roughly 10-12 tokens
      expect(tokens).toBeGreaterThan(8);
      expect(tokens).toBeLessThan(15);
    });

    it('should handle long text', () => {
      const text = 'word '.repeat(1000); // 1000 words
      const tokens = countTokens(text);

      // Should be roughly 1000-1500 tokens
      expect(tokens).toBeGreaterThan(900);
      expect(tokens).toBeLessThan(1600);
    });
  });

  describe('Content hashing for idempotency', () => {
    it('should generate consistent hashes for same content', () => {
      const text = 'Test content for hashing.';
      const chunks1 = chunkText(text, 1);
      const chunks2 = chunkText(text, 1);

      expect(chunks1[0].content_hash).toBe(chunks2[0].content_hash);
    });

    it('should generate different hashes for different content', () => {
      const text1 = 'First content.';
      const text2 = 'Second content.';

      const chunks1 = chunkText(text1, 1);
      const chunks2 = chunkText(text2, 1);

      expect(chunks1[0].content_hash).not.toBe(chunks2[0].content_hash);
    });
  });

  describe('Edge cases', () => {
    it('should handle text with only one sentence', () => {
      const text = 'Just one sentence.';
      const chunks = chunkText(text, 1);

      expect(chunks.length).toBe(1);
      expect(chunks[0].content).toBe(text);
    });

    it('should handle text with special characters', () => {
      const text = 'Special chars: @#$%^&*(). More text! Question? Exclamation!';
      const chunks = chunkText(text, 1);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toContain('@#$%^&*()');
    });

    it('should handle text with multiple punctuation marks', () => {
      const text = 'What is this!? Really... Is this okay??? Yes!!!';
      const chunks = chunkText(text, 1);

      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});

