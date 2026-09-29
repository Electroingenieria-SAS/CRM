type RecognitionAlternative = { transcript: string };
type RecognitionResult = { 0: RecognitionAlternative; isFinal: boolean };
type RecognitionEventLike = { results: ArrayLike<RecognitionResult> };

interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

type RecognitionConstructor = new () => RecognitionLike;

function browserRecognition() {
  if (typeof window === 'undefined') return null;
  const candidate = window as typeof window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null;
}

export function canUseSpeechRecognition() {
  return Boolean(browserRecognition());
}

function voiceScore(voice: SpeechSynthesisVoice) {
  const language = voice.lang.toLowerCase();
  const name = voice.name.toLowerCase();
  let score = 0;
  if (language.startsWith('es-co')) score += 8;
  else if (language.startsWith('es-mx') || language.startsWith('es-us')) score += 6;
  else if (language.startsWith('es-')) score += 4;

  if (/(jorge|juan|diego|carlos|miguel|pablo|andres|male|mascul)/.test(name)) score += 2;
  if (voice.localService) score += 1;
  return score;
}

export function speakPaco(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  const utterance = new SpeechSynthesisUtterance(text.slice(0, 320));
  utterance.lang = 'es-CO';
  utterance.rate = 1;
  const voices = window.speechSynthesis.getVoices().filter((voice) => voice.lang.startsWith('es'));
  const selected = [...voices].sort((left, right) => voiceScore(right) - voiceScore(left))[0];
  if (selected) utterance.voice = selected;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  return true;
}

export function startPacoRecognition(onText: (text: string) => void, onError: () => void) {
  const Constructor = browserRecognition();
  if (!Constructor) {
    onError();
    return () => undefined;
  }

  const recognition = new Constructor();
  recognition.lang = 'es-CO';
  recognition.interimResults = false;
  recognition.continuous = false;
  recognition.onresult = (event) => {
    const result = event.results[0];
    const transcript = result?.[0]?.transcript?.trim();
    if (transcript) onText(transcript);
  };
  recognition.onerror = onError;
  recognition.start();
  return () => recognition.stop();
}
