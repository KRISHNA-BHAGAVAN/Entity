/**
 * Generate final DOCX using backend API.
 */
export const generateFinalDoc = async (docId, values, docVariables) => {
  const { api } = await import('../config/api.js');

  // Convert to List[Tuple[str, str]] shape
  const replacements = docVariables.map(m => [
    m.originalText,
    values[m.variableName]?.trim() || m.originalText
  ]);

  console.log('Normalized replacements --->\n', replacements);

  return await api.replaceText(docId, replacements);
};

