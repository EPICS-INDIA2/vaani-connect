// Frontend API client for Vaani Connect.
//
// Screens and hooks call these helpers instead of using fetch directly. Keep
// endpoint paths, request field names, and response types matched to
// backend/app/server.py.

import { Platform } from 'react-native';

import type { SupportedLanguage } from '@/constants/languages';

const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const envApiKey = process.env.EXPO_PUBLIC_API_KEY;
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;
const PROBE_TIMEOUT_MS = 8000;

// Android emulators cannot use localhost to reach the computer running the
// backend, so they use 10.0.2.2. iOS simulator and web can use localhost.
const defaultBaseUrl = Platform.select({
  android: 'http://10.0.2.2:8000',
  ios: 'http://localhost:8000',
  web: 'http://localhost:8000',
  default: 'http://localhost:8000',
});

export const API_BASE_URL = (envBaseUrl ?? defaultBaseUrl ?? '').replace(/\/$/, '');

export type NativeAudioUpload = {
  uri: string;
  name: string;
  type: string;
};

export type AudioUploadSource = Blob | NativeAudioUpload;

export type TranslationResponse = {
  source_text?: string;
  transcribed_text?: string;
  translated_text: string;
  audio_url?: string | null;
};

export type ApiErrorCode =
  | 'backend_unreachable'
  | 'network_failed'
  | 'translation_failed'
  | 'speech_translation_failed'
  | 'audio_unavailable'
  | 'unauthorized';

export type BackendStatus = 'ready' | 'warming_up' | 'offline' | 'unauthorized' | 'error';

export type BackendStatusSnapshot = {
  status: BackendStatus;
  checkedAt: string;
};

type JsonOperation = 'languages' | 'text' | 'speech';

export class ApiError extends Error {
  code: ApiErrorCode;
  status?: number;

  constructor(code: ApiErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

function withApiKey(headers: Record<string, string> = {}): Record<string, string> {
  // The backend only requires this header when VAANI_API_KEY is set.
  if (!envApiKey) {
    return headers;
  }

  return {
    ...headers,
    'X-API-Key': envApiKey,
  };
}

function mapErrorCode(operation: 'languages' | 'text' | 'speech' | 'audio', status?: number): ApiErrorCode {
  if (status === 401 || status === 403) return 'unauthorized';
  if (operation === 'speech') return 'speech_translation_failed';
  if (operation === 'audio') return 'audio_unavailable';
  return 'translation_failed';
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError;
}

function isNativeAudioUpload(audioFile: AudioUploadSource): audioFile is NativeAudioUpload {
  return typeof audioFile === 'object' && audioFile !== null && 'uri' in audioFile;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  // React Native fetch has no built-in timeout, so AbortController prevents the
  // app from waiting forever when the backend is offline or warming up.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function isUnauthorizedStatus(status: number): boolean {
  return status === 401 || status === 403;
}

async function probePath(path: '/health' | '/ready'): Promise<Response | null> {
  // /ready means models are loaded; /health only means the server process is
  // alive. The UI uses both to show "ready" versus "warming up".
  try {
    return await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      headers: withApiKey(),
    }, PROBE_TIMEOUT_MS);
  } catch (error) {
    if (isAbortError(error) || isNetworkFailure(error)) {
      return null;
    }

    throw error;
  }
}

export async function probeBackendStatus(): Promise<BackendStatusSnapshot> {
  const checkedAt = new Date().toISOString();

  const readyResponse = await probePath('/ready');
  if (readyResponse?.ok) {
    return { status: 'ready', checkedAt };
  }

  if (readyResponse && isUnauthorizedStatus(readyResponse.status)) {
    return { status: 'unauthorized', checkedAt };
  }

  const healthResponse = await probePath('/health');
  if (healthResponse?.ok) {
    return { status: 'warming_up', checkedAt };
  }

  if (healthResponse && isUnauthorizedStatus(healthResponse.status)) {
    return { status: 'unauthorized', checkedAt };
  }

  if (!readyResponse && !healthResponse) {
    return { status: 'offline', checkedAt };
  }

  return { status: 'error', checkedAt };
}

async function requestJson<T>(
  input: string,
  init: RequestInit,
  operation: JsonOperation,
): Promise<T> {
  // Shared JSON request wrapper. It converts low-level fetch failures into
  // ApiError codes that the screen can turn into beginner-friendly messages.
  try {
    const res = await fetchWithTimeout(input, init, DEFAULT_REQUEST_TIMEOUT_MS);

    if (!res.ok) {
      throw new ApiError(
        mapErrorCode(operation, res.status),
        `${operation} request failed`,
        res.status,
      );
    }

    return (await res.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (isAbortError(error)) {
      throw new ApiError('network_failed', `${operation} request timed out`);
    }

    if (isNetworkFailure(error)) {
      throw new ApiError('backend_unreachable', `${operation} request could not reach backend`);
    }

    throw new ApiError(mapErrorCode(operation), `${operation} request failed`);
  }
}

function inferAudioMimeType(uri: string): string {
  // Native recordings provide file URIs, so we infer the upload content type
  // from the extension before sending FormData to the backend.
  const normalized = uri.toLowerCase();

  if (normalized.endsWith('.m4a')) return 'audio/mp4';
  if (normalized.endsWith('.wav')) return 'audio/wav';
  if (normalized.endsWith('.mp3')) return 'audio/mpeg';
  if (normalized.endsWith('.ogg')) return 'audio/ogg';
  if (normalized.endsWith('.flac')) return 'audio/flac';
  if (normalized.endsWith('.webm')) return 'audio/webm';

  return 'audio/mp4';
}

export function createNativeAudioUpload(uri: string): NativeAudioUpload {
  const extensionMatch = uri.match(/(\.[a-z0-9]+)(?:\?|$)/i);
  const extension = extensionMatch?.[1]?.toLowerCase() ?? '.m4a';

  return {
    uri,
    name: `recording${extension}`,
    type: inferAudioMimeType(uri),
  };
}

export async function fetchSupportedLanguages(): Promise<SupportedLanguage[]> {
  const payload = await requestJson<unknown>(`${API_BASE_URL}/languages`, {
    headers: withApiKey(),
  }, 'languages');

  if (!Array.isArray(payload)) {
    throw new ApiError('translation_failed', 'Language fetch returned invalid payload');
  }

  return payload.filter((item): item is SupportedLanguage => typeof item === 'string');
}

export async function translateText(params: {
  text: string;
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  includeSpeech?: boolean;
}): Promise<TranslationResponse> {
  // Text translation endpoint. includeSpeech=false keeps normal translations
  // fast; the app can request speech later when the user taps Listen.
  return requestJson<TranslationResponse>(`${API_BASE_URL}/translate/text`, {
    method: 'POST',
    headers: withApiKey({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      text: params.text,
      source_language: params.sourceLanguage,
      target_language: params.targetLanguage,
      include_speech: params.includeSpeech ?? false,
    }),
  }, 'text');
}

export async function translateSpeech(params: {
  audioFile: AudioUploadSource;
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  includeSpeech?: boolean;
}): Promise<TranslationResponse> {
  // Speech translation uses multipart FormData because the backend receives an
  // audio file plus source/target language fields in one request.
  const data = new FormData();
  if (isNativeAudioUpload(params.audioFile)) {
    data.append('audio', params.audioFile as unknown as Blob);
  } else {
    data.append('audio', params.audioFile, 'recording.webm');
  }
  data.append('source_language', params.sourceLanguage);
  data.append('target_language', params.targetLanguage);
  data.append('include_speech', String(params.includeSpeech ?? false));

  return requestJson<TranslationResponse>(`${API_BASE_URL}/translate/speech`, {
    method: 'POST',
    headers: withApiKey(),
    body: data,
  }, 'speech');
}

export function toAbsoluteAudioUrl(audioUrl?: string | null): string | undefined {
  if (!audioUrl) return undefined;
  if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) return audioUrl;
  return `${API_BASE_URL}${audioUrl.startsWith('/') ? '' : '/'}${audioUrl}`;
}
