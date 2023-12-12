function getPathPart(path, partIndex) {
  const pathParts = path.split("/");
  return parseInt(pathParts[partIndex]);
}

async function delay(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function downloadBlob(blob) {
  const downloadLink = document.createElement("a");
  downloadLink.href = URL.createObjectURL(blob);
  downloadLink.download = "recording.wav";
  downloadLink.textContent = "Download Audio";
  downloadLink.style.display = "block";

  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}

export { getPathPart, delay, randomInt, downloadBlob };
