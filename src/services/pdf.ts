/**
 * Client-side PDF and study-material text extraction.
 */

import * as pdfjs from 'pdfjs-dist';

// Vite-friendly worker URL for pdf.js
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const MAX_PDF_PAGES = 40;
const MAX_TEXT_CHARS = 80_000;

export type ExtractedDocument = {
  text: string;
  pageCount: number;
  truncated: boolean;
  source: 'pdf' | 'text' | 'empty';
  warning?: string;
};

function truncateText(text: string): { text: string; truncated: boolean } {
  const clean = text.replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (clean.length <= MAX_TEXT_CHARS) {
    return { text: clean, truncated: false };
  }
  return {
    text: `${clean.slice(0, MAX_TEXT_CHARS)}\n\n[... content truncated for model context ...]`,
    truncated: true,
  };
}

async function extractPdfText(data: ArrayBuffer): Promise<ExtractedDocument> {
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(data) });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;
  const pagesToRead = Math.min(pageCount, MAX_PDF_PAGES);
  const parts: string[] = [];

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

  return {
    text,
    pageCount,
    truncated: truncated || extraTruncated,
    source: 'pdf',
    warning,
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
      };
    }
  }

  if (isTextLike) {
    try {
      const raw = await file.text();
      const { text, truncated } = truncateText(raw);
      return {
        text,
        pageCount: 1,
        truncated,
        source: 'text',
        warning: truncated ? 'Text was truncated for model context limits.' : undefined,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return {
        text: '',
        pageCount: 0,
        truncated: false,
        source: 'text',
        warning: `Failed to read text file: ${msg}`,
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
  };
}
