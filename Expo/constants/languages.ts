// Language names used by the Expo app.
//
// These strings are sent to the backend, which maps them to model-specific
// language codes in backend/app/languages.py. Keep both files synchronized when
// adding, removing, or renaming a language.

export const SUPPORTED_LANGUAGES = [
  'English',
  'Assamese',
  'Bodo',
  'Dogri',
  'Gujarati',
  'Hindi',
  'Kannada',
  'Kashmiri',
  'Konkani',
  'Maithili',
  'Malayalam',
  'Bengali',
  'Manipuri',
  'Marathi',
  'Nepali',
  'Odia',
  'Punjabi',
  'Sanskrit',
  'Santali',
  'Sindhi',
  'Tamil',
  'Telugu',
  'Urdu',
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
const SUPPORTED_LANGUAGE_SET = new Set<string>(SUPPORTED_LANGUAGES);

// Labels shown in the picker. The object keys must stay exactly equal to the
// SupportedLanguage names above because getLanguageLabel indexes this map.
export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  English: 'अंग्रेज़ी',
  Assamese: 'অসমীয়া',
  Bodo: 'बड़ो',
  Dogri: 'डोगरी',
  Gujarati: 'ગુજરાતી',
  Hindi: 'हिन्दी',
  Kannada: 'ಕನ್ನಡ',
  Kashmiri: 'कश्मीरी',
  Konkani: 'कोंकणी',
  Maithili: 'मैथिली',
  Malayalam: 'മലയാളം',
  Bengali: 'বাংলা',
  Manipuri: 'মণিপুরী',
  Marathi: 'मराठी',
  Nepali: 'नेपाली',
  Odia: 'ଓଡ଼ିଆ',
  Punjabi: 'ਪੰਜਾਬੀ',
  Sanskrit: 'संस्कृत',
  Santali: 'संताली',
  Sindhi: 'सिंधी',
  Tamil: 'தமிழ்',
  Telugu: 'తెలుగు',
  Urdu: 'اردو',
};

export function isSupportedLanguage(language: string): language is SupportedLanguage {
  return SUPPORTED_LANGUAGE_SET.has(language);
}

export function getLanguageLabel(language: SupportedLanguage | string): string {
  return isSupportedLanguage(language) ? LANGUAGE_LABELS[language] : language;
}
