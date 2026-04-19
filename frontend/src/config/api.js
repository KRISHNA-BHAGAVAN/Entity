import { getAccessToken } from "../services/authSession";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

console.log(`API_BASE_URL: ${API_BASE_URL}`);

const getAuthHeaders = async () => {
  const token = await getAccessToken();
  if (!token) return {};

  return {
    Authorization: `Bearer ${token}`,
  };
};


export const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;

  // 1. Fetch the cached session token
  const authHeaders = await getAuthHeaders();

  // 2. Log headers for debugging (Check your browser console!)
  console.log(`Sending request to: ${endpoint}`, {
    hasToken: !!authHeaders["Authorization"],
    method: options.method || "GET",
  });

  // 3. Smart Header Merging
  // Priority order:
  // - Default Content-Type (if not FormData)
  // - Custom headers from the specific call (options.headers)
  // - Auth headers (highest priority to ensure token is sent)
  const headers = {
    ...(!(options.body instanceof FormData) && {
      "Content-Type": "application/json",
    }),
    ...options.headers,
    ...authHeaders,
  };

  const config = {
    ...options, // Spread options first (contains method, body, etc.)
    headers, // Explicitly override headers with our merged object
  };

  try {
    const response = await fetch(url, config);


    if (!response.ok) {
      // 4. Enhanced error reporting
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(
        `API Error: ${response.status} ${response.statusText}`
      );
      error.status = response.status;
      error.detail = errorData.detail;
      throw error;
    }

    if (options.isBlob) {
      return response.blob();
    }

    return response.json();
  } catch (error) {
    console.error(`Fetch error for ${endpoint}:`, error);
    throw error;
  }
};

