import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { isDesktopRuntime } from './desktop';

export type HfPresetModel = {
  id: string;
  label: string;
  description: string;
  sizeHint: string;
  /** Hugging Face repo id, e.g. bartowski/gemma-2-2b-it-GGUF */
  repo: string;
  /** Preferred GGUF filename inside the repo */
  filename: string;
  hfUrl: string;
};

/** Curated public GGUF Gemma models — no Ollama required */
export const HF_GEMMA_PRESETS: HfPresetModel[] = [
  {
    id: 'gemma2-2b-q4',
    label: 'Gemma 2 · 2B (Q4)',
    description: 'Best starter offline model. Lower RAM, fast answers.',
    sizeHint: '~1.6 GB',
    repo: 'bartowski/gemma-2-2b-it-GGUF',
    filename: 'gemma-2-2b-it-Q4_K_M.gguf',
    hfUrl: 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF',
  },
  {
    id: 'gemma2-2b-q5',
    label: 'Gemma 2 · 2B (Q5)',
    description: 'Slightly higher quality. Needs a bit more RAM/disk.',
    sizeHint: '~1.9 GB',
    repo: 'bartowski/gemma-2-2b-it-GGUF',
    filename: 'gemma-2-2b-it-Q5_K_M.gguf',
    hfUrl: 'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF',
  },
  {
    id: 'gemma2-9b-q4',
    label: 'Gemma 2 · 9B (Q4)',
    description: 'Stronger reasoning. Needs a solid laptop (8GB+ free RAM).',
    sizeHint: '~5.5 GB',
    repo: 'bartowski/gemma-2-9b-it-GGUF',
    filename: 'gemma-2-9b-it-Q4_K_M.gguf',
    hfUrl: 'https://huggingface.co/bartowski/gemma-2-9b-it-GGUF',
  },
];

export type LocalGgufModel = {
  name: string;
  path: string;
  sizeBytes: number;
  sizeLabel: string;
};

export type DownloadProgressEvent = {
  percent: number;
  downloadedBytes: number;
  totalBytes: number | null;
  status: string;
  detail?: string;
};

export type OfflineRuntimeStatus = {
  running: boolean;
  endpoint: string;
  modelPath: string | null;
  message: string;
};

function requireDesktop(): void {
  if (!isDesktopRuntime()) {
    throw new Error(
      'Offline Hugging Face models require the desktop app.\n\n' +
        'Open the Windows installer / LetsDoIT.exe (not the browser-only preview).',
    );
  }
}

export async function listLocalGgufModels(): Promise<LocalGgufModel[]> {
  requireDesktop();
  return invoke<LocalGgufModel[]>('list_local_gguf_models');
}

export async function resolveHfModelTarget(
  urlOrRepo: string,
  preferredFilename?: string,
  hfToken?: string,
): Promise<{ repo: string; filename: string; downloadUrl: string; sizeBytes: number | null }> {
  requireDesktop();
  return invoke('resolve_hf_model_target', {
    urlOrRepo,
    preferredFilename: preferredFilename || null,
    hfToken: hfToken || null,
  });
}

export async function downloadHfModel(options: {
  urlOrRepo: string;
  filename?: string;
  hfToken?: string;
  onProgress?: (p: DownloadProgressEvent) => void;
}): Promise<{ ok: boolean; message: string; path?: string; name?: string }> {
  requireDesktop();

  let unlisten: UnlistenFn | null = null;
  try {
    if (options.onProgress) {
      unlisten = await listen<DownloadProgressEvent>('hf-download-progress', (event) => {
        options.onProgress?.(event.payload);
      });
    }

    return await invoke('download_hf_model', {
      urlOrRepo: options.urlOrRepo,
      preferredFilename: options.filename || null,
      hfToken: options.hfToken || null,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, message: msg };
  } finally {
    if (unlisten) unlisten();
  }
}

export async function ensureOfflineRuntime(modelPath: string): Promise<OfflineRuntimeStatus> {
  requireDesktop();
  return invoke<OfflineRuntimeStatus>('ensure_offline_runtime', { modelPath });
}

export async function stopOfflineRuntime(): Promise<void> {
  if (!isDesktopRuntime()) return;
  try {
    await invoke('stop_offline_runtime');
  } catch {
    // ignore
  }
}

export async function getOfflineRuntimeStatus(): Promise<OfflineRuntimeStatus> {
  requireDesktop();
  return invoke<OfflineRuntimeStatus>('offline_runtime_status');
}

export async function offlineChat(options: {
  messages: { role: string; content: string }[];
  maxTokens?: number;
  temperature?: number;
}): Promise<{ text: string; providerName: string }> {
  requireDesktop();
  return invoke('offline_chat', {
    messages: options.messages,
    maxTokens: options.maxTokens ?? 1024,
    temperature: options.temperature ?? 0.7,
  });
}

export async function testOfflineHfModel(modelPath: string): Promise<{ ok: boolean; message: string; reply?: string }> {
  requireDesktop();
  try {
    const runtime = await ensureOfflineRuntime(modelPath);
    if (!runtime.running) {
      return { ok: false, message: runtime.message };
    }
    const result = await offlineChat({
      messages: [
        { role: 'system', content: 'You are a concise classroom assistant.' },
        { role: 'user', content: 'Reply with exactly: Offline Gemma ready.' },
      ],
      maxTokens: 32,
      temperature: 0,
    });
    return {
      ok: true,
      message:
        `Offline model works (no Ollama).\n` +
        `Model file: ${modelPath}\n` +
        `Local runtime: ${runtime.endpoint}\n` +
        `Sample reply: ${result.text || '(empty)'}`,
      reply: result.text,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { ok: false, message: msg };
  }
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
