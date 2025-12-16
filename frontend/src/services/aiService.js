import { api } from '../config/api.js';

/**
 * AI-powered variable suggestion using backend API
 */
export const suggestVariables = async (text) => {
  if (!text?.trim()) return [];

  try {
    const data = await api.suggestVariables(text);
    return data.output?.suggestions || [];
  } catch (error) {
    console.error('AI variable suggestion failed:', error);
    return [];
  }
};
