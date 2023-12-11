function tryParseJsonString(jsonString, errorReturnValue = {}) {
  try {
    const parsedJSON = JSON.parse(jsonString);
    return parsedJSON;
  } catch (error) {
    console.error("Error parsing JSON:", error);
    return errorReturnValue;
  }
}

export { tryParseJsonString };
