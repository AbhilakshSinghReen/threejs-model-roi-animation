import { downloadBlob } from "../utils/jsUtils";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
const SpeechRecognitionEvent = window.SpeechRecognitionEvent || window.webkitSpeechRecognitionEvent;

const minMeaningfullTextLength = 0;
const minMeaningfullTextNumWords = 0;
const minMeaningfullAudioDuration = 0;

class SpeechRecognizer {
  constructor() {
    this.speechRecognition = new SpeechRecognition();
    this.onCompleted = async () => {};
    this.audioChunks = [];
    this.audioRecorder = null;

    this.speechRecognition.addEventListener("result", async (e) => {
      const combinedText = Array.from(e.results)
        .map((result) => result[0])
        .map((result) => result.transcript)
        .join(" ");

      this.audioRecorder.stop();

      await this.onCompleted(combinedText);
    });
  }

  async runSpeechRecognition(language, onCompleted) {
    const audioRecorderStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.audioRecorder = new MediaRecorder(audioRecorderStream);
    this.audioChunks = [];
    this.audioRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.audioChunks.push(e.data);
      }
    };
    this.audioRecorder.onstop = () => {
      this.audioBlob = new Blob(this.audioChunks, { type: "audio/wav" });
      //   downloadBlob(this.audioBlob);
      this.audioChunks = [];
      console.log("Recording completed");
    };

    this.audioRecorder.start();

    /////

    this.onCompleted = onCompleted;
    this.speechRecognition.start();
  }
}

const speechRecognizer = new SpeechRecognizer();
export default speechRecognizer;
