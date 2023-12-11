// const urlParser = new URL(window.location.href);
// const urlOrigin = urlParser.origin;

// let apiBaseUrl = process.env.REACT_APP_API_BASE_URL;
// let mediaBaseUrl = process.env.REACT_APP_MEDIA_BASE_URL;

// if (!process.env.REACT_APP_API_BASE_URL) {
//   apiBaseUrl = urlOrigin + "/api/radio-reports";
//   console.warn(`Environment variable REACT_APP_API_BASE_URL not defined, will default to ${apiBaseUrl}`);
// }

// if (!process.env.REACT_APP_MEDIA_BASE_URL) {
//   mediaBaseUrl = urlOrigin + "/media";
//   console.warn(`Environment variable REACT_APP_MEDIA_BASE_URL not defined, will default to ${mediaBaseUrl}`);
// }

let apiBaseUrl = "http://localhost:8000/api/radio-reports"
let mediaBaseUrl = "http://localhost:8000/mediaF"

const segmentMeshesUrlPrefix = mediaBaseUrl + "/segment-meshes";

const apiEndpoints = {
  reports: {
    getDetail: () => {
      return `${apiBaseUrl}/reports/get-detail/`;
    },
  },
};

export default apiEndpoints;
export { apiBaseUrl, mediaBaseUrl, segmentMeshesUrlPrefix };
