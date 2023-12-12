const urlParser = new URL(window.location.href);
const urlOrigin = urlParser.origin;

let apiBaseUrl = "http://localhost:8000/api/radio-reports";
let mediaBaseUrl = "http://localhost:8000/media";

if (!apiBaseUrl) {
  apiBaseUrl = urlOrigin + "/api/radio-reports";
  console.warn(`Environment variable REACT_APP_API_BASE_URL not defined, will default to ${apiBaseUrl}`);
}

if (!mediaBaseUrl) {
  mediaBaseUrl = urlOrigin + "/media";
  console.warn(`Environment variable REACT_APP_MEDIA_BASE_URL not defined, will default to ${mediaBaseUrl}`);
}

const segmentMeshesUrlPrefix = mediaBaseUrl + "/segment-meshes";

const apiEndpoints = {
  reports: {
    getDetail: () => {
      return `${apiBaseUrl}/reports/get-detail/`;
    },
    askQuestion: () => {
      return `${apiBaseUrl}/reports/ask-question-based-on-report/`;
    },
  },
};

export default apiEndpoints;
export { apiBaseUrl, mediaBaseUrl, segmentMeshesUrlPrefix };
