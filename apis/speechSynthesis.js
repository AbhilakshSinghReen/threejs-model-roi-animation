const speechSynthesis = window.speechSynthesis ?? null;

class SpeechSynthesizer {
  constructor() {
    if (!speechSynthesis) {
      console.error("Speech Synthesis is not supported by your browser.");
      return;
    }
  }

  textToSpeech(text) {
    if (text === "") {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(utterance);
  }
}

const speechSynthesizer = new SpeechSynthesizer();
export default { speechSynthesizer };
