import {
  AIMode,
  AIProviderResult,
  CourseMaterial,
  DocumentChunk,
  LanguageStyle,
  LocalModelState,
  MistakeType,
  PracticeQuestion,
  PracticeSet,
  Quiz,
  QuizQuestion,
} from '../types';
import { invoke } from '@tauri-apps/api/core';
import { loadAICache, saveAICache } from './desktop';
import { robustFetch } from './http';
import { buildChunkContext, chunkDocumentText } from './pdf';
import {
  buildRagAnswerContext,
  ensureMaterialChunks,
  formatRagContext,
  selectQuizChunks,
} from './rag';

type QuizRequest = {
  courseId: string;
  title: string;
  material: CourseMaterial;
  difficulty: Quiz['difficulty'];
  questionType: Quiz['questionType'];
  isTestMode: boolean;
  timeLimit: number;
};

type DiagnosisRequest = {
  question: QuizQuestion;
  studentAnswer: string;
};

const CACHE_KEY = 'letsdoit_ai_cache_v3';
const SETTINGS_KEY = 'letsdoit_ai_settings_v2';

const readLocalCache = (): Record<string, AIProviderResult> => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
};

const writeLocalCache = (cache: Record<string, AIProviderResult>) => {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
};

const loadCache = async (): Promise<Record<string, AIProviderResult>> => {
  try {
    const diskCache = await loadAICache();
    if (diskCache) return diskCache;
  } catch {
    // fall through to localStorage
  }
  return readLocalCache();
};

const persistCache = async (cache: Record<string, AIProviderResult>) => {
  writeLocalCache(cache);
  try {
    await saveAICache(cache);
  } catch {
    // localStorage write already succeeded
  }
};

export const hashContent = async (input: string): Promise<string> => {
  const normalized = input.trim().toLowerCase();
  if ('crypto' in window && window.crypto.subtle) {
    const bytes = new TextEncoder().encode(normalized);
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `fallback_${Math.abs(hash)}`;
};

const compact = (text: string, max = 680) => {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}...` : clean;
};

const extractConcepts = (material: CourseMaterial) => {
  const text = `${material.title}. ${material.contentSummary}. ${material.contentText || ''}`;
  const seeds = [
    'Core concept',
    'Applied method',
    'Common mistake',
    'Assessment skill',
    'Local classroom use',
  ];
  const words = text
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 5)
    .slice(0, 16);

  return seeds.map((seed, index) => ({
    concept: words[index * 2] ? `${seed}: ${words[index * 2]}` : seed,
    summary: compact(`${seed} from ${material.title}: ${material.contentSummary}`, 150),
    sourceRef: `${material.fileName} section ${index + 1}`,
  }));
};

export const createLessonMap = (material: CourseMaterial) => extractConcepts(material);

/**
 * @deprecated Dummy template quizzes are disabled. Use generateQuizWithAI.
 * Kept only so old imports fail loudly instead of returning fake questions.
 */
export const generateOfflineQuiz = (_request: QuizRequest): Quiz => {
  throw new Error(
    'Template/dummy quiz generation is disabled.\n\n' +
      'Use Generate quiz / Practice Quiz with Online, Offline, or Hybrid mode so questions come from real document chunks.',
  );
};

const mistakeTypes: MistakeType[] = [
  'Conceptual gap',
  'Careless mistake',
  'Misread question',
  'Partial understanding',
];

export const diagnoseOfflineMistake = ({ question, studentAnswer }: DiagnosisRequest) => {
  const normalized = studentAnswer.trim().toLowerCase();
  const correct = question.correctAnswer.trim().toLowerCase();
  let mistakeType: MistakeType = 'Conceptual gap';

  if (!normalized) mistakeType = 'Misread question';
  else if (correct.includes(normalized) || normalized.includes(correct.split(' ')[0] || '')) {
    mistakeType = 'Partial understanding';
  } else if (question.options?.some((option) => option.toLowerCase() === normalized)) {
    mistakeType = 'Careless mistake';
  } else {
    const index = Math.abs([...question.id].reduce((sum, char) => sum + char.charCodeAt(0), 0)) % mistakeTypes.length;
    mistakeType = mistakeTypes[index];
  }

  const action =
    mistakeType === 'Conceptual gap'
      ? 'Relearn the concept with a simpler explanation, then attempt two scaffolded questions.'
      : mistakeType === 'Careless mistake'
        ? 'Repeat similar questions at the same level and check the final wording before submitting.'
        : mistakeType === 'Misread question'
          ? 'Underline the command words and compare every option against the source reference.'
          : 'Review the missing detail, then try one medium-level question on the same topic.';

  return {
    mistakeType,
    explanation: `${question.explanation} ${action}`,
  };
};

type PracticeSetRequest = {
  studentId: string;
  courseId: string;
  courseTitle: string;
  attemptId: string;
  mistakes: import('../types').QuizAttempt['diagnosis']['mistakes'];
  weakTopics: string[];
  /** Optional source material so practice is grounded in real chunks */
  material?: CourseMaterial | null;
  mode?: AIMode;
  model?: LocalModelState;
  settings?: AISettings;
  style?: LanguageStyle;
};

/**
 * @deprecated Synchronous dummy practice is disabled. Use generatePracticeSetWithAI.
 */
export const generatePracticeSet = (_request: PracticeSetRequest): PracticeSet => {
  throw new Error(
    'Dummy practice-set generation is disabled. Use generatePracticeSetWithAI with a real model.',
  );
};

function parsePracticeQuestions(raw: string, request: PracticeSetRequest): PracticeQuestion[] {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    if (!arrayMatch) throw new Error('Practice set model response was not valid JSON.');
    parsed = JSON.parse(arrayMatch[0]);
  }
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { questions?: unknown }).questions)
      ? (parsed as { questions: unknown[] }).questions
      : [];
  if (!list.length) throw new Error('Model returned no practice questions.');

  const out: PracticeQuestion[] = [];
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i] as Record<string, unknown>;
    const text = String(item.text || item.question || '').trim();
    const correctAnswer = String(item.correctAnswer || item.answer || '').trim();
    if (!text || !correctAnswer) continue;
    const mistakeType = (String(item.mistakeType || request.mistakes[0]?.mistakeType || 'Conceptual gap') as MistakeType);
    let options: string[] | undefined;
    if (Array.isArray(item.options)) {
      options = item.options.map((o) => String(o).trim()).filter(Boolean);
    }
    out.push({
      id: `pq_${request.attemptId}_${i}`,
      text,
      hint: String(item.hint || 'Re-read the related source passage carefully.').trim(),
      options,
      correctAnswer,
      explanation: String(item.explanation || 'Review the source material on this topic.').trim(),
      topicTag: String(item.topicTag || item.topic || request.weakTopics[0] || 'Practice').trim(),
      mistakeType: (['Conceptual gap', 'Careless mistake', 'Misread question', 'Partial understanding'].includes(mistakeType)
        ? mistakeType
        : 'Conceptual gap') as MistakeType,
    });
  }
  if (!out.length) throw new Error('Model returned practice items but none were valid.');
  return out;
}

/**
 * Real AI practice set from student mistakes + optional document chunks. No dummy templates.
 */
export async function generatePracticeSetWithAI(
  request: PracticeSetRequest,
): Promise<PracticeSet> {
  if (!request.mode || !request.model || !request.settings) {
    throw new Error(
      'Practice generation requires AI mode, model state, and settings.\nConfigure Online/Offline models first.',
    );
  }
  if (!request.mistakes.length) {
    throw new Error('No mistakes to practice — perfect attempt.');
  }

  const chunks = request.material ? ensureMaterialChunks(request.material) : [];
  const chunkCtx = chunks.length ? formatRagContext(
    chunks.slice(0, 10).map((c) => ({ ...c, score: 1 })),
    8_000,
  ) : '';

  const mistakeBlock = request.mistakes
    .slice(0, 6)
    .map(
      (m, i) =>
        `${i + 1}. Q: ${m.questionText}\n` +
        `   Student: ${m.studentAnswer}\n` +
        `   Correct: ${m.correctAnswer}\n` +
        `   Mistake type: ${m.mistakeType}\n` +
        `   Note: ${m.explanation}`,
    )
    .join('\n\n');

  const prompt =
    `Create a personalized practice set for a student who missed quiz questions.\n` +
    `Course: ${request.courseTitle}\n` +
    `Weak topics: ${request.weakTopics.join(', ') || 'general'}\n\n` +
    `MISTAKES TO TARGET:\n${mistakeBlock}\n\n` +
    (chunkCtx
      ? `SOURCE MATERIAL (ground new questions here):\n${chunkCtx}\n\n`
      : 'No extra source material — rewrite practice from the mistakes and correct answers only.\n\n') +
    `Generate 4-8 NEW practice questions (not copies of the originals) that help fix these mistake types.\n` +
    `Return ONLY a JSON array:\n` +
    `[{"text":"...","type":"MCQ|Short","options":["..."] optional,"correctAnswer":"...","explanation":"...","hint":"...","topicTag":"...","mistakeType":"Conceptual gap|Careless mistake|Misread question|Partial understanding"}]\n` +
    `MCQ must have 4 realistic options; correctAnswer must match one option exactly.`;

  const result = await routerSingleton.complete(
    prompt,
    request.mode,
    request.model,
    request.style || 'en',
    request.settings,
    QUIZ_GEN_SYSTEM,
  );
  const questions = parsePracticeQuestions(result.text, request);

  return {
    id: `ps_${request.attemptId}_${Date.now()}`,
    studentId: request.studentId,
    courseId: request.courseId,
    courseTitle: request.courseTitle,
    basedOnAttemptId: request.attemptId,
    generatedAt: nowStamp(),
    focusTopics: request.weakTopics,
    difficulty: 'easy',
    targetMistakeTypes: request.mistakes.map((m) => m.mistakeType),
    description: `AI practice for ${request.mistakes.length} weak area(s): ${request.weakTopics.join(', ') || 'general'} · via ${result.providerName}`,
    questions,
    completed: false,
  };
}

const nowStamp = () => new Date().toISOString().replace('T', ' ').slice(0, 16);

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface AISettings {
  openRouterApiKey: string;
  openRouterModelId: string;
  openRouterBackupModelId: string;
  /** Extra free OpenRouter model tried after primary + backup (e.g. rate limits) */
  openRouterTertiaryModelId: string;
  openRouterBaseUrl: string;
  /** Optional Google AI Studio key — free Gemma/Gemini path when OpenRouter is rate-limited */
  googleAiApiKey: string;
  googleAiModelId: string;
  localEndpoint: string;
  localModelName: string;
}

/** Built-in free OpenRouter Gemma models used for automatic failover on 429 / provider errors. */
export const FREE_OPENROUTER_GEMMA_MODELS = [
  'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-31b-it:free',
  // OpenRouter-maintained router: selects an available free model when named
  // providers are temporarily rate-limited or unavailable.
  'openrouter/free',
] as const;

export const DEFAULT_AI_SETTINGS: AISettings = {
  openRouterApiKey: '',
  openRouterModelId: 'google/gemma-4-26b-a4b-it:free',
  openRouterBackupModelId: 'google/gemma-4-31b-it:free',
  // Second free Gemma (or swap to another free OpenRouter model if Gemma is exhausted)
  openRouterTertiaryModelId: 'openrouter/free',
  openRouterBaseUrl: 'https://openrouter.ai/api/v1',
  googleAiApiKey: '',
  googleAiModelId: 'gemma-3-27b-it',
  localEndpoint: 'http://127.0.0.1:3928',
  localModelName: 'gemma-2-2b-it-Q4_K_M.gguf',
};

/** @deprecated Use HF_GEMMA_PRESETS from localModel.ts — kept for older imports */
export type DownloadableModel = {
  id: string;
  name: string;
  label: string;
  sizeHint: string;
  description: string;
};

export { HF_GEMMA_PRESETS as DOWNLOADABLE_GEMMA_MODELS } from './localModel';

// ─── System prompts ───────────────────────────────────────────────────────────

const URDU_ENGLISH_SYSTEM = `You are a classroom teaching assistant for Pakistani students. Respond in a natural mix of simple Urdu and English (Roman Urdu style) that students understand — like a friendly teacher explaining in class.

Guidelines:
- Use Roman Urdu for Urdu words (e.g., "Yeh concept samajhna zaroori hai")
- Keep English for technical terms and subject vocabulary
- Keep explanations short, clear, and friendly
- Use simple sentences for students in grades 8-16
- End with an encouraging sentence
- If a topic is complex, break it into 2-3 very simple steps
- When source material is provided, ground answers in that material only`;

const ENGLISH_SYSTEM = `You are a classroom teaching assistant. Return concise, source-grounded teaching help.
Keep explanations clear and appropriate for students aged 14-22. Be encouraging and precise.
When SOURCE PASSAGES are provided (RAG context), answer ONLY from those passages.
If the answer is not in the passages, say what is missing instead of inventing facts.
Cite the passage sourceRef when helpful (e.g. "Page 3").`;

const RAG_ANSWER_SYSTEM = `You are a RAG-powered classroom tutor.
You receive a student question plus retrieved SOURCE PASSAGES from uploaded course documents.
Rules:
1. Answer using the passages first. Quote or paraphrase key lines.
2. If passages are partial, say so and answer only what they support.
3. Structure: short direct answer → 2-5 bullet key points → optional study tip.
4. Never invent syllabus facts, formulas, or definitions not present in the passages or question.
5. Keep language clear for college students.`;

const MATERIAL_ANALYSIS_SYSTEM = `You analyze study materials for teachers and students.
Return clear, structured educational content only.
Use plain text with short headings. Do not invent facts that are not supported by the material.`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHttpError(status: number, body: string, prefix: string): string {
  const raw = (body || '').trim();
  let detail = raw;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.error?.message) detail = String(parsed.error.message);
    else if (typeof parsed?.error === 'string') detail = parsed.error;
    else if (parsed?.message) detail = String(parsed.message);
    else detail = JSON.stringify(parsed, null, 2);
  } catch {
    // keep raw body
  }
  if (!detail) detail = '(no response body)';
  const rawBlock = raw && raw !== detail ? `\n\nRaw response body:\n${raw.slice(0, 4000)}` : raw ? `\n\nRaw response body:\n${raw.slice(0, 4000)}` : '\n\nRaw response body: (empty)';
  return `${prefix} failed (HTTP ${status}).\n\nDetails:\n${detail}${rawBlock}`;
}

function isRateLimitOrProviderError(message: string): boolean {
  return /429|rate.?limit|provider returned error|temporarily|overloaded|capacity|try again|503|502|timeout|unavailable/i.test(
    message,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function materialChunks(material: CourseMaterial): DocumentChunk[] {
  if (material.chunks?.length) return material.chunks;
  const text = material.contentText || material.contentSummary || '';
  return chunkDocumentText(text);
}

function normalizeDifficulty(d: Quiz['difficulty']): 'easy' | 'moderate' | 'hard' {
  if (d === 'hard') return 'hard';
  if (d === 'easy') return 'easy';
  // medium and moderate both map to moderate
  return 'moderate';
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function normalizeEndpoint(endpoint: string): string {
  return (endpoint || 'http://127.0.0.1:3928').replace(/\/$/, '');
}

function normalizeOpenRouterBase(baseUrl: string): string {
  return (baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
}

// ─── Local Gemma via Ollama ───────────────────────────────────────────────────

export interface OllamaModel {
  name: string;
  model: string;
  size: number;
  digest: string;
  details?: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

export interface OllamaTagsResponse {
  models: OllamaModel[];
}

export interface OllamaChatRequest {
  model: string;
  messages: { role: 'user' | 'system' | 'assistant'; content: string }[];
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    num_predict?: number;
  };
}

export interface OllamaChatResponse {
  model: string;
  message: { role: 'assistant'; content: string };
  done: boolean;
  total_duration?: number;
  context?: number[];
}

export type PullProgress = {
  status: string;
  percent: number;
  completed?: number;
  total?: number;
  detail?: string;
};

export class LocalGemmaProvider {
  async complete(
    prompt: string,
    model: LocalModelState,
    style: LanguageStyle,
    systemPrompt?: string,
  ): Promise<AIProviderResult> {
    if (!model.localPath) {
      throw new Error(
        'Local Hugging Face model is not connected.\n\n' +
          '1. Open Model settings\n' +
          '2. Paste a Hugging Face GGUF model link (or pick a preset)\n' +
          '3. Download the model to this computer\n' +
          '4. LetsDoIT will install the local runtime and connect it automatically',
      );
    }

    const system = systemPrompt || (style === 'urdu-en' ? URDU_ENGLISH_SYSTEM : ENGLISH_SYSTEM);

    try {
      // Ensure local runtime is up with the selected GGUF, then chat fully offline
      const { ensureOfflineRuntime, offlineChat } = await import('./localModel');
      const runtime = await ensureOfflineRuntime(model.localPath);
      if (!runtime.running) {
        throw new Error(runtime.message);
      }
      const result = await offlineChat({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        // Keep room in the local context for document passages and the answer.
        // Large reservations can make llama.cpp reject valid RAG prompts.
        maxTokens: 1536,
        temperature: 0.55,
      });
      const text = (result.text || '').trim();
      if (!text) {
        throw new Error(
          'Local model returned an empty response.\n\n' +
            'Try a shorter prompt, free more RAM, or switch ONLINE/HYBRID. ' +
            'If this keeps happening, re-test the offline model under Model settings.',
        );
      }
      return {
        text,
        modeUsed: 'OFFLINE',
        providerName: result.providerName || `Local HF (${model.modelName})`,
        fromCache: false,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Offline Hugging Face model failed.\n\n` +
          `Model: ${model.modelName}\n` +
          `Path: ${model.localPath}\n\n` +
          `Error: ${msg}`,
      );
    }
  }
}

// ─── OpenRouter Gemma (+ free model failover) ─────────────────────────────────

export class OpenRouterGemmaProvider {
  /** Ordered unique model IDs to try for free / rate-limit failover. */
  buildModelChain(settings: AISettings): string[] {
    const chain = [
      settings.openRouterModelId || DEFAULT_AI_SETTINGS.openRouterModelId,
      settings.openRouterBackupModelId || DEFAULT_AI_SETTINGS.openRouterBackupModelId,
      settings.openRouterTertiaryModelId || DEFAULT_AI_SETTINGS.openRouterTertiaryModelId,
      ...FREE_OPENROUTER_GEMMA_MODELS,
    ]
      .map((id) => (id || '').trim())
      .filter(Boolean);
    return [...new Set(chain)];
  }

  async complete(
    prompt: string,
    settings: AISettings,
    style: LanguageStyle,
    systemPrompt?: string,
  ): Promise<AIProviderResult> {
    if (!settings.openRouterApiKey?.trim()) {
      throw new Error(
        'OpenRouter API key is not configured.\n\n' +
          'Open Model / Settings, paste your OpenRouter key (sk-or-...), then click Test Online Model.',
      );
    }

    const system = systemPrompt || (style === 'urdu-en' ? URDU_ENGLISH_SYSTEM : ENGLISH_SYSTEM);
    const baseUrl = normalizeOpenRouterBase(settings.openRouterBaseUrl);
    const apiKey = settings.openRouterApiKey.trim();
    const models = this.buildModelChain(settings);
    const errors: string[] = [];

    for (let i = 0; i < models.length; i += 1) {
      const modelId = models[i];
      try {
        // Brief backoff before retries after a rate-limit on a previous model
        if (i > 0 && errors.some((e) => isRateLimitOrProviderError(e))) {
          await sleep(1200);
        }
        const result = await this.callModel(baseUrl, apiKey, modelId, system, prompt);
        if (i > 0) {
          return {
            ...result,
            providerName: `${result.providerName} [failover after: ${models.slice(0, i).join(' → ')}]`,
          };
        }
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`• ${modelId}:\n${msg}`);
        // Auth errors: stop immediately (retrying other models will not help)
        if (/api key|unauthorized|401|403|invalid.*key|missing.*authorization/i.test(msg)) {
          throw new Error(
            `Online model authentication failed.\n\n${msg}\n\n` +
              `Check your OpenRouter API key at https://openrouter.ai/keys`,
          );
        }
      }
    }

    throw new Error(
      `All online OpenRouter models failed (${models.length} tried).\n\n` +
        `${errors.join('\n\n')}\n\n` +
        `Tips:\n` +
        `• Free models are limited (~20 req/min, ~200/day). Wait a minute or try Google AI Studio key below.\n` +
        `• Switch HYBRID mode so offline GGUF can answer when online is rate-limited.\n` +
        `• Verify model IDs at https://openrouter.ai/models?q=gemma`,
    );
  }

  private async callModel(
    baseUrl: string,
    apiKey: string,
    modelId: string,
    system: string,
    prompt: string,
    attempt = 1,
  ): Promise<AIProviderResult> {
    const maxAttempts = 3;
    let response: Response;
    try {
      response = await robustFetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://letsdoit.app',
          'X-Title': 'LetsDoIT Classroom',
        },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
          max_tokens: 2500,
          temperature: 0.45,
        }),
        timeoutMs: 120_000,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // Network blips: one soft retry before failing the model
      if (attempt < 2 && /fetch|network|timeout|ECONN|Failed to fetch/i.test(msg)) {
        await sleep(1500 * attempt);
        return this.callModel(baseUrl, apiKey, modelId, system, prompt, attempt + 1);
      }
      throw new Error(
        `Cannot reach OpenRouter at ${baseUrl}/chat/completions.\n\n` +
          `Model: ${modelId}\n` +
          `Error: ${msg}\n\n` +
          `Check your internet connection and base URL.`,
      );
    }

    if (!response.ok) {
      const body = await readErrorBody(response);
      // Automatic retry on rate-limit / transient provider errors for the same model
      if ((response.status === 429 || response.status === 502 || response.status === 503) && attempt < maxAttempts) {
        await sleep(2000 * attempt);
        return this.callModel(baseUrl, apiKey, modelId, system, prompt, attempt + 1);
      }
      throw new Error(formatHttpError(response.status, body, `OpenRouter (${modelId})`));
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const text = typeof content === 'string'
      ? content.trim()
      : Array.isArray(content)
        ? content
            .map((part: { type?: string; text?: string } | string) =>
              typeof part === 'string' ? part : part?.type === 'text' ? part.text || '' : '',
            )
            .join('\n')
            .trim()
        : '';
    if (!text) {
      // Some providers put the error inside a 200-ish payload or empty choices
      const raw = JSON.stringify(data, null, 2).slice(0, 2500);
      throw new Error(
        `OpenRouter (${modelId}) returned an empty response.\n\nFull payload:\n${raw}`,
      );
    }
    return {
      text,
      modeUsed: 'ONLINE',
      providerName: `OpenRouter (${modelId})`,
      fromCache: false,
    };
  }
}

// ─── Google AI Studio (free Gemma fallback when OpenRouter is limited) ───────

export class GoogleAiGemmaProvider {
  async complete(
    prompt: string,
    settings: AISettings,
    style: LanguageStyle,
    systemPrompt?: string,
  ): Promise<AIProviderResult> {
    const apiKey = settings.googleAiApiKey?.trim();
    if (!apiKey) {
      throw new Error(
        'Google AI Studio API key is not configured.\n\n' +
          'Get a free key at https://aistudio.google.com/apikey and paste it in Model settings.',
      );
    }

    const system = systemPrompt || (style === 'urdu-en' ? URDU_ENGLISH_SYSTEM : ENGLISH_SYSTEM);
    // Prefer free Gemma instruct models; gemini-flash is last-resort free capacity
    const modelCandidates = [
      settings.googleAiModelId || DEFAULT_AI_SETTINGS.googleAiModelId,
      'gemma-3-27b-it',
      'gemma-3-12b-it',
      'gemma-3-4b-it',
      'gemini-2.0-flash',
    ].filter((v, i, a) => v && a.indexOf(v) === i);

    const errors: string[] = [];
    for (const modelId of modelCandidates) {
      try {
        return await this.callModel(apiKey, modelId, system, prompt);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`• ${modelId}:\n${msg}`);
        if (/api key|API_KEY|401|403|invalid|PERMISSION/i.test(msg) && /key/i.test(msg)) {
          // keep trying other models only for not-found; hard auth stop
          if (/API key not valid|invalid api key/i.test(msg)) {
            throw new Error(`Google AI Studio authentication failed.\n\n${msg}`);
          }
        }
      }
    }

    throw new Error(
      `Google AI Studio free models failed.\n\n${errors.join('\n\n')}\n\n` +
        `Get/refresh a free key: https://aistudio.google.com/apikey`,
    );
  }

  private async callModel(
    apiKey: string,
    modelId: string,
    system: string,
    prompt: string,
    attempt = 1,
  ): Promise<AIProviderResult> {
    const maxAttempts = 2;
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent` +
      `?key=${encodeURIComponent(apiKey)}`;

    let response: Response;
    try {
      response = await robustFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.45,
            maxOutputTokens: 2500,
          },
        }),
        timeoutMs: 120_000,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Cannot reach Google AI Studio (${modelId}).\n\nError: ${msg}`);
    }

    if (!response.ok) {
      const body = await readErrorBody(response);
      if ((response.status === 429 || response.status === 503) && attempt < maxAttempts) {
        await sleep(2000 * attempt);
        return this.callModel(apiKey, modelId, system, prompt, attempt + 1);
      }
      throw new Error(formatHttpError(response.status, body, `Google AI (${modelId})`));
    }

    const data = await response.json();
    // Blocked / safety filters often return candidates with finishReason but no text
    const finishReason = data?.candidates?.[0]?.finishReason;
    const blockReason = data?.promptFeedback?.blockReason;
    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || '')
        .join('')
        .trim() || '';
    if (!text) {
      throw new Error(
        `Google AI (${modelId}) returned empty content` +
          (finishReason ? ` (finishReason: ${finishReason})` : '') +
          (blockReason ? ` (blockReason: ${blockReason})` : '') +
          `.\n\nFull payload:\n${JSON.stringify(data, null, 2).slice(0, 2500)}`,
      );
    }
    return {
      text,
      modeUsed: 'ONLINE',
      providerName: `Google AI Studio (${modelId})`,
      fromCache: false,
    };
  }
}

// ─── Connection tests ─────────────────────────────────────────────────────────

export async function testOllamaConnection(
  endpoint: string,
): Promise<{ ok: boolean; message: string; models?: string[]; allModels?: string[] }> {
  const base = normalizeEndpoint(endpoint);
  try {
    const response = await robustFetch(`${base}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(8000),
      timeoutMs: 8_000,
    });
    if (!response.ok) {
      const body = await readErrorBody(response);
      return {
        ok: false,
        message: formatHttpError(response.status, body, 'Ollama /api/tags'),
      };
    }
    const data: OllamaTagsResponse = await response.json();
    const allModels = (data.models || []).map((m) => m.name);
    const gemmaModels = allModels.filter((name) => name.toLowerCase().includes('gemma'));
    return {
      ok: true,
      message:
        `Ollama is running at ${base}.\n` +
        `${allModels.length} model(s) installed` +
        (gemmaModels.length ? ` · Gemma: ${gemmaModels.join(', ')}` : ' · no Gemma models yet — download one below'),
      models: gemmaModels,
      allModels,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/abort|timeout/i.test(msg)) {
      return {
        ok: false,
        message:
          `Connection to Ollama timed out (${base}).\n\n` +
          `Is Ollama installed and running?\n` +
          `Download: https://ollama.com\n` +
          `After install, open a terminal and run: ollama serve`,
      };
    }
    return {
      ok: false,
      message:
        `Cannot connect to Ollama at ${base}.\n\n` +
        `Error: ${msg}\n\n` +
        `Setup:\n` +
        `1. Install Ollama from https://ollama.com\n` +
        `2. Start the Ollama app (Windows tray / background service)\n` +
        `3. Confirm the endpoint is http://localhost:11434\n` +
        `4. Click Test Offline Model again`,
    };
  }
}

/** Full offline chat probe — proves the selected model can actually generate. */
export async function testOfflineModel(
  endpoint: string,
  modelName: string,
): Promise<{ ok: boolean; message: string; reply?: string }> {
  const tags = await testOllamaConnection(endpoint);
  if (!tags.ok) {
    return { ok: false, message: tags.message };
  }

  const base = normalizeEndpoint(endpoint);
  const name = modelName || 'gemma2:2b';
  const installed = tags.allModels || [];

  if (!installed.some((m) => m === name || m.startsWith(name))) {
    return {
      ok: false,
      message:
        `Ollama is running, but model "${name}" is not installed.\n\n` +
        `Installed: ${installed.length ? installed.join(', ') : '(none)'}\n\n` +
        `Click Download next to a Gemma model, wait for it to finish, then test again.`,
    };
  }

  try {
    const response = await robustFetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: name,
        messages: [
          { role: 'system', content: 'You are a concise classroom assistant.' },
          { role: 'user', content: 'Reply with exactly: Offline Gemma ready.' },
        ],
        stream: false,
        options: { num_predict: 32, temperature: 0 },
      }),
      signal: AbortSignal.timeout(120000),
      timeoutMs: 120_000,
    });

    if (!response.ok) {
      const body = await readErrorBody(response);
      return { ok: false, message: formatHttpError(response.status, body, `Offline test (${name})`) };
    }

    const data: OllamaChatResponse = await response.json();
    const reply = data.message?.content?.trim() || '';
    return {
      ok: true,
      message: `Offline model works.\nModel: ${name}\nEndpoint: ${base}\nSample reply: ${reply || '(empty)'}`,
      reply,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: `Offline chat test failed for "${name}".\n\nError: ${msg}`,
    };
  }
}

export async function testOpenRouterConnection(
  apiKey: string,
  baseUrl: string,
  modelId: string,
  backupModelId?: string,
  tertiaryModelId?: string,
): Promise<{ ok: boolean; message: string; modelUsed?: string }> {
  if (!apiKey?.trim()) {
    return {
      ok: false,
      message: 'API key is empty. Paste your OpenRouter key (starts with sk-or-) in settings.',
    };
  }

  const base = normalizeOpenRouterBase(baseUrl);
  const models = [
    modelId || DEFAULT_AI_SETTINGS.openRouterModelId,
    backupModelId || DEFAULT_AI_SETTINGS.openRouterBackupModelId,
    tertiaryModelId || DEFAULT_AI_SETTINGS.openRouterTertiaryModelId,
    ...FREE_OPENROUTER_GEMMA_MODELS,
  ].filter((v, i, a) => v && a.indexOf(v) === i);

  const tryModel = async (id: string): Promise<{ ok: boolean; message: string; modelUsed?: string }> => {
    try {
      const response = await robustFetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://letsdoit.app',
          'X-Title': 'LetsDoIT Classroom',
        },
        body: JSON.stringify({
          model: id,
          messages: [{ role: 'user', content: 'Reply with exactly: Online Gemma ready.' }],
          max_tokens: 24,
          temperature: 0,
        }),
        signal: AbortSignal.timeout(45000),
        timeoutMs: 45_000,
      });

      if (!response.ok) {
        const body = await readErrorBody(response);
        return {
          ok: false,
          message: formatHttpError(response.status, body, `OpenRouter test (${id})`),
        };
      }

      const data = await response.json();
      const reply = data.choices?.[0]?.message?.content?.trim() || '';
      return {
        ok: true,
        message:
          `Online model works.\n` +
          `Base: ${base}/chat/completions\n` +
          `Model: ${id}\n` +
          `Sample reply: ${reply || '(empty)'}`,
        modelUsed: id,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/abort|timeout/i.test(msg)) {
        return {
          ok: false,
          message: `OpenRouter connection timed out for model "${id}".\nCheck your internet and try again.`,
        };
      }
      return {
        ok: false,
        message: `OpenRouter connection failed for "${id}".\n\nError: ${msg}`,
      };
    }
  };

  const failures: string[] = [];
  for (const id of models) {
    const result = await tryModel(id);
    if (result.ok) {
      if (failures.length === 0) return result;
      return {
        ...result,
        message:
          `Earlier model(s) failed; later model succeeded.\n\n` +
          `Failures:\n${failures.join('\n\n')}\n\n` +
          `Success:\n${result.message}`,
      };
    }
    failures.push(result.message);
    if (isRateLimitOrProviderError(result.message)) {
      await sleep(800);
    }
  }

  return {
    ok: false,
    message:
      `All online OpenRouter models failed.\n\n${failures.join('\n\n')}\n\n` +
      `If you see HTTP 429 / "Provider returned error", free Gemma capacity is exhausted.\n` +
      `Wait a minute, add a Google AI Studio free key, or use Offline mode.`,
  };
}

export async function testGoogleAiConnection(
  apiKey: string,
  modelId?: string,
): Promise<{ ok: boolean; message: string; modelUsed?: string }> {
  if (!apiKey?.trim()) {
    return {
      ok: false,
      message: 'Google AI Studio key is empty. Get one free at https://aistudio.google.com/apikey',
    };
  }
  const provider = new GoogleAiGemmaProvider();
  try {
    const result = await provider.complete(
      'Reply with exactly: Online Gemma ready.',
      {
        ...DEFAULT_AI_SETTINGS,
        googleAiApiKey: apiKey.trim(),
        googleAiModelId: modelId || DEFAULT_AI_SETTINGS.googleAiModelId,
      },
      'en',
      'You are a concise classroom assistant.',
    );
    return {
      ok: true,
      message: `Google AI Studio works.\nProvider: ${result.providerName}\nSample: ${result.text.slice(0, 200)}`,
      modelUsed: result.providerName,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

// ─── Ollama model pull (download) ─────────────────────────────────────────────

export async function pullOllamaModel(
  endpoint: string,
  modelName: string,
  onProgress?: (progress: PullProgress) => void,
  signal?: AbortSignal,
): Promise<{ ok: boolean; message: string }> {
  const base = normalizeEndpoint(endpoint);
  const name = modelName.trim();
  if (!name) {
    return { ok: false, message: 'Model name is empty.' };
  }

  // Verify Ollama is reachable first
  const probe = await testOllamaConnection(base);
  if (!probe.ok) {
    return { ok: false, message: probe.message };
  }

  let response: Response;
  try {
    response = await robustFetch(`${base}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stream: true }),
      signal,
      // Model downloads can take a long time
      timeoutMs: 3_600_000,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      message:
        `Failed to start download of "${name}".\n\n` +
        `Error: ${msg}\n\n` +
        `Ensure Ollama is running at ${base}.`,
    };
  }

  if (!response.ok) {
    const body = await readErrorBody(response);
    return { ok: false, message: formatHttpError(response.status, body, `ollama pull ${name}`) };
  }

  if (!response.body) {
    return { ok: false, message: 'Ollama returned an empty stream while pulling the model.' };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let lastStatus = 'starting';
  let lastPercent = 0;
  let sawSuccess = false;
  let lastError = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event = JSON.parse(trimmed) as {
            status?: string;
            digest?: string;
            total?: number;
            completed?: number;
            error?: string;
          };

          if (event.error) {
            lastError = event.error;
            onProgress?.({ status: 'error', percent: lastPercent, detail: event.error });
            continue;
          }

          lastStatus = event.status || lastStatus;
          if (event.total && event.total > 0) {
            const completed = event.completed || 0;
            lastPercent = Math.min(99, Math.round((completed / event.total) * 100));
            onProgress?.({
              status: lastStatus,
              percent: lastPercent,
              completed,
              total: event.total,
              detail: event.digest ? `layer ${event.digest.slice(0, 12)}…` : lastStatus,
            });
          } else {
            onProgress?.({
              status: lastStatus,
              percent: lastPercent,
              detail: lastStatus,
            });
          }

          if (event.status === 'success') {
            sawSuccess = true;
            lastPercent = 100;
            onProgress?.({ status: 'success', percent: 100, detail: 'Model ready' });
          }
        } catch {
          // ignore partial JSON lines
        }
      }
    }
  } catch (error) {
    if (signal?.aborted) {
      return { ok: false, message: `Download of "${name}" was cancelled.` };
    }
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Download stream interrupted for "${name}".\n\nError: ${msg}` };
  }

  if (lastError) {
    return { ok: false, message: `Failed to pull "${name}": ${lastError}` };
  }

  if (!sawSuccess && lastStatus !== 'success') {
    // Some Ollama versions end without explicit success if already present
    const recheck = await testOllamaConnection(base);
    const installed = recheck.allModels || [];
    if (installed.some((m) => m === name || m.startsWith(name))) {
      onProgress?.({ status: 'success', percent: 100, detail: 'Model already present' });
      return { ok: true, message: `Model "${name}" is available in Ollama.` };
    }
    return {
      ok: false,
      message: `Pull finished without success for "${name}". Last status: ${lastStatus}`,
    };
  }

  return {
    ok: true,
    message: `Model "${name}" downloaded and ready for offline use.`,
  };
}

export async function listOllamaModels(
  endpoint: string,
): Promise<{ ok: boolean; models: string[]; message: string }> {
  const result = await testOllamaConnection(endpoint);
  return {
    ok: result.ok,
    models: result.allModels || [],
    message: result.message,
  };
}

// ─── Material AI processing ───────────────────────────────────────────────────

export type MaterialAIAnalysis = {
  summary: string;
  importantPoints: string[];
  studyHelp: string;
  providerName: string;
  modeUsed: AIMode;
};

function parseMaterialAnalysis(raw: string): Omit<MaterialAIAnalysis, 'providerName' | 'modeUsed'> {
  const summaryMatch = raw.match(/SUMMARY:\s*([\s\S]*?)(?=\n\s*IMPORTANT POINTS:|\n\s*STUDY HELP:|$)/i);
  const pointsMatch = raw.match(/IMPORTANT POINTS:\s*([\s\S]*?)(?=\n\s*STUDY HELP:|$)/i);
  const helpMatch = raw.match(/STUDY HELP:\s*([\s\S]*?)$/i);

  const summary = (summaryMatch?.[1] || raw).trim().slice(0, 2000);
  const pointsBlock = pointsMatch?.[1] || '';
  const importantPoints = pointsBlock
    .split('\n')
    .map((line) => line.replace(/^[-*•\d.)\s]+/, '').trim())
    .filter((line) => line.length > 3)
    .slice(0, 12);
  const studyHelp = (helpMatch?.[1] || '').trim().slice(0, 3000);

  return {
    summary: summary || 'Summary unavailable.',
    importantPoints: importantPoints.length
      ? importantPoints
      : raw
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l.startsWith('-') || l.startsWith('•'))
          .map((l) => l.replace(/^[-•]\s*/, ''))
          .slice(0, 8),
    studyHelp: studyHelp || 'Review the summary and important points, then attempt practice questions on each topic.',
  };
}

/**
 * Extract summary, important points, and study help from uploaded material text/chunks
 * using the active Online / Offline / Hybrid Gemma route. Never invents dummy content.
 */
export async function processMaterialWithAI(
  title: string,
  contentText: string,
  mode: AIMode,
  model: LocalModelState,
  settings: AISettings,
  style: LanguageStyle = 'en',
  chunks?: DocumentChunk[],
): Promise<MaterialAIAnalysis> {
  const chunkContext =
    chunks && chunks.length
      ? buildChunkContext(chunks, 14_000, 20)
      : '';
  const excerpt = chunkContext || compact(contentText || title, 14000);
  if (!excerpt.trim()) {
    throw new Error(
      'No extractable text found in the uploaded file.\n\n' +
        'For scanned PDFs, paste notes in the summary field. For text PDFs, re-upload a searchable PDF.',
    );
  }

  const prompt =
    `Analyze this study material for a classroom app.\n\n` +
    `Title: ${title}\n` +
    (chunks?.length ? `Chunks indexed: ${chunks.length}\n` : '') +
    `\nMaterial content (from extracted document chunks):\n${excerpt}\n\n` +
    `Respond in EXACTLY this format (plain text):\n` +
    `SUMMARY:\n(3-6 sentences summarizing the material)\n\n` +
    `IMPORTANT POINTS:\n- point 1\n- point 2\n- point 3\n(5-10 bullet points grounded in the material)\n\n` +
    `STUDY HELP:\n(short study plan + 3 practice questions students can try, based only on this material)`;

  const result = await routerSingleton.complete(prompt, mode, model, style, settings, MATERIAL_ANALYSIS_SYSTEM);
  const parsed = parseMaterialAnalysis(result.text);
  return {
    ...parsed,
    providerName: result.providerName,
    modeUsed: result.modeUsed,
  };
}

const QUIZ_GEN_SYSTEM = `You generate classroom quizzes strictly from the provided source material.
Return ONLY valid JSON (no markdown fences). Do not invent facts outside the material.
Each question must be answerable from the material. Include a short sourceRef (page/section).`;

function parseQuizJson(raw: string, request: QuizRequest): QuizQuestion[] {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  // Try direct JSON, then extract first array/object
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
    const objectMatch = cleaned.match(/\{[\s\S]*\}/);
    if (arrayMatch) parsed = JSON.parse(arrayMatch[0]);
    else if (objectMatch) parsed = JSON.parse(objectMatch[0]);
    else throw new Error('Model did not return parseable JSON for the quiz.');
  }

  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { questions?: unknown }).questions)
      ? (parsed as { questions: unknown[] }).questions
      : null;

  if (!list?.length) {
    throw new Error('Model returned JSON without any questions.');
  }

  const difficulty = normalizeDifficulty(request.difficulty);
  const questions: QuizQuestion[] = [];

  for (let i = 0; i < list.length; i += 1) {
    const item = list[i] as Record<string, unknown>;
    const text = String(item.text || item.question || '').trim();
    const correctAnswer = String(item.correctAnswer || item.answer || '').trim();
    if (!text || !correctAnswer) continue;

    let options: string[] | undefined;
    if (Array.isArray(item.options)) {
      options = item.options.map((o) => String(o).trim()).filter(Boolean);
    }
    const qType = String(item.type || request.questionType || 'MCQ').toLowerCase();
    if ((qType.includes('true') || qType.includes('false')) && !options?.length) {
      options = ['True', 'False'];
    }
    if (qType.includes('mcq') && (!options || options.length < 2)) {
      // Skip broken MCQs rather than invent options
      continue;
    }

    questions.push({
      id: `q_${Date.now()}_${i}`,
      text,
      options,
      correctAnswer,
      explanation: String(item.explanation || 'See the source material for the full rationale.').trim(),
      topicTag: String(item.topicTag || item.topic || request.material.topic || request.material.title).trim(),
      sourceRef: String(item.sourceRef || item.source || request.material.fileName).trim(),
    });
  }

  if (!questions.length) {
    throw new Error(
      `Model returned ${list.length} raw item(s) but none were valid questions for difficulty "${difficulty}".`,
    );
  }
  return questions;
}

/**
 * Generate a real practice/official quiz from uploaded document chunks via the active AI mode.
 * Throws on failure — never returns template/dummy questions.
 */
export async function generateQuizWithAI(
  request: QuizRequest,
  mode: AIMode,
  model: LocalModelState,
  settings: AISettings,
  style: LanguageStyle = 'en',
): Promise<Quiz> {
  // Diverse sampling across the whole document (RAG-style coverage), not only the first pages
  const chunks = selectQuizChunks(request.material, 16);
  const allChunks = materialChunks(request.material);
  // Smaller local context leaves output headroom on compact offline models.
  const context =
    buildChunkContext(chunks, mode === 'OFFLINE' ? 8_000 : 12_000, 16) ||
    compact(
      request.material.contentText || request.material.contentSummary || '',
      mode === 'OFFLINE' ? 8_000 : 12_000,
    );

  if (!context.trim() || (!allChunks.length && !(request.material.contentText || '').trim())) {
    throw new Error(
      'Cannot generate a quiz: this material has no extracted text chunks.\n\n' +
        'Re-upload a searchable PDF or paste notes so the AI can ground questions in real content.\n' +
        'Dummy/template quizzes are intentionally disabled.',
    );
  }

  const difficulty = normalizeDifficulty(request.difficulty);
  const count = difficulty === 'hard' ? 6 : difficulty === 'moderate' ? 5 : 4;
  const typeHint =
    request.questionType === 'Mixed'
      ? 'Mix of MCQ, True/False, and Short answer'
      : request.questionType;

  const prompt =
    `Create a ${difficulty} classroom quiz from ONLY the source material below.\n\n` +
    `Course material title: ${request.material.title}\n` +
    `File: ${request.material.fileName}\n` +
    `Indexed chunks available: ${allChunks.length}\n` +
    `Chunks used for this quiz (diverse sample): ${chunks.length}\n` +
    `Requested type: ${typeHint}\n` +
    `Number of questions: ${count}\n` +
    `Difficulty guide:\n` +
    `- easy: direct recall from the text\n` +
    `- moderate: apply or connect two ideas from the text\n` +
    `- hard: deeper reasoning still grounded in the text\n\n` +
    `SOURCE MATERIAL CHUNKS (RAG sample):\n${context}\n\n` +
    `Rules:\n` +
    `- Every question MUST be answerable from the chunks above.\n` +
    `- Cover different sections when possible (do not put all questions on one paragraph).\n` +
    `- Do NOT invent facts outside the chunks.\n` +
    `- Do NOT write placeholder/template questions.\n\n` +
    `Return ONLY a JSON array of questions. Each item:\n` +
    `{"text":"...","type":"MCQ|True/False|Short","options":["A","B","C","D"] or omit for Short,` +
    `"correctAnswer":"...","explanation":"...","topicTag":"...","sourceRef":"Page/Section"}\n` +
    `For MCQ include exactly 4 options and set correctAnswer to the exact option text.\n` +
    `For True/False options must be ["True","False"].`;

  const result = await routerSingleton.complete(prompt, mode, model, style, settings, QUIZ_GEN_SYSTEM);
  const questions = parseQuizJson(result.text, request);

  // Soft quality gate: reject ultra-generic dummy patterns
  const dummyPattern =
    /offline-first class|source-backed explanation and targeted practice|should be connected to its source material/i;
  const clean = questions.filter((q) => !dummyPattern.test(q.text) && !dummyPattern.test(q.correctAnswer));
  if (!clean.length) {
    throw new Error(
      'Model returned template-like questions. Retry generation with Online/Hybrid mode or a stronger offline model.',
    );
  }

  return {
    id: `quiz_${Date.now()}`,
    courseId: request.courseId,
    title: request.title,
    sourceMaterialId: request.material.id,
    difficulty: difficulty === 'moderate' ? 'moderate' : difficulty,
    questionType: request.questionType,
    timeLimit: request.timeLimit,
    isTestMode: request.isTestMode,
    isPublished: true,
    questions: clean,
  };
}

/**
 * RAG-grounded chat completion for classroom Q&A.
 */
export async function answerWithRag(options: {
  question: string;
  mode: AIMode;
  model: LocalModelState;
  settings: AISettings;
  style?: LanguageStyle;
  selectedMaterial?: CourseMaterial | null;
  courseMaterials?: CourseMaterial[];
  courseIds?: string[];
  history?: { role: 'user' | 'assistant'; content: string }[];
}): Promise<AIProviderResult & { ragChunks: number; ragMode: string }> {
  const rag = buildRagAnswerContext({
    userQuestion: options.question,
    selectedMaterial: options.selectedMaterial,
    courseMaterials: options.courseMaterials,
    courseIds: options.courseIds,
    maxChars: options.mode === 'OFFLINE' ? 7_000 : 10_000,
  });

  const historyBlock =
    options.history && options.history.length
      ? `Recent conversation:\n${options.history
          .slice(-6)
          .map((h) => `${h.role === 'user' ? 'Student' : 'Tutor'}: ${h.content.slice(0, 500)}`)
          .join('\n')}\n\n`
      : '';

  const prompt = rag.context
    ? `${historyBlock}Student question:\n${options.question}\n\n---\n${rag.context}\n---\n` +
      `Answer the student question using the retrieved passages. Cite sourceRef when useful.`
    : `${historyBlock}Student question:\n${options.question}\n\n` +
      `(No course material passages were retrieved. Answer helpfully but say you do not have uploaded source text for this topic.)`;

  const result = await routerSingleton.complete(
    prompt,
    options.mode,
    options.model,
    options.style || 'en',
    options.settings,
    rag.context ? RAG_ANSWER_SYSTEM : ENGLISH_SYSTEM,
  );

  return {
    ...result,
    ragChunks: rag.usedChunks.length,
    ragMode: rag.mode,
  };
}

// ─── Auto Gemma Router ────────────────────────────────────────────────────────

export class AutoGemmaRouter {
  private local = new LocalGemmaProvider();
  private cloud = new OpenRouterGemmaProvider();
  private google = new GoogleAiGemmaProvider();

  /** Online path: OpenRouter free Gemma chain, then Google AI Studio free models. No dummy text. */
  private async completeOnline(
    prompt: string,
    settings: AISettings,
    style: LanguageStyle,
    systemPrompt?: string,
  ): Promise<AIProviderResult> {
    const errors: string[] = [];
    const hasOpenRouter = Boolean(settings.openRouterApiKey?.trim());
    const hasGoogle = Boolean(settings.googleAiApiKey?.trim());

    if (!hasOpenRouter && !hasGoogle) {
      throw new Error(
        'No online provider configured.\n\n' +
          'Add an OpenRouter API key (sk-or-...) and/or a free Google AI Studio key in Model settings.',
      );
    }

    if (hasOpenRouter) {
      try {
        return await this.cloud.complete(prompt, settings, style, systemPrompt);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    if (hasGoogle) {
      try {
        const result = await this.google.complete(prompt, settings, style, systemPrompt);
        if (errors.length) {
          return {
            ...result,
            providerName: `${result.providerName} [after OpenRouter failed]`,
          };
        }
        return result;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }

    throw new Error(
      `All online providers failed.\n\n${errors.join('\n\n---\n\n')}`,
    );
  }

  async complete(
    prompt: string,
    mode: AIMode,
    model: LocalModelState,
    style: LanguageStyle = 'en',
    settings?: AISettings,
    systemPrompt?: string,
  ): Promise<AIProviderResult> {
    const resolvedSettings = settings || (await loadAISettings());
    const cacheKey = await hashContent(
      `${mode}:${model.connected}:${model.modelName}:${resolvedSettings.openRouterModelId}:${resolvedSettings.googleAiModelId}:${style}:${prompt}`,
    );
    const cache = await loadCache();
    if (cache[cacheKey]) {
      return { ...cache[cacheKey], fromCache: true };
    }

    let result: AIProviderResult;
    if (mode === 'OFFLINE') {
      result = await this.local.complete(prompt, model, style, systemPrompt);
    } else if (mode === 'ONLINE') {
      result = await this.completeOnline(prompt, resolvedSettings, style, systemPrompt);
    } else {
      // HYBRID: online (OpenRouter → Google AI) first, then local GGUF
      try {
        result = await this.completeOnline(prompt, resolvedSettings, style, systemPrompt);
      } catch (onlineError) {
        if (model.localPath) {
          try {
            const offlineResult = await this.local.complete(prompt, model, style, systemPrompt);
            const onlineMsg = onlineError instanceof Error ? onlineError.message : String(onlineError);
            result = {
              ...offlineResult,
              providerName: `${offlineResult.providerName} [hybrid fallback after online failure]`,
              // Keep a short breadcrumb for debugging without flooding the answer
              text: offlineResult.text,
            };
            // Attach online failure detail only when offline also looks thin
            if (offlineResult.text.length < 40) {
              result = {
                ...result,
                text:
                  `${offlineResult.text}\n\n(Note: online providers failed first: ${onlineMsg.slice(0, 280)})`,
              };
            }
          } catch (offlineError) {
            const onlineMsg = onlineError instanceof Error ? onlineError.message : String(onlineError);
            const offlineMsg = offlineError instanceof Error ? offlineError.message : String(offlineError);
            throw new Error(
              `Hybrid mode failed — both online and offline paths errored.\n\n` +
                `── Online ──\n${onlineMsg}\n\n── Offline ──\n${offlineMsg}`,
            );
          }
        } else {
          const onlineMsg = onlineError instanceof Error ? onlineError.message : String(onlineError);
          throw new Error(
            `Online Gemma unavailable and local model is not connected.\n\n` +
              `Online error:\n${onlineMsg}\n\n` +
              `Download a Hugging Face GGUF offline model (Model settings) or fix your OpenRouter / Google AI key, then retry.`,
          );
        }
      }
    }

    // Never cache empty/failure-like payloads
    if ((result.text || '').trim().length >= 8) {
      cache[cacheKey] = result;
      await persistCache(cache);
    }
    return result;
  }
}

/** Shared router instance used by material processing helpers. */
const routerSingleton = new AutoGemmaRouter();

// ─── Settings persistence ─────────────────────────────────────────────────────

function parseSettingsBlob(raw: unknown): AISettings | null {
  try {
    let value: unknown = raw;
    if (typeof value === 'string') {
      value = JSON.parse(value);
      // Handle accidental double-encoding from older Tauri save path
      if (typeof value === 'string') {
        value = JSON.parse(value);
      }
    }
    if (!value || typeof value !== 'object') return null;
    return { ...DEFAULT_AI_SETTINGS, ...(value as Partial<AISettings>) };
  } catch {
    return null;
  }
}

export async function loadAISettings(): Promise<AISettings> {
  try {
    const stored = await invoke<string | null>('load_ai_settings');
    if (stored) {
      const parsed = parseSettingsBlob(stored);
      if (parsed) return parsed;
    }
  } catch {
    // fall through
  }
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = parseSettingsBlob(stored);
      if (parsed) return parsed;
    }
  } catch {
    // fall through
  }
  return { ...DEFAULT_AI_SETTINGS };
}

export async function saveAISettings(settings: AISettings): Promise<void> {
  const payload = JSON.stringify(settings);
  localStorage.setItem(SETTINGS_KEY, payload);
  try {
    await invoke('save_ai_settings', { settings: payload });
  } catch {
    // localStorage already updated
  }
}
