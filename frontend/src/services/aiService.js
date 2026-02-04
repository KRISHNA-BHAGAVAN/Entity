import { apiCall } from "../config/api";

/**
 * Schema discovery using backend API
 */
export const discoverSchema = async (documents, userInstructions = null) => {
  if (!documents?.length) return null;

  try {
    const requestBody = { documents };
    if (userInstructions) {
      requestBody.user_instructions = userInstructions;
    }

    const data = await apiCall("/discover-schema", {
      method: "POST",
      body: JSON.stringify(requestBody),
    });
    return data;
  } catch (error) {
    console.error("Schema discovery failed:", error);
    
    // Check for BYOK-specific errors
    if (error.status === 403 && error.detail?.error) {
      const byokError = new Error(error.detail.message || "API key required");
      byokError.code = error.detail.error;
      byokError.action = error.detail.action;
      throw byokError;
    }
    
    throw error;
  }
};
