import { apiCall } from "../config/api";
/**
 * AI-powered variable suggestion using backend API
 */
export const suggestVariables = async (text) => {
  if (!text?.trim()) return [];

  try {
    const data = await apiCall("/suggest_variables/invoke", {
      method: "POST",
      body: JSON.stringify({
        input: { text: text.substring(0, 15000) },
      }),
    });
    return data.output?.suggestions || [];
  } 
  
  catch (error) {
    console.error("AI variable suggestion failed:", error);
    return [];
  }

};

/**
 * Schema discovery using backend API
 */
export const discoverSchema = async (documents) => {
  if (!documents?.length) return null;

  try {
    const data = await apiCall("/discover-schema", {
      method: "POST",
      body: JSON.stringify({ documents }),
    });
    return data;
  } catch (error) {
    console.error("Schema discovery failed:", error);
    throw error;
  }
};
