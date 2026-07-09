/**
 * Client-side PDF and study-material text extraction + chunking.
 */

import * as pdfjs from 'pdfjs-dist';
import type { DocumentChunk } from '../types';

// Vite-friendly worker URL for pdf.js
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const MAX_PDF_PAGES = 80;
const MAX_TEXT_CHARS = 160_000;
/** Smaller chunks improve RAG precision for quiz + Q&A. */
const CHUNK_TARGET_CHARS = 900;
const CHUNK_OVERLAP_CHARS = 120;
const MAX_CHUNKS = 120;

export type ExtractedDocument = {
  text: string;
  pageCount: number;
  truncated: boolean;
  source: 'pdf' | 'text' | 'empty';
  warning?: string;
  /** Page-aware raw segments used for better chunk sourceRefs */
  pageTexts?: { page: number; text: string }[];
  chunks: DocumentChunk[];
};

function truncateText(text: string): { text: string; truncated: boolean } {
  const clean = text
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (clean.length <= MAX_TEXT_CHARS) {
    return { text: clean, truncated: false };
  }
  return {
    text: `${clean.slice(0, MAX_TEXT_CHARS)}\n\n[... content truncated for model context ...]`,
    truncated: true,
  };
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\u0000/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Split long study text into overlapping chunks suitable for grounded AI prompts.
 * Prefers paragraph / sentence boundaries when possible.
 */
export function chunkDocumentText(
  text: string,
  options?: {
    targetChars?: number;
    overlapChars?: number;
    maxChunks?: number;
    pageTexts?: { page: number; text: string }[];
  },
): DocumentChunk[] {
  const target = options?.targetChars ?? CHUNK_TARGET_CHARS;
  const overlap = options?.overlapChars ?? CHUNK_OVERLAP_CHARS;
  const maxChunks = options?.maxChunks ?? MAX_CHUNKS;
  const cleaned = normalizeWhitespace(text || '');
  if (!cleaned) return [];

  // Prefer page-aware chunking when we have per-page text
  if (options?.pageTexts?.length) {
    const chunks: DocumentChunk[] = [];
    let globalIndex = 0;
    for (const page of options.pageTexts) {
      const pageClean = normalizeWhitespace(page.text);
      if (!pageClean) continue;
      if (pageClean.length <= target) {
        chunks.push({
          id: `chunk_${globalIndex}`,
          index: globalIndex,
          text: pageClean,
          sourceRef: `Page ${page.page}`,
          charCount: pageClean.length,
        });
        globalIndex += 1;
        if (chunks.length >= maxChunks) break;
        continue;
      }
      const sub = splitBySize(pageClean, target, overlap);
      for (const part of sub) {
        chunks.push({
          id: `chunk_${globalIndex}`,
          index: globalIndex,
          text: part,
          sourceRef: `Page ${page.page}`,
          charCount: part.length,
        });
        globalIndex += 1;
        if (chunks.length >= maxChunks) break;
      }
      if (chunks.length >= maxChunks) break;
    }
    return chunks;
  }

  const parts = splitBySize(cleaned, target, overlap).slice(0, maxChunks);
  return parts.map((part, index) => ({
    id: `chunk_${index}`,
    index,
    text: part,
    sourceRef: `Section ${index + 1}`,
    charCount: part.length,
  }));
}

function splitBySize(text: string, target: number, overlap: number): string[] {
  if (text.length <= target) return [text];

  const parts: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + target, text.length);
    if (end < text.length) {
      // Prefer break at paragraph, then sentence, then space
      const window = text.slice(start, end);
      const paraBreak = window.lastIndexOf('\n\n');
      const sentenceBreak = Math.max(
        window.lastIndexOf('. '),
        window.lastIndexOf('? '),
        window.lastIndexOf('! '),
      );
      const spaceBreak = window.lastIndexOf(' ');
      let rel = -1;
      if (paraBreak > target * 0.4) rel = paraBreak + 2;
      else if (sentenceBreak > target * 0.4) rel = sentenceBreak + 2;
      else if (spaceBreak > target * 0.4) rel = spaceBreak + 1;
      if (rel > 0) end = start + rel;
    }
    const slice = text.slice(start, end).trim();
    if (slice) parts.push(slice);
    if (end >= text.length) break;
    start = Math.max(0, end - overlap);
    // Prevent infinite loop on pathological input
    if (parts.length > MAX_CHUNKS + 5) break;
  }
  return parts;
}

/**
 * Build a compact context string from chunks for AI prompts (summary / quiz).
 */
export function buildChunkContext(
  chunks: DocumentChunk[],
  maxChars = 14_000,
  maxChunks = 18,
): string {
  if (!chunks.length) return '';
  const selected = chunks.slice(0, maxChunks);
  const parts: string[] = [];
  let used = 0;
  for (const chunk of selected) {
    const block = `[${chunk.sourceRef} | chunk ${chunk.index + 1}]\n${chunk.text}`;
    if (used + block.length > maxChars && parts.length > 0) break;
    parts.push(block);
    used += block.length + 2;
  }
  return parts.join('\n\n');
}

async function extractPdfText(data: ArrayBuffer): Promise<ExtractedDocument> {
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data) });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  const pagesToRead = Math.min(pageCount, MAX_PDF_PAGES);
  const parts: string[] = [];
  const pageTexts: { page: number; text: string }[] = [];

  for (let pageNum = 1; pageNum <= pagesToRead; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageText) {
      parts.push(`--- Page ${pageNum} ---\n${pageText}`);
      pageTexts.push({ page: pageNum, text: pageText });
    }
  }

  const joined = parts.join('\n\n');
  const { text, truncated } = truncateText(joined);
  const extraTruncated = pageCount > MAX_PDF_PAGES;
  let warning: string | undefined;
  if (!text) {
    warning = 'PDF opened but no extractable text was found (it may be a scanned image PDF).';
  } else if (extraTruncated || truncated) {
    warning = `Only the first ${pagesToRead} page(s) / ${MAX_TEXT_CHARS} characters were indexed for AI context.`;
  }

  const chunks = chunkDocumentText(text, { pageTexts });

  return {
    text,
    pageCount,
    truncated: truncated || extraTruncated,
    source: 'pdf',
    warning,
    pageTexts,
    chunks,
  };
}

/**
 * Extract readable text from an uploaded study file (PDF, text, markdown, CSV).
 */
export async function extractTextFromFile(file: File): Promise<ExtractedDocument> {
  const name = file.name.toLowerCase();
  const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');
  const isTextLike =
    file.type.startsWith('text/') ||
    name.endsWith('.md') ||
    name.endsWith('.txt') ||
    name.endsWith('.csv') ||
    name.endsWith('.json') ||
    name.endsWith('.html');

  if (isPdf) {
    try {
      const buffer = await file.arrayBuffer();
      return await extractPdfText(buffer);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        text: '',
        pageCount: 0,
        truncated: false,
        source: 'pdf',
        warning: `Failed to read PDF: ${msg}`,
        chunks: [],
      };
    }
  }

  if (isTextLike) {
    try {
      const raw = await file.text();
      const { text, truncated } = truncateText(raw);
      const chunks = chunkDocumentText(text);
      return {
        text,
        pageCount: 1,
        truncated,
        source: 'text',
        warning: truncated ? 'Text was truncated for model context limits.' : undefined,
        chunks,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        text: '',
        pageCount: 0,
        truncated: false,
        source: 'text',
        warning: `Failed to read text file: ${msg}`,
        chunks: [],
      };
    }
  }

  // Binary slides/images: no client-side OCR in this build
  return {
    text: '',
    pageCount: 0,
    truncated: false,
    source: 'empty',
    warning:
      name.endsWith('.ppt') || name.endsWith('.pptx')
        ? 'PowerPoint files are stored, but text extraction is limited. Paste key notes in the summary field for AI grounding.'
        : 'This file type has no extractable text. Add a summary so the AI can still use it.',
    chunks: [],
  };
}
