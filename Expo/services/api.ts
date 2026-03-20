import { Platform } from 'react-native';

import type { SupportedLanguage } from '@/constants/languages';

const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
const envApiKey = process.env.EXPO_PUBLIC_API_KEY;

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

function withApiKey(headers: Record<string, string> = {}): Record<string, string> {
  if (!envApiKey) {
    return headers;
  }

  return {
    ...headers,
    'X-API-Key': envApiKey,
  };
}

function inferAudioMimeType(uri: string): string {
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
  const res = await fetch(`${API_BASE_URL}/languages`, {
    headers: withApiKey(),
  });
  if (!res.ok) {
    throw new Error(`Language fetch failed (${res.status})`);
  }

  const payload: unknown = await res.json();
  if (!Array.isArray(payload)) {
    throw new Error('Language fetch returned invalid payload');
  }

  return payload.filter((item): item is SupportedLanguage => typeof item === 'string');
}

export async function translateText(params: {
  text: string;
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  includeSpeech?: boolean;
}): Promise<TranslationResponse> {
  const res = await fetch(`${API_BASE_URL}/translate/text`, {
    method: 'POST',
    headers: withApiKey({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      text: params.text,
      source_language: params.sourceLanguage,
      target_language: params.targetLanguage,
      include_speech: params.includeSpeech ?? false,
    }),
  });

  if (!res.ok) {
    throw new Error(`Text translation failed (${res.status})`);
  }

  return res.json();
}

export async function translateSpeech(params: {
  audioFile: AudioUploadSource;
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  includeSpeech?: boolean;
}): Promise<TranslationResponse> {
  const data = new FormData();
  if (typeof params.audioFile === 'object' && params.audioFile !== null && 'uri' in params.audioFile) {
    data.append('audio', params.audioFile as unknown as Blob);
  } else {
    data.append('audio', params.audioFile, 'recording.webm');
  }
  data.append('source_language', params.sourceLanguage);
  data.append('target_language', params.targetLanguage);
  data.append('include_speech', String(params.includeSpeech ?? false));

  const res = await fetch(`${API_BASE_URL}/translate/speech`, {
    method: 'POST',
    headers: withApiKey(),
    body: data,
  });

  if (!res.ok) {
    throw new Error(`Speech translation failed (${res.status})`);
  }

  return res.json();
}

export function toAbsoluteAudioUrl(audioUrl?: string | null): string | undefined {
  if (!audioUrl) return undefined;
  if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) return audioUrl;
  return `${API_BASE_URL}${audioUrl.startsWith('/') ? '' : '/'}${audioUrl}`;
}
