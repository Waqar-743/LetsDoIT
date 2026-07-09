/**
 * Lightweight RAG (retrieve-augmented generation) for course materials.
 * Keyword / lexical retrieval over document chunks — no external embedding API required.
 */

import type { CourseMaterial, DocumentChunk } from '../types';
import { buildChunkContext, chunkDocumentText } from './pdf';

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
  'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that',
  'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which',
  'who', 'whom', 'how', 'when', 'where', 'why', 'from', 'into', 'about', 'as', 'by',
  'not', 'no', 'yes', 'if', 'then', 'than', 'so', 'such', 'also', 'just', 'only',
  'please', 'explain', 'describe', 'tell', 'me', 'my', 'your', 'our', 'their',
]);

export type RankedChunk = DocumentChunk & {
  score: number;
  materialId?: string;
  materialTitle?: string;
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06ff\s-]/gi, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function termFreq(tokens: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokens) m.set(t, (m.get(t) || 0) + 1);
  return m;
}

/**
 * Score a chunk against a query using lexical overlap + TF boost + phrase bonus.
 */
export function scoreChunk(query: string, chunk: DocumentChunk): number {
  const qTokens = tokenize(query);
  if (!qTokens.length) return 0;
  const cTokens = tokenize(chunk.text);
  if (!cTokens.length) return 0;

  const qSet = new Set(qTokens);
  const cTf = termFreq(cTokens);
  let score = 0;
  let hits = 0;

  for (const t of qSet) {
    const tf = cTf.get(t) || 0;
    if (tf > 0) {
      hits += 1;
      // log TF dampening
      score += 1 + Math.log(1 + tf);
    }
  }

  // Coverage: fraction of unique query terms present
  const coverage = hits / qSet.size;
  score *= 0.5 + coverage;

  // Exact multi-word phrase bonus
  const lower = chunk.text.toLowerCase();
  const qLower = query.toLowerCase().trim();
  if (qLower.length > 8 && lower.includes(qLower.slice(0, Math.min(48, qLower.length)))) {
    score += 2.5;
  }

  // Prefer mid-length informative chunks slightly
  if (chunk.charCount > 200 && chunk.charCount < 2500) score *= 1.05;

  return score;
}

/**
 * Retrieve top-k relevant chunks for a user question from one material's index.
 */
export function retrieveFromMaterial(
  query: string,
  material: CourseMaterial,
  topK = 6,
): RankedChunk[] {
  const chunks = ensureMaterialChunks(material);
  if (!chunks.length) return [];

  const ranked: RankedChunk[] = chunks
    .map((chunk) => ({
      ...chunk,
      score: scoreChunk(query, chunk),
      materialId: material.id,
      materialTitle: material.title,
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  // If nothing matched keywords, fall back to first chunks (document head)
  if (!ranked.length) {
    return chunks.slice(0, topK).map((chunk, i) => ({
      ...chunk,
      score: 0.01 * (topK - i),
      materialId: material.id,
      materialTitle: material.title,
    }));
  }

  return ranked.slice(0, topK);
}

/**
 * Course-wide RAG: search all materials (optionally limited to joined course IDs).
 */
export function retrieveFromMaterials(
  query: string,
  materials: CourseMaterial[],
  options?: { topK?: number; courseIds?: string[] },
): RankedChunk[] {
  const topK = options?.topK ?? 8;
  const filtered = options?.courseIds?.length
    ? materials.filter((m) => options.courseIds!.includes(m.courseId))
    : materials;

  const all: RankedChunk[] = [];
  for (const material of filtered) {
    const hits = retrieveFromMaterial(query, material, Math.max(3, Math.ceil(topK / 2)));
    all.push(...hits);
  }

  all.sort((a, b) => b.score - a.score);
  // Diversify: max 3 chunks per material in final set
  const out: RankedChunk[] = [];
  const perMaterial = new Map<string, number>();
  for (const hit of all) {
    const mid = hit.materialId || 'unknown';
    const count = perMaterial.get(mid) || 0;
    if (count >= 3) continue;
    perMaterial.set(mid, count + 1);
    out.push(hit);
    if (out.length >= topK) break;
  }

  return out;
}

export function ensureMaterialChunks(material: CourseMaterial): DocumentChunk[] {
  if (material.chunks?.length) return material.chunks;
  const text = material.contentText || material.contentSummary || '';
  return chunkDocumentText(text);
}

/**
 * Build a grounded prompt context block for the model from ranked chunks.
 */
export function formatRagContext(
  ranked: RankedChunk[],
  maxChars = 10_000,
): string {
  if (!ranked.length) return '';
  // Convert to DocumentChunk-like for buildChunkContext-style layout
  const asChunks: DocumentChunk[] = ranked.map((r, i) => ({
    id: r.id || `rag_${i}`,
    index: r.index ?? i,
    text: r.text,
    sourceRef: r.materialTitle
      ? `${r.materialTitle} · ${r.sourceRef}`
      : r.sourceRef,
    charCount: r.charCount || r.text.length,
  }));
  return buildChunkContext(asChunks, maxChars, ranked.length);
}

/**
 * Full RAG answer context for student/teacher chat.
 */
export function buildRagAnswerContext(options: {
  userQuestion: string;
  selectedMaterial?: CourseMaterial | null;
  courseMaterials?: CourseMaterial[];
  courseIds?: string[];
  maxChars?: number;
}): {
  context: string;
  usedChunks: RankedChunk[];
  mode: 'material' | 'course' | 'none';
} {
  const maxChars = options.maxChars ?? 10_000;
  const q = options.userQuestion.trim();

  if (options.selectedMaterial) {
    const ranked = retrieveFromMaterial(q, options.selectedMaterial, 8);
    // Always include summary + important points for grounding
    const meta = [
      `Material: ${options.selectedMaterial.title}`,
      options.selectedMaterial.contentSummary
        ? `Teacher/AI summary: ${options.selectedMaterial.contentSummary}`
        : '',
      options.selectedMaterial.importantPoints?.length
        ? `Important points:\n${options.selectedMaterial.importantPoints.map((p) => `- ${p}`).join('\n')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
    const body = formatRagContext(ranked, maxChars - meta.length - 40);
    return {
      context: `${meta}\n\nRetrieved source passages (use these to answer):\n${body}`,
      usedChunks: ranked,
      mode: 'material',
    };
  }

  if (options.courseMaterials?.length) {
    const ranked = retrieveFromMaterials(q, options.courseMaterials, {
      topK: 8,
      courseIds: options.courseIds,
    });
    if (ranked.length) {
      return {
        context: `Retrieved passages from enrolled course materials:\n${formatRagContext(ranked, maxChars)}`,
        usedChunks: ranked,
        mode: 'course',
      };
    }
  }

  return { context: '', usedChunks: [], mode: 'none' };
}

/**
 * Select diverse chunks for quiz generation (spread across document).
 */
export function selectQuizChunks(material: CourseMaterial, maxChunks = 14): DocumentChunk[] {
  const chunks = ensureMaterialChunks(material);
  if (chunks.length <= maxChunks) return chunks;

  // Evenly sample across the document for coverage
  const step = chunks.length / maxChunks;
  const picked: DocumentChunk[] = [];
  for (let i = 0; i < maxChunks; i += 1) {
    const idx = Math.min(chunks.length - 1, Math.floor(i * step));
    const c = chunks[idx];
    if (!picked.some((p) => p.id === c.id)) picked.push(c);
  }
  // Fill remaining with highest-content chunks
  if (picked.length < maxChunks) {
    const rest = [...chunks]
      .sort((a, b) => b.charCount - a.charCount)
      .filter((c) => !picked.some((p) => p.id === c.id));
    for (const c of rest) {
      picked.push(c);
      if (picked.length >= maxChunks) break;
    }
  }
  return picked;
}
