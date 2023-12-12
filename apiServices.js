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

        responseData.result.report.report_metadata = tryParseJsonString(responseData.result.report.report_metadata);
        
        responseData.result.report.meshes_metadata = tryParseJsonString(responseData.result.report.meshes_metadata);
        for (let i = 0; i < responseData.result.report.meshes_metadata.meshes.length; i++) {
          responseData.result.report.meshes_metadata.meshes[i] = {
            ...responseData.result.report.meshes_metadata.meshes[i],
            geometricOrigin: tryParseJsonString(responseData.result.report.meshes_metadata.meshes[i].geometricOrigin),
          };
        }
        // responseData.result.report.original_report = tryParseJsonString(responseData.result.report.original_report);
        responseData.result.report.simplified_reports = tryParseJsonString(
          responseData.result.report.simplified_reports
        );
        // responseData.result.report.processing_status = tryParseJsonString(responseData.result.report.processing_status);

        return responseData;
      },
    };
  }
}

const apiClient = new ApiClient();

export default apiClient;
