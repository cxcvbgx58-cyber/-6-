
export enum AuthMode {
  LOGIN = 'LOGIN',
  REGISTER = 'REGISTER',
  RESET = 'RESET',
  VERIFY = 'VERIFY'
}

// --- Sound Assets ---
export const popSound = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
const placeholderSound = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

export const cowSound = placeholderSound;
export const pigSound = placeholderSound;
export const sheepSound = placeholderSound;

export const playSound = (src: string) => {
  try {
    const audio = new Audio(src);
    audio.play().catch(() => {});
  } catch (e) {
  }
};

export const speak = (text: string) => {
  if ('speechSynthesis' in window) {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch(e) {
    }
  }
};
