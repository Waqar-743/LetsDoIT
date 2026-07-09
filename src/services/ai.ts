import {
  AIMode,
  AIProviderResult,
  CourseMaterial,
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

const buildQuestion = (
  id: string,
  concept: string,
  difficulty: Quiz['difficulty'],
  type: Quiz['questionType'],
  sourceRef: string,
): QuizQuestion => {
  if (type === 'True/False') {
    return {
      id,
      text: `True or False: ${concept} should be connected to its source material before students use AI practice.`,
      options: ['True', 'False'],
      correctAnswer: 'True',
      explanation: `The prototype links each question back to ${sourceRef} so explanations stay grounded in uploaded material.`,
      topicTag: concept,
      sourceRef,
    };
  }

  if (type === 'Short') {
    return {
      id,
      text: `In two lines, explain the classroom importance of ${concept}.`,
      correctAnswer: 'It helps students understand the concept with evidence from the uploaded lesson and identify where practice is needed.',
      explanation: `A complete answer mentions lesson evidence and how the concept affects student preparation.`,
      topicTag: concept,
      sourceRef,
    };
  }

  return {
    id,
    text: `Which statement best explains ${concept} for an offline-first class?`,
    options: [
      `It should be learned with a source-backed explanation and targeted practice.`,
      'It can be ignored once a quiz score is recorded.',
      'It only matters when the internet is available.',
      'It should never be used in teacher analytics.',
    ],
    correctAnswer: `It should be learned with a source-backed explanation and targeted practice.`,
    explanation: `The correct choice ties the concept to grounded lesson material and personalized practice.`,
    topicTag: concept,
    sourceRef,
  };
};

export const createLessonMap = (material: CourseMaterial) => extractConcepts(material);

export const generateOfflineQuiz = (request: QuizRequest): Quiz => {
  const concepts = request.material.lessonMap?.length
    ? request.material.lessonMap
    : extractConcepts(request.material);
  const count = request.difficulty === 'hard' ? 5 : request.difficulty === 'medium' ? 4 : 3;
  const questions = Array.from({ length: count }, (_, index) => {
    const concept = concepts[index % concepts.length];
    const type =
      request.questionType === 'Mixed'
        ? (index % 3 === 0 ? 'MCQ' : index % 3 === 1 ? 'True/False' : 'Short')
        : request.questionType;

    return buildQuestion(
      `q_${Date.now()}_${index}`,
      concept.concept,
      request.difficulty,
      type,
      concept.sourceRef,
    );
  });

  return {
    id: `quiz_${Date.now()}`,
    courseId: request.courseId,
    title: request.title,
    sourceMaterialId: request.material.id,
    difficulty: request.difficulty,
    questionType: request.questionType,
    timeLimit: request.timeLimit,
    isTestMode: request.isTestMode,
    isPublished: true,
    questions,
  };
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
};

export const generatePracticeSet = (request: PracticeSetRequest): PracticeSet => {
  const { mistakes, weakTopics } = request;
  const mistakeTypeMap: Record<MistakeType, string> = {
    'Conceptual gap': 'Start from the basics — here is a simple explanation, then one easier question.',
    'Careless mistake': 'Here is a similar question — read carefully before answering.',
    'Misread question': 'Here is a question with key command words underlined — identify what is being asked.',
    'Partial understanding': 'Here is a slightly harder version — try to include more detail this time.',
  };

  const questions: PracticeQuestion[] = mistakes.flatMap((mistake, idx) => {
    const baseText = mistake.questionText;
    const hint = mistakeTypeMap[mistake.mistakeType] || 'Review the material and try again.';
    const topic = mistake.questionText.length > 60 ? mistake.questionText.slice(0, 60) + '...' : mistake.questionText;

    const practiceMCQ: PracticeQuestion = {
      id: `pq_${request.attemptId}_${idx}_mcq`,
      text: `Practice: ${baseText}`,
      hint,
      options: [
        mistake.correctAnswer,
        `Incorrect: this option shows the common ${mistake.mistakeType.toLowerCase()} pattern.`,
        `Incorrect: students often pick this when they ${mistake.mistakeType === 'Misread question' ? 'skip reading the command word.' : 'don\'t check their work.'}`,
        `Incorrect: re-read the source material to confirm.`,
      ],
      correctAnswer: mistake.correctAnswer,
      explanation: `${mistake.explanation} Focus on: ${mistake.mistakeType === 'Conceptual gap' ? 'understanding the core idea.' : mistake.mistakeType === 'Careless mistake' ? 'slowing down and double-checking.' : mistake.mistakeType === 'Misread question' ? 'reading every word carefully.' : 'adding more detail to your reasoning.'}`,
      topicTag: mistake.mistakeType,
      mistakeType: mistake.mistakeType,
    };

    const practiceShort: PracticeQuestion = {
      id: `pq_${request.attemptId}_${idx}_short`,
      text: `Short answer: In 2-3 sentences, explain the key idea behind: "${topic}".`,
      hint: `Hint: Start with "${mistake.correctAnswer.split(' ').slice(0, 3).join(' ')}..." and build from there.`,
      correctAnswer: mistake.correctAnswer,
      explanation: mistake.explanation,
      topicTag: mistake.mistakeType,
      mistakeType: mistake.mistakeType,
    };

    return [practiceMCQ, practiceShort];
  });

  return {
    id: `ps_${request.attemptId}`,
    studentId: request.studentId,
    courseId: request.courseId,
    courseTitle: request.courseTitle,
    basedOnAttemptId: request.attemptId,
    generatedAt: nowStamp(),
    focusTopics: weakTopics,
    difficulty: 'easy',
    targetMistakeTypes: mistakes.map((m) => m.mistakeType),
    description: `Targeted practice covering ${mistakes.length} weak area${mistakes.length > 1 ? 's' : ''}: ${weakTopics.join(', ')}.`,
    questions,
    completed: false,
  };
};

const nowStamp = () => new Date().toISOString().replace('T', ' ').slice(0, 16);

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface AISettings {
  openRouterApiKey: string;
  openRouterModelId: string;
  openRouterBackupModelId: string;
  openRouterBaseUrl: string;
  localEndpoint: string;
  localModelName: string;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  openRouterApiKey: '',
  openRouterModelId: 'google/gemma-4-26b-a4b-it:free',
  openRouterBackupModelId: 'google/gemma-4-31b-it:free',
  openRouterBaseUrl: 'https://openrouter.ai/api/v1',
  localEndpoint: 'http://localhost:11434',
  localModelName: 'gemma2:2b',
};

/** Catalog of Gemma models users can download via Ollama from the app. */
export type DownloadableModel = {
  id: string;
  name: string;
  label: string;
  sizeHint: string;
  description: string;
};

export const DOWNLOADABLE_GEMMA_MODELS: DownloadableModel[] = [
  {
    id: 'gemma2:2b',
    name: 'gemma2:2b',
    label: 'Gemma 2 · 2B',
    sizeHint: '~1.6 GB',
    description: 'Fast, low-RAM. Best for laptops and quick offline help.',
  },
  {
    id: 'gemma2:9b',
    name: 'gemma2:9b',
    label: 'Gemma 2 · 9B',
    sizeHint: '~5.4 GB',
    description: 'Stronger answers. Needs more RAM and disk space.',
  },
  {
    id: 'gemma3:1b',
    name: 'gemma3:1b',
    label: 'Gemma 3 · 1B',
    sizeHint: '~800 MB',
    description: 'Lightest option. Good for weak hardware and quick tests.',
  },
  {
    id: 'gemma3:4b',
    name: 'gemma3:4b',
    label: 'Gemma 3 · 4B',
    sizeHint: '~3.3 GB',
    description: 'Balanced quality and speed for classroom use.',
  },
];

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
When source material is provided, ground answers in that material.`;

const MATERIAL_ANALYSIS_SYSTEM = `You analyze study materials for teachers and students.
Return clear, structured educational content only.
Use plain text with short headings. Do not invent facts that are not supported by the material.`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatHttpError(status: number, body: string, prefix: string): string {
  let detail = body.trim();
  try {
    const parsed = JSON.parse(body);
    if (parsed?.error?.message) detail = parsed.error.message;
    else if (typeof parsed?.error === 'string') detail = parsed.error;
    else if (parsed?.message) detail = parsed.message;
    else detail = JSON.stringify(parsed, null, 2);
  } catch {
    // keep raw body
  }
  if (!detail) detail = `(no response body)`;
  return `${prefix} failed (HTTP ${status}).\n\nDetails:\n${detail}`;
}

async function readErrorBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

function normalizeEndpoint(endpoint: string): string {
  return (endpoint || 'http://localhost:11434').replace(/\/$/, '');
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
    if (!model.connected) {
      throw new Error(
        'Local model is not connected.\n\n' +
          '1. Install Ollama from https://ollama.com\n' +
          '2. Start Ollama (it should run in the background)\n' +
          '3. Open Model settings → download a Gemma model → click Test Offline Model',
      );
    }

    const endpoint = normalizeEndpoint(model.endpoint);
    const modelName = model.modelName || 'gemma2:2b';
    const system = systemPrompt || (style === 'urdu-en' ? URDU_ENGLISH_SYSTEM : ENGLISH_SYSTEM);

    let response: Response;
    try {
      response = await robustFetch(`${endpoint}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
          stream: false,
          options: {
            temperature: 0.7,
            top_p: 0.9,
            num_predict: 1536,
          },
        } as OllamaChatRequest),
        timeoutMs: 180_000,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Cannot reach Ollama at ${endpoint}.\n\n` +
          `Error: ${msg}\n\n` +
          `Install Ollama from https://ollama.com and make sure it is running, then retry.`,
      );
    }

    if (!response.ok) {
      const body = await readErrorBody(response);
      if (response.status === 404) {
        throw new Error(
          `Model "${modelName}" was not found on Ollama.\n\n` +
            `Download it from Model settings, or run:\nollama pull ${modelName}\n\n` +
            (body ? `Server detail: ${body}` : ''),
        );
      }
      throw new Error(formatHttpError(response.status, body, 'Ollama chat'));
    }

    const data: OllamaChatResponse = await response.json();
    return {
      text: data.message?.content || 'Ollama returned an empty response.',
      modeUsed: 'OFFLINE',
      providerName: `Ollama (${modelName})`,
      fromCache: false,
    };
  }
}

// ─── OpenRouter Gemma ─────────────────────────────────────────────────────────

export class OpenRouterGemmaProvider {
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
    const primary = settings.openRouterModelId || DEFAULT_AI_SETTINGS.openRouterModelId;
    const backup = settings.openRouterBackupModelId || DEFAULT_AI_SETTINGS.openRouterBackupModelId;
    const baseUrl = normalizeOpenRouterBase(settings.openRouterBaseUrl);

    try {
      return await this.callModel(baseUrl, settings.openRouterApiKey.trim(), primary, system, prompt);
    } catch (primaryError) {
      const primaryMsg = primaryError instanceof Error ? primaryError.message : String(primaryError);
      // Retry with backup model when primary fails for non-auth reasons
      if (
        backup &&
        backup !== primary &&
        !/api key|unauthorized|401|403|invalid.*key/i.test(primaryMsg)
      ) {
        try {
          const result = await this.callModel(baseUrl, settings.openRouterApiKey.trim(), backup, system, prompt);
          return {
            ...result,
            providerName: `${result.providerName} [backup after primary failed]`,
            text: result.text,
          };
        } catch (backupError) {
          const backupMsg = backupError instanceof Error ? backupError.message : String(backupError);
          throw new Error(
            `Online model failed.\n\nPrimary (${primary}):\n${primaryMsg}\n\nBackup (${backup}):\n${backupMsg}`,
          );
        }
      }
      throw primaryError instanceof Error ? primaryError : new Error(primaryMsg);
    }
  }

  private async callModel(
    baseUrl: string,
    apiKey: string,
    modelId: string,
    system: string,
    prompt: string,
  ): Promise<AIProviderResult> {
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
          max_tokens: 1536,
          temperature: 0.7,
        }),
        timeoutMs: 120_000,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Cannot reach OpenRouter at ${baseUrl}/chat/completions.\n\n` +
          `Error: ${msg}\n\n` +
          `Check your internet connection and base URL.`,
      );
    }

    if (!response.ok) {
      const body = await readErrorBody(response);
      throw new Error(formatHttpError(response.status, body, `OpenRouter (${modelId})`));
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new Error(
        `OpenRouter (${modelId}) returned an empty response.\n\n` +
          `Full payload:\n${JSON.stringify(data, null, 2).slice(0, 1500)}`,
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
): Promise<{ ok: boolean; message: string; modelUsed?: string }> {
  if (!apiKey?.trim()) {
    return {
      ok: false,
      message: 'API key is empty. Paste your OpenRouter key (starts with sk-or-) in settings.',
    };
  }

  const base = normalizeOpenRouterBase(baseUrl);
  const primary = modelId || DEFAULT_AI_SETTINGS.openRouterModelId;
  const backup = backupModelId || DEFAULT_AI_SETTINGS.openRouterBackupModelId;

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

  const primaryResult = await tryModel(primary);
  if (primaryResult.ok) return primaryResult;

  if (backup && backup !== primary) {
    const backupResult = await tryModel(backup);
    if (backupResult.ok) {
      return {
        ...backupResult,
        message:
          `Primary model failed; backup succeeded.\n\n` +
          `Primary error:\n${primaryResult.message}\n\n` +
          `Backup result:\n${backupResult.message}`,
      };
    }
    return {
      ok: false,
      message:
        `Both online models failed.\n\n` +
        `Primary (${primary}):\n${primaryResult.message}\n\n` +
        `Backup (${backup}):\n${backupResult.message}`,
    };
  }

  return primaryResult;
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
 * Extract summary, important points, and study help from uploaded material text
 * using the active Online / Offline / Hybrid Gemma route.
 */
export async function processMaterialWithAI(
  title: string,
  contentText: string,
  mode: AIMode,
  model: LocalModelState,
  settings: AISettings,
  style: LanguageStyle = 'en',
): Promise<MaterialAIAnalysis> {
  const excerpt = compact(contentText || title, 12000);
  if (!excerpt.trim()) {
    throw new Error(
      'No extractable text found in the uploaded file.\n\n' +
        'For scanned PDFs, paste notes in the summary field. For text PDFs, re-upload a searchable PDF.',
    );
  }

  const prompt =
    `Analyze this study material for a classroom app.\n\n` +
    `Title: ${title}\n\n` +
    `Material content:\n${excerpt}\n\n` +
    `Respond in EXACTLY this format (plain text):\n` +
    `SUMMARY:\n(3-6 sentences summarizing the material)\n\n` +
    `IMPORTANT POINTS:\n- point 1\n- point 2\n- point 3\n(5-10 bullet points)\n\n` +
    `STUDY HELP:\n(short study plan + 3 practice questions students can try)`;

  const result = await routerSingleton.complete(prompt, mode, model, style, settings, MATERIAL_ANALYSIS_SYSTEM);
  const parsed = parseMaterialAnalysis(result.text);
  return {
    ...parsed,
    providerName: result.providerName,
    modeUsed: result.modeUsed,
  };
}

// ─── Auto Gemma Router ────────────────────────────────────────────────────────

export class AutoGemmaRouter {
  private local = new LocalGemmaProvider();
  private cloud = new OpenRouterGemmaProvider();

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
      `${mode}:${model.connected}:${model.modelName}:${resolvedSettings.openRouterModelId}:${style}:${prompt}`,
    );
    const cache = await loadCache();
    if (cache[cacheKey]) {
      return { ...cache[cacheKey], fromCache: true };
    }

    let result: AIProviderResult;
    if (mode === 'OFFLINE') {
      result = await this.local.complete(prompt, model, style, systemPrompt);
    } else if (mode === 'ONLINE') {
      result = await this.cloud.complete(prompt, resolvedSettings, style, systemPrompt);
    } else {
      // HYBRID: online first, fallback to local
      try {
        result = await this.cloud.complete(prompt, resolvedSettings, style, systemPrompt);
      } catch (onlineError) {
        if (model.connected) {
          try {
            result = await this.local.complete(prompt, model, style, systemPrompt);
          } catch (offlineError) {
            const onlineMsg = onlineError instanceof Error ? onlineError.message : String(onlineError);
            const offlineMsg = offlineError instanceof Error ? offlineError.message : String(offlineError);
            throw new Error(
              `Hybrid mode failed.\n\nOnline error:\n${onlineMsg}\n\nOffline error:\n${offlineMsg}`,
            );
          }
        } else {
          const onlineMsg = onlineError instanceof Error ? onlineError.message : String(onlineError);
          throw new Error(
            `Online Gemma unavailable and local model is not connected.\n\n` +
              `Online error:\n${onlineMsg}\n\n` +
              `Connect Ollama offline mode or fix your OpenRouter key, then retry.`,
          );
        }
      }
    }

    cache[cacheKey] = result;
    await persistCache(cache);
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
