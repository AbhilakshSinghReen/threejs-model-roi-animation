const speechSynthesis = window.speechSynthesis ?? null;

class SpeechSynthesizer {
  constructor() {
    if (!speechSynthesis) {
      console.error("Speech Synthesis is not supported by your browser.");
      return;
    }
  }

  speakText(language, text) {
    if (text === "") {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (language === "Hindi") {
      utterance.lang = "hi-IN";
    }

    speechSynthesis.speak(utterance);
  }
}

const speechSynthesizer = new SpeechSynthesizer();
export default speechSynthesizer;
