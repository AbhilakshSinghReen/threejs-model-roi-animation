import apiEndpoints from "./apiEndpoints";
import { tryParseJsonString } from "./jsUtils";

class ApiClient {
  constructor() {
    this.reports = {
      getDetail: async (id) => {
        const endpoint = apiEndpoints.reports.getDetail();
        const requestBody = {
          reportId: id,
        };

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });
        const responseData = await response.json();

        if (!responseData.success) {
          return responseData;
        }

        const parsedReport = responseData.result.report;
        parsedReport.report_metadata = tryParseJsonString(parsedReport.report_metadata);
        parsedReport.meshes_metadata = tryParseJsonString(parsedReport.meshes_metadata);
        parsedReport.simplified_reports = tryParseJsonString(parsedReport.simplified_reports);

        for (let i = 0; i < parsedReport.meshes_metadata.meshes.length; i++) {
          parsedReport.meshes_metadata.meshes[i] = {
            ...parsedReport.meshes_metadata.meshes[i],
            geometricOrigin: tryParseJsonString(parsedReport.meshes_metadata.meshes[i].geometricOrigin),
          };
        }

        responseData.result.report = parsedReport;
        return responseData;
      },
      askQuestion: async (reportId, language, questionText = undefined, questionAudio = undefined) => {
        if (!questionText) {
          console.error("questionText must be provided");
          return;
        }

        const endpoint = apiEndpoints.reports.askQuestion();

        const formData = new FormData();

        formData.append("reportId", reportId);
        formData.append("language", language);
        formData.append("questionText", questionText);

        const response = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });
        const responseData = await response.json();
        return responseData;
      },
    };
  }
}

const apiClient = new ApiClient();

export default apiClient;
