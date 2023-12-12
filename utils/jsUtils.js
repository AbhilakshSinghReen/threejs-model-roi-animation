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

export { getPathPart, delay, randomInt };
