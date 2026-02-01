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
    throw error;
  }
};
