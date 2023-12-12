const speechSynthesis = window.speechSynthesis ?? null;

class SpeechSynthesizer {
  constructor() {
    if (!speechSynthesis) {
      console.error("Speech Synthesis is not supported by your browser.");
      return;
    }
  }

  speakText(text) {
    if (text === "") {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(utterance);
  }
}

const speechSynthesizer = new SpeechSynthesizer();

// console.log("Speaking some dummy text");
// speechSynthesizer.speakText("dummy text");

export default speechSynthesizer;
