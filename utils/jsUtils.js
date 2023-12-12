function getPathPart(path, partIndex) {
  const pathParts = path.split("/");
  return parseInt(pathParts[partIndex]);
}

export { getPathPart };
