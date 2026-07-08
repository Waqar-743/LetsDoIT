import {
  AIMode,
  AIProviderResult,
  CourseMaterial,
  LocalModelState,
  MistakeType,
  Quiz,
  QuizQuestion,
} from '../types';

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

const CACHE_KEY = 'letsdoit_ai_cache_v2';

const readCache = (): Record<string, AIProviderResult> => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
  } catch {
    return {};
  }
};

const writeCache = (cache: Record<string, AIProviderResult>) => {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
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

class LocalGemmaProvider {
  async complete(prompt: string, model: LocalModelState): Promise<AIProviderResult> {
    if (!model.connected) {
      throw new Error('Local Gemma is not connected.');
    }

    return {
      text: `Local Gemma (${model.modelName})\n\n${compact(prompt, 260)}\n\nOffline answer: I will keep this grounded in the selected course material, explain the concept plainly, and finish with targeted practice. For weak-area work, I classify mistakes as conceptual gap, careless mistake, misread question, or partial understanding.`,
      modeUsed: 'OFFLINE',
      providerName: model.provider,
      fromCache: false,
    };
  }
}

class CloudGemmaProvider {
  async complete(prompt: string): Promise<AIProviderResult> {
    const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('No hosted Gemma API key configured.');
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemma-3-27b-it:free',
        messages: [
          {
            role: 'system',
            content: 'You are Gemma for an offline-first Pakistani classroom. Return concise, source-grounded teaching help.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error('Hosted Gemma request failed.');
    }

    const data = await response.json();
    return {
      text: data.choices?.[0]?.message?.content || 'Hosted Gemma returned an empty response.',
      modeUsed: 'ONLINE',
      providerName: 'OpenRouter Gemma',
      fromCache: false,
    };
  }
}

export class AutoGemmaRouter {
  private local = new LocalGemmaProvider();
  private cloud = new CloudGemmaProvider();

  async complete(prompt: string, mode: AIMode, model: LocalModelState): Promise<AIProviderResult> {
    const cacheKey = await hashContent(`${mode}:${model.connected}:${prompt}`);
    const cache = readCache();
    if (cache[cacheKey]) {
      return { ...cache[cacheKey], fromCache: true };
    }

    let result: AIProviderResult;
    if (mode === 'OFFLINE') {
      result = await this.local.complete(prompt, model);
    } else if (mode === 'ONLINE') {
      result = await this.cloud.complete(prompt);
    } else {
      try {
        const heavy = prompt.length > 900 || /image|diagram|hard|diagnose|analytics/i.test(prompt);
        result = heavy ? await this.cloud.complete(prompt) : await this.local.complete(prompt, model);
      } catch {
        result = await this.local.complete(prompt, model);
      }
    }

    cache[cacheKey] = result;
    writeCache(cache);
    return result;
  }
}
