import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Clipboard from 'expo-clipboard';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { memo, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { getLanguageLabel, SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/constants/languages';
import { Fonts } from '@/constants/theme';
import { getUiCopy, UI_SUBTITLES } from '@/constants/ui-copy';
import {
  ApiError,
  type ApiErrorCode,
  type BackendStatus,
  createNativeAudioUpload,
  fetchSupportedLanguages,
  toAbsoluteAudioUrl,
  translateSpeech,
  translateText,
  type TranslationResponse,
} from '@/services/api';
import {
  AppMode,
  loadStoredPreferences,
  saveStoredPreferences,
  type StoredHistoryEntry,
  type TranslationOrigin,
} from '@/services/preferences';
import { useBackendStatus } from '@/hooks/use-backend-status';

const SURFACE = '#10242a';
const SURFACE_BORDER = 'rgba(233, 228, 212, 0.12)';
const PANEL = '#17333a';
const PANEL_ALT = '#0d1b1f';
const ACCENT = '#f2a65a';
const ACCENT_STRONG = '#ffd07a';
const TEXT_PRIMARY = '#f7f2e8';
const TEXT_MUTED = '#aebcb7';
const SUCCESS = '#8fd19e';
const DANGER = '#ff8d7a';
const INFO = '#7bc4ff';
const RESULT_CARD_SCROLL_Y = 0;
const DEFAULT_SOURCE_LANGUAGE: SupportedLanguage = 'English';
const DEFAULT_TARGET_LANGUAGE: SupportedLanguage = 'Hindi';

type LanguageField = 'source' | 'target';
type UiStatus =
  | 'ready'
  | 'recording'
  | 'translating_text'
  | 'translating_speech'
  | 'playing_audio'
  | 'backend_unavailable'
  | 'error';

type ConversationTurn = {
  id: string;
  createdAt: string;
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  sourceText: string;
  translatedText: string;
  transcribedText?: string;
  origin: TranslationOrigin;
};

type RetryableAction =
  | {
      kind: 'text_translate';
      sourceLanguage: SupportedLanguage;
      targetLanguage: SupportedLanguage;
      text: string;
      includeSpeech: boolean;
      mode: AppMode;
      origin: TranslationOrigin;
    }
  | {
      kind: 'speech_translate';
      sourceLanguage: SupportedLanguage;
      targetLanguage: SupportedLanguage;
      audioUri: string;
      mode: AppMode;
    }
  | {
      kind: 'regenerate_audio';
      sourceLanguage: SupportedLanguage;
      targetLanguage: SupportedLanguage;
      text: string;
      mode: AppMode;
      origin: TranslationOrigin;
    }
  | {
      kind: 'refresh_backend';
    };

type LanguagePreset = {
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  label: string;
  isRecent: boolean;
};

type BannerMessage = {
  code: ApiErrorCode;
  title: string;
  message: string;
};

function buildHistoryEntry(params: {
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  sourceText: string;
  translatedText: string;
  transcribedText?: string;
  origin: TranslationOrigin;
}): StoredHistoryEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    sourceLanguage: params.sourceLanguage,
    targetLanguage: params.targetLanguage,
    sourceText: params.sourceText,
    translatedText: params.translatedText,
    transcribedText: params.transcribedText,
    origin: params.origin,
  };
}

function resolveInitialPair(
  languages: SupportedLanguage[],
  stored?: Partial<Record<'sourceLanguage' | 'targetLanguage', SupportedLanguage>> | null,
) {
  const preferredSource = stored?.sourceLanguage;
  const preferredTarget = stored?.targetLanguage;
  const fallbackSource = languages.includes(DEFAULT_SOURCE_LANGUAGE)
    ? DEFAULT_SOURCE_LANGUAGE
    : languages[0] ?? DEFAULT_SOURCE_LANGUAGE;
  const fallbackTarget =
    languages.includes(DEFAULT_TARGET_LANGUAGE) && DEFAULT_TARGET_LANGUAGE !== fallbackSource
      ? DEFAULT_TARGET_LANGUAGE
      : languages.find((item) => item !== fallbackSource) ?? fallbackSource;

  const sourceLanguage =
    preferredSource && languages.includes(preferredSource) ? preferredSource : fallbackSource;
  const targetLanguage =
    preferredTarget && languages.includes(preferredTarget) && preferredTarget !== sourceLanguage
      ? preferredTarget
      : languages.find((item) => item !== sourceLanguage && item === fallbackTarget) ??
        languages.find((item) => item !== sourceLanguage) ??
        sourceLanguage;

  return { sourceLanguage, targetLanguage };
}

function buildLanguagePairKey(sourceLanguage: SupportedLanguage, targetLanguage: SupportedLanguage) {
  return `${sourceLanguage}:::${targetLanguage}`;
}

function buildPresetLabel(sourceLanguage: SupportedLanguage, targetLanguage: SupportedLanguage) {
  return `${sourceLanguage} → ${targetLanguage}`;
}

function collectPresetPairs(history: StoredHistoryEntry[]): LanguagePreset[] {
  const builtInPairs: LanguagePreset[] = [
    { sourceLanguage: 'English', targetLanguage: 'Hindi', label: buildPresetLabel('English', 'Hindi'), isRecent: false },
    { sourceLanguage: 'Hindi', targetLanguage: 'English', label: buildPresetLabel('Hindi', 'English'), isRecent: false },
    { sourceLanguage: 'English', targetLanguage: 'Tamil', label: buildPresetLabel('English', 'Tamil'), isRecent: false },
    { sourceLanguage: 'English', targetLanguage: 'Telugu', label: buildPresetLabel('English', 'Telugu'), isRecent: false },
  ];

  const pairs = [...builtInPairs];
  const seen = new Set(pairs.map((item) => buildLanguagePairKey(item.sourceLanguage, item.targetLanguage)));

  for (const entry of history) {
    const key = buildLanguagePairKey(entry.sourceLanguage, entry.targetLanguage);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    pairs.push({
      sourceLanguage: entry.sourceLanguage,
      targetLanguage: entry.targetLanguage,
      label: buildPresetLabel(entry.sourceLanguage, entry.targetLanguage),
      isRecent: true,
    });

    if (pairs.length >= 8) {
      break;
    }
  }

  return pairs;
}

function buildConversationTurn(params: {
  sourceLanguage: SupportedLanguage;
  targetLanguage: SupportedLanguage;
  sourceText: string;
  translatedText: string;
  transcribedText?: string;
  origin: TranslationOrigin;
}): ConversationTurn {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    sourceLanguage: params.sourceLanguage,
    targetLanguage: params.targetLanguage,
    sourceText: params.sourceText,
    translatedText: params.translatedText,
    transcribedText: params.transcribedText,
    origin: params.origin,
  };
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [availableLanguages, setAvailableLanguages] = useState<SupportedLanguage[]>([...SUPPORTED_LANGUAGES]);
  const [sourceLanguage, setSourceLanguage] = useState<SupportedLanguage>(DEFAULT_SOURCE_LANGUAGE);
  const [targetLanguage, setTargetLanguage] = useState<SupportedLanguage>(DEFAULT_TARGET_LANGUAGE);
  const [appMode, setAppMode] = useState<AppMode>('translate');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [latestAudioUrl, setLatestAudioUrl] = useState<string | null>(null);
  const [transcriptText, setTranscriptText] = useState('');
  const [activeOrigin, setActiveOrigin] = useState<TranslationOrigin>('text');
  const [uiStatus, setUiStatus] = useState<UiStatus>('ready');
  const [isTranslatingText, setIsTranslatingText] = useState(false);
  const [isTranslatingSpeech, setIsTranslatingSpeech] = useState(false);
  const [languagePickerField, setLanguagePickerField] = useState<LanguageField | null>(null);
  const [languageQuery, setLanguageQuery] = useState('');
  const [banner, setBanner] = useState<BannerMessage | null>(null);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);
  const [didRestorePreferences, setDidRestorePreferences] = useState(false);
  const [history, setHistory] = useState<StoredHistoryEntry[]>([]);
  const [showMicOnboarding, setShowMicOnboarding] = useState(false);
  const [showMicPermissionHint, setShowMicPermissionHint] = useState(false);
  const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([]);
  const [lastFailedAction, setLastFailedAction] = useState<RetryableAction | null>(null);

  const scrollRef = useRef<ScrollView | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const liftAnim = useRef(new Animated.Value(20)).current;
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const player = useAudioPlayer(null, { updateInterval: 200 });
  const playerStatus = useAudioPlayerStatus(player);
  const { status: backendStatus, lastCheckedAt: backendLastCheckedAt, isRefreshing: isRefreshingBackend, refresh: refreshBackendStatus } =
    useBackendStatus();

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(liftAnim, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, liftAnim]);

  useEffect(() => {
    let isMounted = true;

    async function loadLanguages() {
      const storedPreferences = await loadStoredPreferences();
      if (isMounted && storedPreferences) {
        setHistory(storedPreferences.recentHistory);
        setShowMicOnboarding(!storedPreferences.microphoneOnboardingDismissed);
        setAppMode(storedPreferences.lastMode);
      }

      try {
        const fetched = await fetchSupportedLanguages();
        if (!isMounted || fetched.length === 0) return;

        setAvailableLanguages(fetched);
        const nextPair = resolveInitialPair(fetched, storedPreferences);
        setSourceLanguage(nextPair.sourceLanguage);
        setTargetLanguage(nextPair.targetLanguage);
        setBanner(null);
      } catch (error) {
        if (!isMounted) return;

        const fallbackPair = resolveInitialPair([...SUPPORTED_LANGUAGES], storedPreferences);
        setSourceLanguage(fallbackPair.sourceLanguage);
        setTargetLanguage(fallbackPair.targetLanguage);

        if (error instanceof ApiError && error.code === 'backend_unreachable') {
          const fallbackUi = getUiCopy(fallbackPair.sourceLanguage);
          setBanner({
            code: 'backend_unreachable',
            title: fallbackUi.errorBackendUnavailableTitle,
            message: fallbackUi.errorBackendUnavailableMessage,
          });
        }
      } finally {
        if (isMounted) {
          if (!storedPreferences) {
            setShowMicOnboarding(true);
            setAppMode('translate');
          }
          setDidRestorePreferences(Boolean(storedPreferences));
        }
      }
    }

    void loadLanguages();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    void setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
      interruptionMode: 'duckOthers',
    });
  }, []);

  useEffect(() => {
    void saveStoredPreferences({
      sourceLanguage,
      targetLanguage,
      lastMode: appMode,
      microphoneOnboardingDismissed: !showMicOnboarding,
      recentHistory: history,
    });
  }, [appMode, history, showMicOnboarding, sourceLanguage, targetLanguage]);

  useEffect(() => {
    if (!flashMessage) return undefined;

    const timeout = setTimeout(() => setFlashMessage(null), 1800);
    return () => clearTimeout(timeout);
  }, [flashMessage]);

  useEffect(() => {
    if (playerStatus.playing || playerStatus.isBuffering) {
      setUiStatus('playing_audio');
      return;
    }

    if (recorderState.isRecording) {
      setUiStatus('recording');
      return;
    }

    if (isTranslatingSpeech) {
      setUiStatus('translating_speech');
      return;
    }

    if (isTranslatingText) {
      setUiStatus('translating_text');
      return;
    }

    if (banner?.code === 'backend_unreachable') {
      setUiStatus('backend_unavailable');
      return;
    }

    if (banner) {
      setUiStatus('error');
      return;
    }

    setUiStatus('ready');
  }, [
    banner,
    isTranslatingSpeech,
    isTranslatingText,
    playerStatus.isBuffering,
    playerStatus.playing,
    recorderState.isRecording,
  ]);

  const activeRequest = isTranslatingText || isTranslatingSpeech;
  const canTranslateText = useMemo(
    () => inputText.trim().length > 0 && !isTranslatingSpeech,
    [inputText, isTranslatingSpeech],
  );
  const isConversationMode = appMode === 'conversation';
  const compactLayout = width < 410;
  const ui = useMemo(() => getUiCopy(sourceLanguage), [sourceLanguage]);
  const isRecording = recorderState.isRecording;
  const pickerSelection = languagePickerField === 'target' ? targetLanguage : sourceLanguage;
  const hasTranscript = activeOrigin === 'speech' && transcriptText.trim().length > 0;
  const presetPairs = useMemo(() => collectPresetPairs(history), [history]);
  const deferredLanguageQuery = useDeferredValue(languageQuery);
  const filteredLanguages = useMemo(() => {
    const query = deferredLanguageQuery.trim().toLowerCase();
    if (!query) return availableLanguages;

    return availableLanguages.filter((language) => {
      const nativeLabel = getLanguageLabel(language).toLowerCase();
      return language.toLowerCase().includes(query) || nativeLabel.includes(query);
    });
  }, [availableLanguages, deferredLanguageQuery]);
  const hasResult = outputText.trim().length > 0 || isTranslatingText || isTranslatingSpeech;
  const statusTone = getStatusTone(uiStatus, backendStatus, isRefreshingBackend, ui);
  const backendTone = getBackendTone(backendStatus, isRefreshingBackend, backendLastCheckedAt, ui);

  function clearFeedback() {
    setBanner(null);
    setFlashMessage(null);
  }

  function clearWorkspaceDrafts() {
    setInputText('');
    setOutputText('');
    setLatestAudioUrl(null);
    setTranscriptText('');
    setActiveOrigin('text');
  }

  function pushHistoryEntry(entry: StoredHistoryEntry) {
    setHistory((current) => [entry, ...current.filter((item) => item.id !== entry.id)].slice(0, 10));
  }

  function applyMode(nextMode: AppMode) {
    if (nextMode === appMode) {
      return;
    }

    clearFeedback();
    setAppMode(nextMode);
    setConversationTurns([]);
    setLastFailedAction(null);
    clearWorkspaceDrafts();

    if (nextMode === 'conversation') {
      setActiveOrigin('speech');
    }
  }

  function applyLanguagePair(
    nextSourceLanguage: SupportedLanguage,
    nextTargetLanguage: SupportedLanguage,
    options?: { keepConversationTurns?: boolean },
  ) {
    clearFeedback();
    setSourceLanguage(nextSourceLanguage);
    setTargetLanguage(nextTargetLanguage);
    clearWorkspaceDrafts();
    setLastFailedAction(null);

    if (!options?.keepConversationTurns) {
      setConversationTurns([]);
    }
  }

  function applyPresetPair(preset: LanguagePreset) {
    applyLanguagePair(preset.sourceLanguage, preset.targetLanguage);
  }

  function applyTranslation(
    response: TranslationResponse,
    options: {
      origin: TranslationOrigin;
      sourceText: string;
      sourceLanguageUsed: SupportedLanguage;
      targetLanguageUsed: SupportedLanguage;
      transcribedText?: string;
      addToHistory?: boolean;
      mode?: AppMode;
      clearDraft?: boolean;
    },
  ) {
    if (playerStatus.playing) {
      player.pause();
    }

    const resolvedTranscript = options.transcribedText ?? response.transcribed_text ?? '';
    const resolvedSourceText =
      options.origin === 'speech'
        ? options.sourceText || resolvedTranscript || ''
        : options.sourceText || inputText.trim();

    if (options.origin === 'speech' && resolvedTranscript) {
      setTranscriptText(resolvedTranscript);
      setInputText(options.clearDraft ? '' : resolvedSourceText);
    } else {
      setTranscriptText('');
      setInputText(options.clearDraft ? '' : resolvedSourceText);
    }

    setActiveOrigin(options.origin);
    setOutputText(response.translated_text);
    setLatestAudioUrl(response.audio_url ?? null);
    setBanner(null);
    setLastFailedAction(null);

    if (options.mode === 'conversation') {
      setConversationTurns((current) => [
        buildConversationTurn({
          sourceLanguage: options.sourceLanguageUsed,
          targetLanguage: options.targetLanguageUsed,
          sourceText: resolvedSourceText,
          translatedText: response.translated_text,
          transcribedText: options.origin === 'speech' ? resolvedTranscript || undefined : undefined,
          origin: options.origin,
        }),
        ...current,
      ]);
      setSourceLanguage(options.targetLanguageUsed);
      setTargetLanguage(options.sourceLanguageUsed);
    }

    if (options.addToHistory !== false && resolvedSourceText && response.translated_text.trim()) {
      pushHistoryEntry(
        buildHistoryEntry({
          sourceLanguage: options.sourceLanguageUsed,
          targetLanguage: options.targetLanguageUsed,
          sourceText: resolvedSourceText,
          translatedText: response.translated_text,
          transcribedText: options.origin === 'speech' ? resolvedTranscript || undefined : undefined,
          origin: options.origin,
        }),
      );
    }

    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: RESULT_CARD_SCROLL_Y, animated: true });
    });
  }

  function getBannerForError(code: ApiErrorCode): BannerMessage {
    switch (code) {
      case 'backend_unreachable':
        return {
          code,
          title: ui.errorBackendUnavailableTitle,
          message: ui.errorBackendUnavailableMessage,
        };
      case 'network_failed':
        return {
          code,
          title: ui.errorNetworkFailedTitle,
          message: ui.errorNetworkFailedMessage,
        };
      case 'speech_translation_failed':
        return {
          code,
          title: ui.errorSpeechFailedTitle,
          message: ui.errorSpeechFailedMessage,
        };
      case 'unauthorized':
        return {
          code,
          title: ui.errorUnauthorizedTitle,
          message: ui.errorUnauthorizedMessage,
        };
      case 'audio_unavailable':
        return {
          code,
          title: ui.errorAudioUnavailableTitle,
          message: ui.errorAudioUnavailableMessage,
        };
      default:
        return {
          code,
          title: ui.errorTranslationFailedTitle,
          message: ui.errorTranslationFailedMessage,
        };
    }
  }

  function captureError(error: unknown, fallback: ApiErrorCode, retryAction?: RetryableAction) {
    const code = error instanceof ApiError ? error.code : fallback;
    setBanner(getBannerForError(code));
    if (retryAction) {
      setLastFailedAction(retryAction);
    }
  }

  async function translateFromText() {
    if (!inputText.trim()) return;

    clearFeedback();
    setActiveOrigin('text');
    setIsTranslatingText(true);
    const text = inputText.trim();
    const retryAction: RetryableAction = {
      kind: 'text_translate',
      sourceLanguage,
      targetLanguage,
      text,
      includeSpeech: false,
      mode: appMode,
      origin: 'text',
    };
    try {
      const response = await translateText({
        text,
        sourceLanguage,
        targetLanguage,
        includeSpeech: false,
      });
      applyTranslation(response, {
        origin: 'text',
        sourceText: text,
        sourceLanguageUsed: sourceLanguage,
        targetLanguageUsed: targetLanguage,
        mode: appMode,
        clearDraft: isConversationMode,
      });
    } catch (error) {
      captureError(error, 'translation_failed', retryAction);
    } finally {
      setIsTranslatingText(false);
    }
  }

  async function toggleRecording() {
    clearFeedback();

    if (!isRecording) {
      try {
        const permission = await requestRecordingPermissionsAsync();
        if (!permission.granted) {
          setShowMicPermissionHint(true);
          Alert.alert(ui.alertMicPermissionTitle, ui.alertMicPermissionMessage);
          return;
        }

        setShowMicOnboarding(false);
        setShowMicPermissionHint(false);

        if (playerStatus.playing) {
          player.pause();
        }

        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
          shouldPlayInBackground: false,
          shouldRouteThroughEarpiece: false,
          interruptionMode: 'duckOthers',
        });
        await recorder.prepareToRecordAsync();
        recorder.record();
      } catch {
        setShowMicPermissionHint(true);
        Alert.alert(ui.alertMicPermissionTitle, ui.alertMicPermissionMessage);
      }

      return;
    }

    setIsTranslatingSpeech(true);
    let retryAction: RetryableAction | undefined;
    try {
      await recorder.stop();
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
        interruptionMode: 'duckOthers',
      });

      const recordedUri = recorder.uri ?? recorder.getStatus().url;
      if (!recordedUri) {
        throw new ApiError('speech_translation_failed', 'Recording URI unavailable');
      }
      retryAction = {
        kind: 'speech_translate',
        sourceLanguage,
        targetLanguage,
        audioUri: recordedUri,
        mode: appMode,
      };

      const response = await translateSpeech({
        audioFile: createNativeAudioUpload(recordedUri),
        sourceLanguage,
        targetLanguage,
        includeSpeech: false,
      });
      applyTranslation(response, {
        origin: 'speech',
        sourceText: response.transcribed_text?.trim() || '',
        transcribedText: response.transcribed_text,
        sourceLanguageUsed: sourceLanguage,
        targetLanguageUsed: targetLanguage,
        mode: appMode,
        clearDraft: isConversationMode,
      });
    } catch (error) {
      captureError(error, 'speech_translation_failed', retryAction);
    } finally {
      setIsTranslatingSpeech(false);
    }
  }

  async function playOutputAudio() {
    clearFeedback();

    if (!outputText.trim()) {
      setLastFailedAction(null);
      setBanner({
        code: 'audio_unavailable',
        title: ui.alertNoOutputTitle,
        message: ui.alertNoOutputMessage,
      });
      return;
    }

    const sourceText = activeOrigin === 'speech' && transcriptText.trim() ? transcriptText.trim() : inputText.trim();
    const regenerateAction: RetryableAction = {
      kind: 'regenerate_audio',
      sourceLanguage,
      targetLanguage,
      text: sourceText || outputText.trim(),
      mode: appMode,
      origin: activeOrigin,
    };
    setLastFailedAction(regenerateAction);

    const absolute = toAbsoluteAudioUrl(latestAudioUrl);
    if (absolute) {
      await playAudio(absolute);
      return;
    }

    try {
      setIsTranslatingText(true);
      const response = await translateText({
        text: sourceText || outputText.trim(),
        sourceLanguage,
        targetLanguage,
        includeSpeech: true,
      });
      applyTranslation(response, {
        origin: activeOrigin,
        sourceText: sourceText || outputText.trim(),
        transcribedText: activeOrigin === 'speech' ? transcriptText.trim() : undefined,
        addToHistory: false,
        sourceLanguageUsed: sourceLanguage,
        targetLanguageUsed: targetLanguage,
        mode: appMode,
        clearDraft: isConversationMode,
      });
      setLastFailedAction(regenerateAction);
      const generatedAudioUrl = toAbsoluteAudioUrl(response.audio_url);
      if (!generatedAudioUrl) {
        throw new ApiError('audio_unavailable', 'Audio URL missing after generation');
      }

      await playAudio(generatedAudioUrl);
    } catch (error) {
      captureError(error, 'audio_unavailable', regenerateAction);
    } finally {
      setIsTranslatingText(false);
    }
  }

  async function playAudio(audioUrl: string) {
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
        interruptionMode: 'duckOthers',
      });
      player.replace({ uri: audioUrl });
      player.play();
      setBanner(null);
      setLastFailedAction(null);
    } catch (error) {
      captureError(error, 'audio_unavailable');
    }
  }

  function switchLanguages() {
    clearFeedback();
    const nextInput = outputText.trim() ? outputText : inputText;
    setInputText(nextInput);
    setOutputText('');
    setLatestAudioUrl(null);
    setTranscriptText('');
    setActiveOrigin('text');
    setSourceLanguage(targetLanguage);
    setTargetLanguage(sourceLanguage);
    setLastFailedAction(null);
  }

  function openLanguagePicker(field: LanguageField) {
    setLanguageQuery('');
    setLanguagePickerField(field);
  }

  function closeLanguagePicker() {
    setLanguagePickerField(null);
    setLanguageQuery('');
  }

  function handleLanguageSelect(language: SupportedLanguage) {
    clearFeedback();

    if (languagePickerField === 'source') {
      setSourceLanguage(language);
      if (language === targetLanguage) {
        setTargetLanguage(availableLanguages.find((item) => item !== language) ?? targetLanguage);
      }
    } else if (languagePickerField === 'target') {
      setTargetLanguage(language);
      if (language === sourceLanguage) {
        setSourceLanguage(availableLanguages.find((item) => item !== language) ?? sourceLanguage);
      }
    }

    closeLanguagePicker();
    setConversationTurns([]);
    setLastFailedAction(null);
    clearWorkspaceDrafts();
  }

  function handleInputTextChange(value: string) {
    setInputText(value);
    if (activeOrigin === 'speech' && value !== transcriptText) {
      setActiveOrigin('text');
      setTranscriptText('');
    }
  }

  async function copyOutputText() {
    if (!outputText.trim()) return;

    await Clipboard.setStringAsync(outputText);
    setFlashMessage(ui.copied);
  }

  async function shareOutputText() {
    if (!outputText.trim()) return;

    await Share.share({
      message: `${sourceLanguage} -> ${targetLanguage}\n\n${outputText}`,
      title: 'Vaani Connect Translation',
    });
    setFlashMessage(ui.shared);
  }

  async function retranslateTranscript() {
    if (!transcriptText.trim()) return;

    clearFeedback();
    setIsTranslatingText(true);
    const text = transcriptText.trim();
    const retryAction: RetryableAction = {
      kind: 'text_translate',
      sourceLanguage,
      targetLanguage,
      text,
      includeSpeech: false,
      mode: appMode,
      origin: 'speech',
    };
    try {
      const response = await translateText({
        text,
        sourceLanguage,
        targetLanguage,
        includeSpeech: false,
      });
      applyTranslation(response, {
        origin: 'speech',
        sourceText: text,
        transcribedText: text,
        sourceLanguageUsed: sourceLanguage,
        targetLanguageUsed: targetLanguage,
        mode: appMode,
        clearDraft: isConversationMode,
      });
    } catch (error) {
      captureError(error, 'translation_failed', retryAction);
    } finally {
      setIsTranslatingText(false);
    }
  }

  function dismissMicOnboarding() {
    setShowMicOnboarding(false);
  }

  function restoreHistoryEntry(entry: StoredHistoryEntry) {
    clearFeedback();
    setAppMode('translate');
    setConversationTurns([]);
    setLastFailedAction(null);
    setSourceLanguage(entry.sourceLanguage);
    setTargetLanguage(entry.targetLanguage);
    setInputText(entry.sourceText);
    setOutputText(entry.translatedText);
    setTranscriptText(entry.transcribedText ?? '');
    setLatestAudioUrl(null);
    setActiveOrigin(entry.origin);
    setFlashMessage(ui.historyRestored);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: RESULT_CARD_SCROLL_Y, animated: true });
    });
  }

  function clearHistoryEntries() {
    Alert.alert(ui.clearHistoryConfirmTitle, ui.clearHistoryConfirmMessage, [
      { text: ui.cancel, style: 'cancel' },
      {
        text: ui.clearHistoryConfirmAction,
        style: 'destructive',
        onPress: () => setHistory([]),
      },
    ]);
  }

  async function retryBannerAction() {
    if (!banner) return;

    const action = lastFailedAction;
    if (!action) {
      await refreshBackendStatus();
      return;
    }

    clearFeedback();

    try {
      if (action.kind === 'refresh_backend') {
        await refreshBackendStatus();
        return;
      }

      setSourceLanguage(action.sourceLanguage);
      setTargetLanguage(action.targetLanguage);
      setAppMode(action.mode);

      if (action.kind === 'text_translate') {
        setInputText(action.text);
        setActiveOrigin(action.origin);
        const response = await translateText({
          text: action.text,
          sourceLanguage: action.sourceLanguage,
          targetLanguage: action.targetLanguage,
          includeSpeech: action.includeSpeech,
        });
        applyTranslation(response, {
          origin: action.origin,
          sourceText: action.text,
          transcribedText: action.origin === 'speech' ? action.text : undefined,
          sourceLanguageUsed: action.sourceLanguage,
          targetLanguageUsed: action.targetLanguage,
          mode: action.mode,
          clearDraft: action.mode === 'conversation',
        });
        return;
      }

      if (action.kind === 'speech_translate') {
        const response = await translateSpeech({
          audioFile: createNativeAudioUpload(action.audioUri),
          sourceLanguage: action.sourceLanguage,
          targetLanguage: action.targetLanguage,
          includeSpeech: false,
        });
        applyTranslation(response, {
          origin: 'speech',
          sourceText: response.transcribed_text?.trim() || '',
          transcribedText: response.transcribed_text,
          sourceLanguageUsed: action.sourceLanguage,
          targetLanguageUsed: action.targetLanguage,
          mode: action.mode,
          clearDraft: action.mode === 'conversation',
        });
        return;
      }

      const response = await translateText({
        text: action.text,
        sourceLanguage: action.sourceLanguage,
        targetLanguage: action.targetLanguage,
        includeSpeech: true,
      });
      applyTranslation(response, {
        origin: action.origin,
        sourceText: action.text,
        transcribedText: action.origin === 'speech' ? transcriptText.trim() : undefined,
        addToHistory: false,
        sourceLanguageUsed: action.sourceLanguage,
        targetLanguageUsed: action.targetLanguage,
        mode: action.mode,
        clearDraft: action.mode === 'conversation',
      });
      setLastFailedAction(action);

      const generatedAudioUrl = toAbsoluteAudioUrl(response.audio_url);
      if (!generatedAudioUrl) {
        throw new ApiError('audio_unavailable', 'Audio URL missing after generation');
      }

      await playAudio(generatedAudioUrl);
    } catch (error) {
      const fallback = action.kind === 'speech_translate' ? 'speech_translation_failed' : 'translation_failed';
      captureError(error, fallback, action);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.blob, styles.blobLarge]} />
      <View style={[styles.blob, styles.blobSmall]} />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 16,
            paddingBottom: Math.max(insets.bottom + 110, 130),
          },
        ]}
        showsVerticalScrollIndicator={false}>
        <Animated.View
          style={[
            styles.stack,
            {
              opacity: fadeAnim,
              transform: [{ translateY: liftAnim }],
            },
          ]}>
          <View style={styles.panel}>
            <View style={styles.topRow}>
              <View style={[styles.statusPill, { borderColor: statusTone.color }]}>
                <View style={[styles.statusDot, { backgroundColor: statusTone.color }]} />
                <ThemedText style={styles.statusText}>{statusTone.label}</ThemedText>
              </View>
              <ThemedText style={styles.panelMeta}>
                {availableLanguages.length} {ui.languageWord}
              </ThemedText>
            </View>

            <View style={styles.statusCard}>
              <ThemedText style={styles.statusCardLabel}>{ui.statusLabel}</ThemedText>
              <ThemedText style={styles.statusCardTitle}>{statusTone.label}</ThemedText>
              <ThemedText style={styles.statusCardCopy}>{statusTone.hint}</ThemedText>
              {didRestorePreferences ? <ThemedText style={styles.statusCardMeta}>{ui.statusSaved}</ThemedText> : null}
            </View>

            {backendStatus !== 'ready' || isRefreshingBackend ? (
              <View style={styles.backendNotice}>
                <View style={styles.backendNoticeCopy}>
                  <ThemedText style={styles.backendNoticeTitle}>{backendTone.title}</ThemedText>
                  <ThemedText style={styles.backendNoticeMessage}>{backendTone.message}</ThemedText>
                  {backendLastCheckedAt ? (
                    <ThemedText style={styles.backendNoticeMeta}>
                      {`${ui.statusLabel}: ${new Date(backendLastCheckedAt).toLocaleTimeString()}`}
                    </ThemedText>
                  ) : null}
                </View>
                <Pressable style={styles.backendNoticeButton} onPress={() => void refreshBackendStatus()}>
                  <ThemedText style={styles.backendNoticeButtonText}>{backendTone.actionLabel}</ThemedText>
                </Pressable>
              </View>
            ) : null}

            {banner ? (
              <View style={styles.banner}>
                <View style={styles.bannerCopy}>
                  <ThemedText style={styles.bannerTitle}>{banner.title}</ThemedText>
                  <ThemedText style={styles.bannerMessage}>{banner.message}</ThemedText>
                </View>
                <Pressable style={styles.bannerButton} onPress={() => void retryBannerAction()}>
                  <ThemedText style={styles.bannerButtonText}>{ui.retry}</ThemedText>
                </Pressable>
              </View>
            ) : null}

            {flashMessage ? (
              <View style={styles.flashPill}>
                <MaterialIcons name="check-circle" size={16} color={SUCCESS} />
                <ThemedText style={styles.flashText}>{flashMessage}</ThemedText>
              </View>
            ) : null}

            {showMicOnboarding ? (
              <View style={styles.onboardingCard}>
                <View style={styles.onboardingCopy}>
                  <ThemedText style={styles.onboardingTitle}>{ui.micOnboardingTitle}</ThemedText>
                  <ThemedText style={styles.onboardingMessage}>{ui.micOnboardingMessage}</ThemedText>
                </View>
                <Pressable style={styles.onboardingButton} onPress={dismissMicOnboarding}>
                  <ThemedText style={styles.onboardingButtonText}>{ui.micOnboardingDismiss}</ThemedText>
                </Pressable>
              </View>
            ) : null}

            {showMicPermissionHint ? (
              <View style={styles.permissionHintCard}>
                <MaterialIcons name="mic-off" size={18} color={DANGER} />
                <ThemedText style={styles.permissionHintText}>{ui.micPermissionHint}</ThemedText>
              </View>
            ) : null}

            <View style={styles.modeSwitcher}>
              <Pressable
                style={[styles.modeChip, !isConversationMode && styles.modeChipActive]}
                onPress={() => applyMode('translate')}>
                <ThemedText style={[styles.modeChipText, !isConversationMode && styles.modeChipTextActive]}>
                  {ui.modeTranslate}
                </ThemedText>
              </Pressable>
              <Pressable
                style={[styles.modeChip, isConversationMode && styles.modeChipActive]}
                onPress={() => applyMode('conversation')}>
                <ThemedText style={[styles.modeChipText, isConversationMode && styles.modeChipTextActive]}>
                  {ui.modeConversation}
                </ThemedText>
              </Pressable>
            </View>

            <PresetRailSection ui={ui} presets={presetPairs} onSelectPreset={applyPresetPair} />

            <View style={[styles.languageRoute, compactLayout && styles.languageRouteCompact]}>
              <LanguageSelector
                title={ui.from}
                subtitle={UI_SUBTITLES.from}
                selected={sourceLanguage}
                onPress={() => openLanguagePicker('source')}
              />
              <Pressable
                style={[styles.swapButton, activeRequest && styles.swapButtonDisabled]}
                onPress={switchLanguages}
                disabled={activeRequest}>
                <MaterialIcons name="swap-horiz" size={22} color={PANEL_ALT} />
              </Pressable>
              <LanguageSelector
                title={ui.to}
                subtitle={UI_SUBTITLES.to}
                selected={targetLanguage}
                onPress={() => openLanguagePicker('target')}
              />
            </View>

            <View style={styles.actionRow}>
              <ActionButton
                icon={isRecording ? 'stop-circle' : 'keyboard-voice'}
                title={isRecording ? ui.stop : ui.record}
                subtitle={UI_SUBTITLES.record}
                accent={isRecording ? DANGER : ACCENT}
                onPress={toggleRecording}
                disabled={activeRequest}
                loading={isTranslatingSpeech}
              />
            </View>

            {isConversationMode ? (
              <View style={styles.conversationCard}>
                <View style={styles.conversationHeader}>
                  <View style={styles.conversationHeaderCopy}>
                    <ThemedText style={styles.conversationTitle}>{ui.conversationTitle}</ThemedText>
                    <ThemedText style={styles.conversationSubtitle}>{ui.conversationSubtitle}</ThemedText>
                  </View>
                  <Pressable
                    style={[styles.conversationRetryButton, !lastFailedAction && styles.conversationRetryButtonDisabled]}
                    onPress={() => void retryBannerAction()}
                    disabled={!lastFailedAction || activeRequest}>
                    <ThemedText style={styles.conversationRetryText}>{ui.conversationRetry}</ThemedText>
                  </Pressable>
                </View>

                <ThemedText style={styles.conversationHint}>{ui.conversationSpeakHint}</ThemedText>

                {conversationTurns.length > 0 ? (
                  <View style={styles.conversationList}>
                    {conversationTurns.map((turn, index) => (
                      <View key={turn.id} style={styles.conversationTurnCard}>
                        <View style={styles.conversationTurnHeader}>
                          <ThemedText style={styles.conversationTurnLabel}>
                            {ui.conversationTurnLabel} {index + 1}
                          </ThemedText>
                          <ThemedText style={styles.conversationTurnRoute}>
                            {turn.sourceLanguage} {'->'} {turn.targetLanguage}
                          </ThemedText>
                        </View>
                        <ThemedText style={styles.conversationTurnSource} numberOfLines={2}>
                          {turn.transcribedText ?? turn.sourceText}
                        </ThemedText>
                        <ThemedText style={styles.conversationTurnTranslated} numberOfLines={3}>
                          {turn.translatedText}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.conversationEmptyCard}>
                    <ThemedText style={styles.conversationEmptyTitle}>{ui.conversationEmptyTitle}</ThemedText>
                    <ThemedText style={styles.conversationEmptyMessage}>{ui.conversationEmptyMessage}</ThemedText>
                  </View>
                )}
              </View>
            ) : null}
          </View>
          {hasResult ? (
            <>
              <EditorCard
                label={ui.resultLabel}
                title={isTranslatingSpeech ? ui.speechResultTitle : ui.resultTitle}
                subtitle={UI_SUBTITLES.result}
                value={outputText}
                placeholder={ui.resultPlaceholder}
                editable={false}
                compact={compactLayout}
                footer={latestAudioUrl ? ui.voiceReady : ''}
              />

              <View style={styles.resultActions}>
                <SmallActionButton
                  icon="play-circle-filled"
                  title={ui.playingAction}
                  onPress={() => void playOutputAudio()}
                  disabled={activeRequest || !outputText.trim()}
                />
                <SmallActionButton
                  icon="content-copy"
                  title={ui.copy}
                  onPress={() => void copyOutputText()}
                  disabled={!outputText.trim()}
                />
                <SmallActionButton
                  icon="ios-share"
                  title={ui.share}
                  onPress={() => void shareOutputText()}
                  disabled={!outputText.trim()}
                />
                <SmallActionButton
                  icon="swap-horiz"
                  title={ui.swap}
                  onPress={switchLanguages}
                  disabled={activeRequest || (!inputText.trim() && !outputText.trim())}
                />
              </View>
            </>
          ) : null}

          {hasTranscript ? (
            <View style={styles.transcriptCard}>
              <EditorCard
                label={ui.transcriptLabel}
                title={ui.transcriptTitle}
                subtitle={UI_SUBTITLES.input}
                value={transcriptText}
                placeholder={ui.transcriptPlaceholder}
                editable
                compact={compactLayout}
                onChangeText={setTranscriptText}
                footer={`${transcriptText.trim().length}`}
              />
              <Pressable
                style={[styles.secondaryButton, (activeRequest || !transcriptText.trim()) && styles.secondaryButtonDisabled]}
                onPress={() => void retranslateTranscript()}
                disabled={activeRequest || !transcriptText.trim()}>
                <MaterialIcons name="refresh" size={18} color={TEXT_PRIMARY} />
                <ThemedText style={styles.secondaryButtonText}>{ui.retranslate}</ThemedText>
              </Pressable>
            </View>
          ) : null}

          <EditorCard
            label={ui.inputLabel}
            title={isRecording ? ui.inputRecordingTitle : ui.inputTitle}
            subtitle={UI_SUBTITLES.input}
            value={inputText}
            placeholder={ui.inputPlaceholder}
            editable
            compact={compactLayout}
            onChangeText={handleInputTextChange}
            footer={`${inputText.trim().length}`}
          />

          <Pressable
            style={[styles.translateButton, (!canTranslateText || isTranslatingText) && styles.translateButtonDisabled]}
            onPress={() => void translateFromText()}
            disabled={!canTranslateText || isTranslatingText}>
            <View style={styles.translateInner}>
              {isTranslatingText ? (
                <ActivityIndicator color={PANEL_ALT} />
              ) : (
                <MaterialIcons name="auto-awesome" size={22} color={PANEL_ALT} />
              )}
              <View style={styles.translateCopy}>
                <ThemedText style={styles.translateTitle}>{isTranslatingText ? ui.translating : ui.translate}</ThemedText>
                <ThemedText style={styles.translateSubtitle}>{UI_SUBTITLES.translate}</ThemedText>
              </View>
            </View>
          </Pressable>

          <View style={styles.historySection}>
            <View style={styles.historyHeader}>
              <ThemedText style={styles.historyTitle}>{ui.historyTitle}</ThemedText>
              {history.length > 0 ? (
                <Pressable style={styles.historyClearButton} onPress={clearHistoryEntries}>
                  <ThemedText style={styles.historyClearButtonText}>{ui.clearHistory}</ThemedText>
                </Pressable>
              ) : null}
            </View>

            {history.length > 0 ? (
              <View style={styles.historyList}>
                {history.map((entry) => (
                  <Pressable key={entry.id} style={styles.historyCard} onPress={() => restoreHistoryEntry(entry)}>
                    <View style={styles.historyCardTopRow}>
                      <ThemedText style={styles.historyRoute}>
                        {entry.sourceLanguage} {'->'} {entry.targetLanguage}
                      </ThemedText>
                      <View style={styles.historyBadge}>
                        <ThemedText style={styles.historyBadgeText}>
                          {entry.origin === 'speech' ? ui.speechHistoryBadge : ui.textHistoryBadge}
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText style={styles.historySourceText} numberOfLines={2}>
                      {entry.transcribedText ?? entry.sourceText}
                    </ThemedText>
                    <ThemedText style={styles.historyTranslatedText} numberOfLines={2}>
                      {entry.translatedText}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.historyEmptyCard}>
                <ThemedText style={styles.historyEmptyTitle}>{ui.historyEmptyTitle}</ThemedText>
                <ThemedText style={styles.historyEmptyMessage}>{ui.historyEmptyMessage}</ThemedText>
              </View>
            )}
          </View>
        </Animated.View>
      </ScrollView>

      <LanguagePickerSheet
        visible={languagePickerField !== null}
        ui={ui}
        query={languageQuery}
        onChangeQuery={setLanguageQuery}
        filteredLanguages={filteredLanguages}
        selectedLanguage={pickerSelection}
        onSelectLanguage={handleLanguageSelect}
        onClose={closeLanguagePicker}
      />
    </View>
  );
}

function getStatusTone(
  uiStatus: UiStatus,
  backendStatus: BackendStatus,
  isRefreshingBackend: boolean,
  ui: ReturnType<typeof getUiCopy>,
) {
  if (isRefreshingBackend) {
    return { color: ACCENT_STRONG, label: ui.backendCheckingTitle, hint: ui.backendCheckingMessage };
  }

  switch (uiStatus) {
    case 'recording':
      return { color: DANGER, label: ui.statusListening, hint: ui.statusHintListening };
    case 'translating_text':
    case 'translating_speech':
      return { color: ACCENT_STRONG, label: ui.statusWorking, hint: ui.statusHintWorking };
    case 'playing_audio':
      return { color: INFO, label: ui.statusPlaying, hint: ui.statusHintPlaying };
    case 'backend_unavailable':
      return { color: DANGER, label: ui.statusBackendUnavailable, hint: ui.statusHintBackendUnavailable };
    case 'error':
      return { color: DANGER, label: ui.statusError, hint: ui.statusHintError };
    default:
      switch (backendStatus) {
        case 'warming_up':
          return { color: ACCENT_STRONG, label: ui.backendWarmingTitle, hint: ui.backendWarmingMessage };
        case 'offline':
          return { color: DANGER, label: ui.backendOfflineTitle, hint: ui.backendOfflineMessage };
        case 'unauthorized':
          return { color: DANGER, label: ui.backendUnauthorizedTitle, hint: ui.backendUnauthorizedMessage };
        case 'error':
          return { color: DANGER, label: ui.backendErrorTitle, hint: ui.backendErrorMessage };
        default:
          return { color: SUCCESS, label: ui.statusReady, hint: ui.statusHintReady };
      }
  }
}

function getBackendTone(
  backendStatus: BackendStatus,
  isRefreshingBackend: boolean,
  lastCheckedAt: string | null,
  ui: ReturnType<typeof getUiCopy>,
) {
  if (isRefreshingBackend) {
    return {
      title: ui.backendCheckingTitle,
      message: ui.backendCheckingMessage,
      actionLabel: ui.backendRefresh,
      meta: lastCheckedAt,
    };
  }

  switch (backendStatus) {
    case 'ready':
      return {
        title: ui.backendReadyTitle,
        message: ui.backendReadyMessage,
        actionLabel: ui.backendRefresh,
        meta: lastCheckedAt,
      };
    case 'warming_up':
      return {
        title: ui.backendWarmingTitle,
        message: ui.backendWarmingMessage,
        actionLabel: ui.backendRefresh,
        meta: lastCheckedAt,
      };
    case 'unauthorized':
      return {
        title: ui.backendUnauthorizedTitle,
        message: ui.backendUnauthorizedMessage,
        actionLabel: ui.backendRefresh,
        meta: lastCheckedAt,
      };
    case 'error':
      return {
        title: ui.backendErrorTitle,
        message: ui.backendErrorMessage,
        actionLabel: ui.backendRefresh,
        meta: lastCheckedAt,
      };
    case 'offline':
    default:
      return {
        title: ui.backendOfflineTitle,
        message: ui.backendOfflineMessage,
        actionLabel: ui.backendRefresh,
        meta: lastCheckedAt,
      };
  }
}

function ActionButton({
  icon,
  title,
  subtitle,
  accent,
  onPress,
  disabled,
  loading,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle: string;
  accent: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Pressable style={[styles.actionButton, disabled && styles.actionButtonDisabled]} onPress={onPress} disabled={disabled}>
      <View style={[styles.actionIcon, { backgroundColor: accent }]}>
        {loading ? <ActivityIndicator color={PANEL_ALT} /> : <MaterialIcons name={icon} size={22} color={PANEL_ALT} />}
      </View>
      <View style={styles.actionCopy}>
        <ThemedText style={styles.actionTitle}>{title}</ThemedText>
        <ThemedText style={styles.actionSubtitle}>{subtitle}</ThemedText>
      </View>
    </Pressable>
  );
}

function SmallActionButton({
  icon,
  title,
  onPress,
  disabled,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable style={[styles.smallActionButton, disabled && styles.smallActionButtonDisabled]} onPress={onPress} disabled={disabled}>
      <MaterialIcons name={icon} size={18} color={disabled ? TEXT_MUTED : TEXT_PRIMARY} />
      <ThemedText style={[styles.smallActionLabel, disabled && styles.smallActionLabelDisabled]}>{title}</ThemedText>
    </Pressable>
  );
}

function LanguageSelector({
  title,
  subtitle,
  selected,
  onPress,
}: {
  title: string;
  subtitle: string;
  selected: SupportedLanguage;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.languageCard} onPress={onPress}>
      <View style={styles.languageHeading}>
        <ThemedText style={styles.languageTitle}>{title}</ThemedText>
        <ThemedText style={styles.languageSubtitle}>{subtitle}</ThemedText>
      </View>
      <View style={styles.languageCardFooter}>
        <View style={styles.languageCardCopy}>
          <ThemedText style={styles.languageValue}>{getLanguageLabel(selected)}</ThemedText>
          <ThemedText style={styles.languageValueSubtitle}>{selected}</ThemedText>
        </View>
        <MaterialIcons name="expand-more" size={22} color={TEXT_PRIMARY} />
      </View>
    </Pressable>
  );
}

function EditorCard({
  label,
  title,
  subtitle,
  value,
  placeholder,
  editable,
  compact,
  onChangeText,
  footer,
}: {
  label: string;
  title: string;
  subtitle: string;
  value: string;
  placeholder: string;
  editable: boolean;
  compact?: boolean;
  onChangeText?: (value: string) => void;
  footer: string;
}) {
  return (
    <View style={styles.editorCard}>
      <View style={styles.editorHeader}>
        <ThemedText style={styles.editorLabel}>{label}</ThemedText>
        <ThemedText style={styles.editorTitle}>{title}</ThemedText>
        <ThemedText style={styles.editorSubtitle}>{subtitle}</ThemedText>
      </View>
      <View style={[styles.editorField, !editable && styles.editorFieldMuted]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="rgba(174, 188, 183, 0.55)"
          multiline
          editable={editable}
          textAlignVertical="top"
          style={[styles.editorInput, compact && styles.editorInputCompact]}
        />
      </View>
      {footer ? <ThemedText style={styles.editorFooter}>{footer}</ThemedText> : null}
    </View>
  );
}

const PresetRailSection = memo(function PresetRailSection({
  ui,
  presets,
  onSelectPreset,
}: {
  ui: ReturnType<typeof getUiCopy>;
  presets: LanguagePreset[];
  onSelectPreset: (preset: LanguagePreset) => void;
}) {
  return (
    <View style={styles.presetSection}>
      <View style={styles.presetSectionHeader}>
        <View style={styles.presetSectionCopy}>
          <ThemedText style={styles.presetSectionTitle}>{ui.quickPresetsTitle}</ThemedText>
          <ThemedText style={styles.presetSectionHint}>{ui.quickPresetsHint}</ThemedText>
        </View>
      </View>
      <FlatList
        data={presets}
        keyExtractor={(preset) => buildLanguagePairKey(preset.sourceLanguage, preset.targetLanguage)}
        horizontal
        showsHorizontalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        contentContainerStyle={styles.presetRail}
        renderItem={({ item: preset }) => (
          <Pressable style={styles.presetChip} onPress={() => onSelectPreset(preset)}>
            <ThemedText style={styles.presetChipLabel}>{preset.label}</ThemedText>
            {preset.isRecent ? <ThemedText style={styles.presetChipMeta}>{ui.quickPresetRecent}</ThemedText> : null}
          </Pressable>
        )}
      />
    </View>
  );
});

const LanguagePickerSheet = memo(function LanguagePickerSheet({
  visible,
  ui,
  query,
  onChangeQuery,
  filteredLanguages,
  selectedLanguage,
  onSelectLanguage,
  onClose,
}: {
  visible: boolean;
  ui: ReturnType<typeof getUiCopy>;
  query: string;
  onChangeQuery: (value: string) => void;
  filteredLanguages: SupportedLanguage[];
  selectedLanguage: SupportedLanguage;
  onSelectLanguage: (language: SupportedLanguage) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet} onPress={() => {}}>
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderCopy}>
              <ThemedText style={styles.modalTitle}>{ui.chooseLanguage}</ThemedText>
              <ThemedText style={styles.modalSubtitle}>{UI_SUBTITLES.modal}</ThemedText>
            </View>
            <Pressable style={styles.modalCloseButton} onPress={onClose}>
              <MaterialIcons name="close" size={20} color={TEXT_PRIMARY} />
            </Pressable>
          </View>

          <View style={styles.searchField}>
            <MaterialIcons name="search" size={18} color={TEXT_MUTED} />
            <View style={styles.searchCopy}>
              <TextInput
                value={query}
                onChangeText={onChangeQuery}
                placeholder={ui.searchLanguage}
                placeholderTextColor="rgba(174, 188, 183, 0.55)"
                style={styles.searchInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <ThemedText style={styles.searchSubtitle}>{UI_SUBTITLES.search}</ThemedText>
            </View>
          </View>

          <FlatList
            data={filteredLanguages}
            keyExtractor={(language) => language}
            style={styles.languageList}
            contentContainerStyle={
              filteredLanguages.length > 0 ? styles.languageListContent : styles.languageListEmptyContent
            }
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={16}
            maxToRenderPerBatch={20}
            renderItem={({ item: language }) => (
              <Pressable
                style={[styles.languageRow, language === selectedLanguage && styles.languageRowActive]}
                onPress={() => onSelectLanguage(language)}>
                <View style={styles.languageRowCopy}>
                  <ThemedText style={[styles.languageRowLabel, language === selectedLanguage && styles.languageRowLabelActive]}>
                    {getLanguageLabel(language)}
                  </ThemedText>
                  <ThemedText style={styles.languageRowSubtitle}>{language}</ThemedText>
                </View>
                {language === selectedLanguage ? (
                  <MaterialIcons name="check-circle" size={20} color={ACCENT_STRONG} />
                ) : (
                  <MaterialIcons name="chevron-right" size={20} color={TEXT_MUTED} />
                )}
              </Pressable>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <ThemedText style={styles.emptyTitle}>{ui.noLanguageFound}</ThemedText>
                <ThemedText style={styles.emptySubtitle}>{ui.tryAnotherWord}</ThemedText>
              </View>
            }
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#071317',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
  },
  stack: {
    gap: 16,
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.35,
  },
  blobLarge: {
    width: 260,
    height: 260,
    backgroundColor: '#16454f',
    top: -90,
    right: -80,
  },
  blobSmall: {
    width: 180,
    height: 180,
    backgroundColor: '#533026',
    bottom: 100,
    left: -60,
  },
  panel: {
    backgroundColor: SURFACE,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
    padding: 18,
    gap: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(8, 19, 22, 0.92)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: TEXT_PRIMARY,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: Fonts.rounded,
    letterSpacing: 0.3,
  },
  panelMeta: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 18,
  },
  statusCard: {
    backgroundColor: PANEL_ALT,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
    padding: 16,
    gap: 4,
  },
  statusCardLabel: {
    color: ACCENT_STRONG,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: Fonts.rounded,
  },
  statusCardTitle: {
    color: TEXT_PRIMARY,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  statusCardCopy: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 19,
  },
  statusCardMeta: {
    color: SUCCESS,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
  backendNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(123, 196, 255, 0.24)',
    backgroundColor: 'rgba(123, 196, 255, 0.08)',
    padding: 14,
  },
  backendNoticeCopy: {
    flex: 1,
    gap: 4,
  },
  backendNoticeTitle: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  backendNoticeMessage: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 18,
  },
  backendNoticeMeta: {
    color: INFO,
    fontSize: 12,
    lineHeight: 16,
  },
  backendNoticeButton: {
    borderRadius: 999,
    backgroundColor: ACCENT_STRONG,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  backendNoticeButtonText: {
    color: PANEL_ALT,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255, 141, 122, 0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 141, 122, 0.28)',
    padding: 14,
  },
  bannerCopy: {
    flex: 1,
    gap: 4,
  },
  bannerTitle: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  bannerMessage: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 18,
  },
  bannerButton: {
    borderRadius: 999,
    backgroundColor: ACCENT_STRONG,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bannerButtonText: {
    color: PANEL_ALT,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  flashPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(143, 209, 158, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(143, 209, 158, 0.28)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  flashText: {
    color: TEXT_PRIMARY,
    fontSize: 12,
    lineHeight: 16,
  },
  onboardingCard: {
    backgroundColor: 'rgba(123, 196, 255, 0.12)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(123, 196, 255, 0.28)',
    padding: 14,
    gap: 12,
  },
  onboardingCopy: {
    gap: 4,
  },
  onboardingTitle: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  onboardingMessage: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 18,
  },
  onboardingButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(7, 19, 23, 0.45)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  onboardingButtonText: {
    color: TEXT_PRIMARY,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  permissionHintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(255, 141, 122, 0.08)',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 141, 122, 0.22)',
    padding: 14,
  },
  permissionHintText: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontSize: 13,
    lineHeight: 18,
  },
  modeSwitcher: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: 'rgba(7, 19, 23, 0.45)',
    padding: 4,
  },
  modeChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  modeChipActive: {
    backgroundColor: ACCENT_STRONG,
  },
  modeChipText: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  modeChipTextActive: {
    color: PANEL_ALT,
  },
  presetSection: {
    gap: 10,
  },
  presetSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  presetSectionCopy: {
    gap: 4,
  },
  presetSectionTitle: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '700',
  },
  presetSectionHint: {
    color: TEXT_MUTED,
    fontSize: 12,
    lineHeight: 16,
  },
  presetRail: {
    gap: 10,
    paddingRight: 4,
  },
  presetChip: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(239, 233, 214, 0.14)',
    backgroundColor: 'rgba(7, 19, 23, 0.68)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
    minWidth: 132,
  },
  presetChipLabel: {
    color: TEXT_PRIMARY,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  presetChipMeta: {
    color: ACCENT_STRONG,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  languageRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  languageRouteCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  languageCard: {
    flex: 1,
    minHeight: 118,
    justifyContent: 'space-between',
    backgroundColor: PANEL_ALT,
    borderWidth: 1,
    borderColor: 'rgba(247, 242, 232, 0.08)',
    borderRadius: 22,
    padding: 16,
  },
  languageHeading: {
    gap: 3,
  },
  languageTitle: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
  },
  languageSubtitle: {
    color: TEXT_MUTED,
    fontSize: 12,
    lineHeight: 16,
  },
  languageCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  languageCardCopy: {
    flex: 1,
    gap: 2,
  },
  languageValue: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  languageValueSubtitle: {
    color: TEXT_MUTED,
    fontSize: 12,
    lineHeight: 16,
  },
  swapButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT_STRONG,
    alignSelf: 'center',
  },
  swapButtonDisabled: {
    opacity: 0.45,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  conversationCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
    backgroundColor: PANEL_ALT,
    padding: 16,
    gap: 12,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  conversationHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  conversationTitle: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  conversationSubtitle: {
    color: TEXT_MUTED,
    fontSize: 12,
    lineHeight: 16,
  },
  conversationRetryButton: {
    borderRadius: 999,
    backgroundColor: ACCENT_STRONG,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  conversationRetryButtonDisabled: {
    opacity: 0.45,
  },
  conversationRetryText: {
    color: PANEL_ALT,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  conversationHint: {
    color: INFO,
    fontSize: 12,
    lineHeight: 16,
  },
  conversationList: {
    gap: 10,
  },
  conversationTurnCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(239, 233, 214, 0.1)',
    backgroundColor: 'rgba(7, 19, 23, 0.4)',
    padding: 12,
    gap: 8,
  },
  conversationTurnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  conversationTurnLabel: {
    color: ACCENT_STRONG,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontFamily: Fonts.rounded,
  },
  conversationTurnRoute: {
    color: TEXT_MUTED,
    fontSize: 11,
    lineHeight: 14,
  },
  conversationTurnSource: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
  },
  conversationTurnTranslated: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 19,
  },
  conversationEmptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(239, 233, 214, 0.16)',
    padding: 14,
    gap: 4,
  },
  conversationEmptyTitle: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  conversationEmptyMessage: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 18,
  },
  actionButton: {
    flex: 1,
    minHeight: 100,
    backgroundColor: PANEL_ALT,
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
    borderRadius: 22,
    padding: 14,
    gap: 12,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCopy: {
    gap: 3,
  },
  actionTitle: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '700',
  },
  actionSubtitle: {
    color: TEXT_MUTED,
    fontSize: 12,
    lineHeight: 16,
  },
  editorCard: {
    backgroundColor: SURFACE,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
    padding: 18,
    gap: 12,
  },
  editorHeader: {
    gap: 3,
  },
  editorLabel: {
    color: ACCENT_STRONG,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: Fonts.rounded,
  },
  editorTitle: {
    color: TEXT_PRIMARY,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  editorSubtitle: {
    color: TEXT_MUTED,
    fontSize: 12,
    lineHeight: 16,
  },
  editorField: {
    minHeight: 144,
    backgroundColor: PANEL,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(247, 242, 232, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  editorFieldMuted: {
    backgroundColor: PANEL_ALT,
  },
  editorInput: {
    minHeight: 112,
    color: TEXT_PRIMARY,
    fontSize: 18,
    lineHeight: 26,
  },
  editorInputCompact: {
    minHeight: 96,
    fontSize: 17,
    lineHeight: 24,
  },
  editorFooter: {
    color: TEXT_MUTED,
    fontSize: 12,
    lineHeight: 16,
  },
  resultActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  transcriptCard: {
    gap: 12,
  },
  smallActionButton: {
    minWidth: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: PANEL_ALT,
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  smallActionButtonDisabled: {
    opacity: 0.5,
  },
  smallActionLabel: {
    color: TEXT_PRIMARY,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  smallActionLabelDisabled: {
    color: TEXT_MUTED,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
    backgroundColor: PANEL_ALT,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    color: TEXT_PRIMARY,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  translateButton: {
    backgroundColor: ACCENT,
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  translateButtonDisabled: {
    opacity: 0.45,
  },
  translateInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    justifyContent: 'center',
  },
  translateCopy: {
    gap: 2,
  },
  translateTitle: {
    color: PANEL_ALT,
    fontSize: 18,
    lineHeight: 23,
    fontWeight: '700',
  },
  translateSubtitle: {
    color: 'rgba(13, 27, 31, 0.74)',
    fontSize: 12,
    lineHeight: 16,
  },
  historySection: {
    gap: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  historyTitle: {
    color: TEXT_PRIMARY,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  historyClearButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: PANEL_ALT,
  },
  historyClearButtonText: {
    color: TEXT_PRIMARY,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  historyList: {
    gap: 10,
  },
  historyCard: {
    backgroundColor: SURFACE,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
    padding: 16,
    gap: 8,
  },
  historyCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  historyRoute: {
    flex: 1,
    color: TEXT_PRIMARY,
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '700',
  },
  historyBadge: {
    borderRadius: 999,
    backgroundColor: 'rgba(242, 166, 90, 0.16)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  historyBadgeText: {
    color: ACCENT_STRONG,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  historySourceText: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 19,
  },
  historyTranslatedText: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    lineHeight: 22,
  },
  historyEmptyCard: {
    backgroundColor: SURFACE,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: SURFACE_BORDER,
    padding: 18,
    gap: 6,
  },
  historyEmptyTitle: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  historyEmptyMessage: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 19,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(4, 10, 12, 0.62)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: SURFACE,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 16,
    maxHeight: '82%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 54,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(247, 242, 232, 0.18)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalHeaderCopy: {
    flex: 1,
    gap: 4,
  },
  modalTitle: {
    color: TEXT_PRIMARY,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    fontFamily: Fonts.serif,
  },
  modalSubtitle: {
    color: TEXT_MUTED,
    fontSize: 12,
    lineHeight: 16,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PANEL_ALT,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: PANEL_ALT,
    borderWidth: 1,
    borderColor: 'rgba(247, 242, 232, 0.08)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchCopy: {
    flex: 1,
    gap: 2,
  },
  searchInput: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    lineHeight: 22,
    padding: 0,
  },
  searchSubtitle: {
    color: TEXT_MUTED,
    fontSize: 12,
    lineHeight: 16,
  },
  languageList: {
    minHeight: 220,
  },
  languageListContent: {
    gap: 10,
    paddingBottom: 4,
  },
  languageListEmptyContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  languageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: PANEL_ALT,
    borderWidth: 1,
    borderColor: 'rgba(247, 242, 232, 0.08)',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
  },
  languageRowActive: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(242, 166, 90, 0.12)',
  },
  languageRowCopy: {
    flex: 1,
    gap: 2,
  },
  languageRowLabel: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    lineHeight: 22,
  },
  languageRowLabelActive: {
    fontWeight: '700',
  },
  languageRowSubtitle: {
    color: TEXT_MUTED,
    fontSize: 12,
    lineHeight: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    gap: 6,
  },
  emptyTitle: {
    color: TEXT_PRIMARY,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: TEXT_MUTED,
    fontSize: 12,
    lineHeight: 16,
  },
});
