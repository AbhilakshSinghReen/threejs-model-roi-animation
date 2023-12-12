const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
const SpeechRecognitionEvent = window.SpeechRecognitionEvent || window.webkitSpeechRecognitionEvent;

class SpeechRecognizer {
  constructor() {
    this.speechRecognition = new SpeechRecognition();
    this.onCompleted = async () => {};

    this.speechRecognition.addEventListener("result", async (e) => {
      const combinedText = Array.from(e.results)
        .map((result) => result[0])
        .map((result) => result.transcript)
        .join(" ");

      await this.onCompleted(combinedText);
    });
  }

  async runSpeechRecognition(onCompleted) {
    const audioRecorderStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioRecorder = new MediaRecorder(audioRecorderStream);
    

    /////

    this.onCompleted = onCompleted;
    this.speechRecognition.start();
  }
}

const speechRecognizer = new SpeechRecognizer();
export default speechRecognizer;
