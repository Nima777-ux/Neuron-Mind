import { useCallback, useEffect, useRef, useState } from 'react';
import { transcribeVoiceAudio } from '../services/assistantApi';
import type { AppLanguage } from '../types/assistant';

interface SpeechRecognitionAlternative {
  transcript: string;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error?: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function pickSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/ogg',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? '';
}

function readBlobAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const commaIdx = result.indexOf(',');
      resolve(commaIdx !== -1 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read recorded audio.'));
    reader.readAsDataURL(blob);
  });
}

export function isMicrophonePolicyBlocked(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as unknown as {
    permissionsPolicy?: { allowsFeature?: (feature: string) => boolean };
    featurePolicy?: { allowsFeature?: (feature: string) => boolean };
  };
  if (typeof doc.permissionsPolicy?.allowsFeature === 'function') {
    return !doc.permissionsPolicy.allowsFeature('microphone');
  }
  if (typeof doc.featurePolicy?.allowsFeature === 'function') {
    return !doc.featurePolicy.allowsFeature('microphone');
  }
  return false;
}

async function queryMicrophonePermissionState(): Promise<PermissionState | 'unknown'> {
  if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
    return 'unknown';
  }
  try {
    const status = await navigator.permissions.query({
      name: 'microphone' as PermissionName,
    });
    return status.state;
  } catch {
    return 'unknown';
  }
}

export async function formatMicError(
  err: unknown,
  language: AppLanguage = 'en'
): Promise<string> {
  const isFa = language === 'fa';
  const name = err instanceof DOMException || err instanceof Error ? err.name : '';

  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    const policyBlocked = isMicrophonePolicyBlocked();
    const permState = await queryMicrophonePermissionState();
    const inIframe = typeof window !== 'undefined' && window.self !== window.top;

    if (policyBlocked || (inIframe && permState !== 'denied')) {
      return isFa
        ? 'دسترسی میکروفون در فریم پیش‌نمایش هنوز فعال نشده است. صفحه را یک بار رفرش کنید یا نورون مایند را در یک تب جدید مرورگر باز کرده و دسترسی میکروفون را تایید کنید.'
        : 'Microphone access is restricted by this embedded preview frame. Refresh the preview page once or open Neuron Mind in a new browser tab, then allow Microphone access.';
    }

    return isFa
      ? 'دسترسی به میکروفون مسدود است. روی آیکون تنظیمات کنار نوار آدرس مرورگر کلیک کنید، گزینه Microphone را روی Allow بگذارید و دوباره تلاش کنید.'
      : 'Microphone permission is blocked in your browser site settings. Click the lock/tune icon beside the address bar, set Microphone to Allow, and try again.';
  }

  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return isFa
      ? 'هیچ میکروفونی روی این دستگاه شناسایی نشد.'
      : 'No microphone was detected on this device.';
  }

  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return isFa
      ? 'میکروفون در حال حاضر توسط برنامه دیگری در حال استفاده است.'
      : 'Microphone is currently in use by another application.';
  }

  if (name === 'SecurityError') {
    return isFa
      ? 'دسترسی میکروفون در این آدرس مجاز نیست. از اجرای برنامه روی HTTPS یا localhost مطمئن شوید.'
      : 'Microphone access requires a secure context (HTTPS or localhost).';
  }

  return err instanceof Error && err.message ? err.message : 'ERROR';
}

export function useVoiceInput(
  language: AppLanguage,
  onTranscript: (text: string) => void,
  options?: { isOnline?: boolean }
) {
  const isOnline = options?.isOnline ?? true;
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mountedRef = useRef(true);

  const supportsMediaRecorder =
    typeof window !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined';
  const supportsSpeechRecognition = Boolean(getSpeechRecognitionCtor());
  const isSupported = supportsMediaRecorder || supportsSpeechRecognition;

  const cleanupMediaStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore teardown error
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore teardown error
        }
      }
      cleanupMediaStream();
    };
  }, [cleanupMediaStream]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        cleanupMediaStream();
      }
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Ignore stop error
      }
    }
    setIsListening(false);
  }, [cleanupMediaStream]);

  const startBrowserSpeechRecognition = useCallback(
    (Ctor: SpeechRecognitionConstructor) => {
      const recognition = new Ctor();
      recognition.lang = language === 'fa' ? 'fa-IR' : 'en-US';
      recognition.interimResults = false;
      recognition.continuous = false;

      recognition.onresult = (event) => {
        const parts: string[] = [];
        for (let i = 0; i < event.results.length; i += 1) {
          const res = event.results[i];
          if (res && res.length > 0) {
            parts.push(res[0].transcript);
          }
        }
        const transcript = parts.join(' ').trim();
        if (transcript) {
          onTranscriptRef.current(transcript);
        }
      };

      recognition.onerror = (event) => {
        const code = event.error || '';
        const isFa = language === 'fa';
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          void formatMicError(
            new DOMException('Permission denied', 'NotAllowedError'),
            language
          ).then((msg) => {
            if (mountedRef.current) setVoiceError(msg);
          });
        } else if (code === 'no-speech') {
          setVoiceError(
            isFa
              ? 'صدایی دریافت نشد. لطفاً نزدیک‌تر به میکروفون صحبت کنید.'
              : 'No speech was detected. Please try speaking closer to the microphone.'
          );
        } else if (code === 'audio-capture') {
          setVoiceError(
            isFa ? 'ورودی میکروفون شناسایی نشد.' : 'No microphone input was detected.'
          );
        } else if (code === 'network') {
          setVoiceError(
            isFa
              ? 'خطای شبکه در سرویس تشخیص گفتار. لطفاً دوباره تلاش کنید.'
              : 'Speech service network error. Please try again.'
          );
        } else {
          setVoiceError('ERROR');
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      try {
        setIsListening(true);
        recognition.start();
      } catch (err) {
        setIsListening(false);
        void formatMicError(err, language).then((msg) => {
          if (mountedRef.current) setVoiceError(msg);
        });
      }
    },
    [language]
  );

  const startListening = useCallback(async () => {
    if (isTranscribing) return;
    if (isListening) {
      stopListening();
      return;
    }

    setVoiceError(null);
    const isFa = language === 'fa';

    if (supportsMediaRecorder && isOnline) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!mountedRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        mediaStreamRef.current = stream;
        audioChunksRef.current = [];

        const preferredMime = pickSupportedAudioMimeType();
        const recorder = preferredMime
          ? new MediaRecorder(stream, { mimeType: preferredMime })
          : new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.onerror = () => {
          cleanupMediaStream();
          if (mountedRef.current) {
            setIsListening(false);
            setIsTranscribing(false);
            setVoiceError(
              isFa ? 'ضبط صدا از میکروفون با خطا مواجه شد.' : 'Could not record microphone audio.'
            );
          }
        };

        recorder.onstop = async () => {
          cleanupMediaStream();
          mediaRecorderRef.current = null;
          if (!mountedRef.current) return;

          setIsListening(false);
          const chunks = audioChunksRef.current;
          audioChunksRef.current = [];
          const actualMime = recorder.mimeType || preferredMime || 'audio/webm';
          const blob = new Blob(chunks, { type: actualMime });

          if (blob.size < 350) {
            setVoiceError(
              isFa
                ? 'صدایی ضبط نشد. چند ثانیه صحبت کنید و سپس دکمه توقف را بزنید.'
                : 'No speech was captured. Speak for a moment, then tap stop.'
            );
            return;
          }

          setIsTranscribing(true);
          try {
            const base64 = await readBlobAsBase64(blob);
            const result = await transcribeVoiceAudio(base64, actualMime, language);
            if (!mountedRef.current) return;
            const text = result.transcript.trim();
            if (text) {
              onTranscriptRef.current(text);
            } else {
              setVoiceError(
                isFa
                  ? 'کلامی در فایل ضبط‌شده تشخیص داده نشد.'
                  : 'No speech could be recognized from the recording.'
              );
            }
          } catch (err) {
            if (mountedRef.current) {
              setVoiceError(
                err instanceof Error
                  ? err.message
                  : isFa
                    ? 'تبدیل صدا به متن ناموفق بود.'
                    : 'Unable to transcribe recorded voice.'
              );
            }
          } finally {
            if (mountedRef.current) {
              setIsTranscribing(false);
            }
          }
        };

        recorder.start(250);
        setIsListening(true);
        return;
      } catch (err) {
        cleanupMediaStream();
        const fallbackCtor = getSpeechRecognitionCtor();
        if (
          fallbackCtor &&
          !(
            err instanceof DOMException &&
            (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
          )
        ) {
          startBrowserSpeechRecognition(fallbackCtor);
          return;
        }
        setIsListening(false);
        const formatted = await formatMicError(err, language);
        if (mountedRef.current) {
          setVoiceError(formatted);
        }
        return;
      }
    }

    const Ctor = getSpeechRecognitionCtor();
    if (Ctor) {
      startBrowserSpeechRecognition(Ctor);
      return;
    }

    setVoiceError('UNSUPPORTED');
  }, [
    cleanupMediaStream,
    isListening,
    isOnline,
    isTranscribing,
    language,
    startBrowserSpeechRecognition,
    stopListening,
    supportsMediaRecorder,
  ]);

  return {
    isSupported,
    isListening,
    isTranscribing,
    voiceError,
    clearVoiceError: () => setVoiceError(null),
    startListening,
    stopListening,
  };
}
