import AsyncStorage from '@react-native-async-storage/async-storage';

import type { SupportedLanguage } from '@/constants/languages';

const STORAGE_KEY = 'vaani-connect.preferences';

export type StoredPreferences = {
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
};

export async function loadStoredPreferences(): Promise<StoredPreferences | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'sourceLanguage' in parsed &&
      'targetLanguage' in parsed &&
      typeof parsed.sourceLanguage === 'string' &&
      typeof parsed.targetLanguage === 'string'
    ) {
      return {
        sourceLanguage: parsed.sourceLanguage,
        targetLanguage: parsed.targetLanguage,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export async function saveStoredPreferences(preferences: StoredPreferences): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Ignore persistence errors; the app still works with defaults.
  }
}
