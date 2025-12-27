import { apiCall } from "../config/api";
import { cacheService } from "./cacheService";
import { supabase } from "./supabaseClient";
export const generateFinalDoc = async (docId, values, docVariables, tableEdits = []) => {
  // Handle different input formats
  let replacements;
  if (Array.isArray(docVariables)) {
    // If docVariables is already an array of [oldText, newText] tuples
    replacements = docVariables;
  } else {
    // Convert to List[Tuple[str, str]] shape for legacy format
    replacements = docVariables.map((m) => [
      m.originalText,
      values[m.variableName]?.trim() || m.originalText,
    ]);
  }

  // Debug logging
  console.log('\n=== GENERATE FINAL DOC DEBUG ===');
  console.log('Doc ID:', docId);
  console.log('Values:', values);
  console.log('Doc Variables:', docVariables);
  console.log('Replacements being sent:', replacements);
  console.log('Table Edits:', tableEdits);
  console.log('================================\n');

  const formData = new FormData();
  formData.append("replacements_json", JSON.stringify(replacements));
  formData.append("table_edits_json", JSON.stringify(tableEdits));
  const blob = await apiCall(`/replace-text/${docId}`, {
    method: "POST",
    body: formData,
    isBlob: true, // Indicate that the response is a blob
  });

  const count = blob.headers?.get("X-Total-Replacements");
  if (count) console.log("Total replacements:", count);
  return blob;
};

export const getMarkdownContent = async (docId) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Try cache first
  const cached = await cacheService.getMarkdown(docId, user.id);
  if (cached) return cached;

  // Fetch from API
  const response = await apiCall(`/extract-markdown`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc_id: docId })
  });

  // Cache the result
  await cacheService.setMarkdown(docId, response.markdown_content, user.id);
  return response.markdown_content;
};

export const getSchemaCache = async (key) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return await cacheService.getSchema(key, user.id);
};

export const setSchemaCache = async (key, schema) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await cacheService.setSchema(key, schema, user.id);
};
