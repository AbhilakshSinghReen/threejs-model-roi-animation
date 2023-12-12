import { delay, randomInt } from "./jsUtils";

async function addInnerTextWithTypewriterEffect(element, text, minSpeed, maxSpeed) {
  let currentTextIndex = 0;

  while (currentTextIndex < text.length) {
    currentTextIndex += randomInt(0, 10);
    currentTextIndex = Math.min(text.length, currentTextIndex);

    await delay(randomInt(0, 100));

    element.innerText = text.substring(0, currentTextIndex);
  }
}

export { addInnerTextWithTypewriterEffect };
