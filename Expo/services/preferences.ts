// Local preference storage for Vaani Connect.
//
// This file keeps the latest language pair, app mode, microphone onboarding
// state, and recent translations on the device. The app still works if storage
// fails; it just falls back to defaults.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { isSupportedLanguage, type SupportedLanguage } from '@/constants/languages';

const STORAGE_KEY = 'vaani-connect.preferences';
const MAX_HISTORY_ITEMS = 10;

export type TranslationOrigin = 'text' | 'speech';
export type AppMode = 'translate' | 'conversation';

export type StoredHistoryEntry = {
  id: string;
  createdAt: string;
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  sourceText: string;
  translatedText: string;
  transcribedText?: string;
  origin: TranslationOrigin;
};

export type StoredPreferences = {
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  lastMode: AppMode;
  microphoneOnboardingDismissed: boolean;
  recentHistory: StoredHistoryEntry[];
};

export async function loadStoredPreferences(): Promise<StoredPreferences | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    // Treat stored JSON as untrusted. Old app versions or manual edits can
    // leave invalid data, so every field is checked before it is used.
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'sourceLanguage' in parsed &&
      'targetLanguage' in parsed &&
      typeof parsed.sourceLanguage === 'string' &&
      typeof parsed.targetLanguage === 'string'
    ) {
      const candidate = parsed as {
        sourceLanguage: string;
        targetLanguage: string;
        lastMode?: unknown;
        microphoneOnboardingDismissed?: unknown;
        recentHistory?: unknown;
      };

      if (
        isSupportedLanguage(candidate.sourceLanguage) &&
        isSupportedLanguage(candidate.targetLanguage) &&
        typeof candidate.microphoneOnboardingDismissed === 'boolean' &&
        Array.isArray(candidate.recentHistory) &&
        (candidate.lastMode === undefined || candidate.lastMode === 'translate' || candidate.lastMode === 'conversation')
      ) {
        return {
          sourceLanguage: candidate.sourceLanguage,
          targetLanguage: candidate.targetLanguage,
          lastMode: candidate.lastMode === 'conversation' ? 'conversation' : 'translate',
          microphoneOnboardingDismissed: candidate.microphoneOnboardingDismissed,
          recentHistory: candidate.recentHistory.filter(isStoredHistoryEntry).slice(0, MAX_HISTORY_ITEMS),
        };
      }

      if (isSupportedLanguage(candidate.sourceLanguage) && isSupportedLanguage(candidate.targetLanguage)) {
        return {
          sourceLanguage: candidate.sourceLanguage,
          targetLanguage: candidate.targetLanguage,
          lastMode: 'translate',
          microphoneOnboardingDismissed: false,
          recentHistory: [],
        };
      }
    }
  } catch {
    return null;
  }

  return null;
}

export async function saveStoredPreferences(preferences: StoredPreferences): Promise<void> {
  try {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...preferences,
        recentHistory: preferences.recentHistory.filter(isStoredHistoryEntry).slice(0, MAX_HISTORY_ITEMS),
      }),
    );
  } catch {
    // Ignore persistence errors; the app still works with defaults.
  }
}

function isStoredHistoryEntry(value: unknown): value is StoredHistoryEntry {
  // Recent history is displayed directly in the UI, so validate entries before
  // restoring them from AsyncStorage.
  const candidate = value as {
    id?: unknown;
    createdAt?: unknown;
    sourceLanguage?: unknown;
    targetLanguage?: unknown;
    sourceText?: unknown;
    translatedText?: unknown;
    transcribedText?: unknown;
    origin?: unknown;
  };

  return (
    typeof value === 'object' &&
    value !== null &&
      'id' in value &&
    'createdAt' in value &&
    'sourceLanguage' in value &&
    'targetLanguage' in value &&
    'sourceText' in value &&
    'translatedText' in value &&
    'origin' in value &&
    typeof candidate.id === 'string' &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.sourceLanguage === 'string' &&
    isSupportedLanguage(candidate.sourceLanguage) &&
    typeof candidate.targetLanguage === 'string' &&
    isSupportedLanguage(candidate.targetLanguage) &&
    typeof candidate.sourceText === 'string' &&
    typeof candidate.translatedText === 'string' &&
    (candidate.transcribedText === undefined || typeof candidate.transcribedText === 'string') &&
    (candidate.origin === 'text' || candidate.origin === 'speech')
  );
}
