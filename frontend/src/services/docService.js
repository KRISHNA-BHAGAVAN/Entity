import JSZip from 'jszip';
import mammoth from 'mammoth';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

/**
 * Extracts raw text from a DOCX file.
 */
export const extractTextFromDocx = async (file) => {
  try {
    const zip = new JSZip();
    const content = await file.arrayBuffer();
    const loadedZip = await zip.loadAsync(content);

    const docFile = loadedZip.file('word/document.xml');
    if (!docFile) {
      throw new Error('Invalid DOCX: missing word/document.xml');
    }

    const xmlStr = await docFile.async('string');
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlStr, 'text/xml');

    if (xmlDoc.getElementsByTagName('parsererror').length > 0) {
      throw new Error('Error parsing document XML');
    }

    const body = xmlDoc.getElementsByTagName('w:body')[0];
    if (!body) return '';

    const getParagraphText = (pNode) => {
      let line = '';
      const runs = pNode.getElementsByTagName('w:r');

      for (let run of runs) {
        for (let node of run.childNodes) {
          if (node.nodeName === 'w:t') {
            line += node.textContent || '';
          } else if (node.nodeName === 'w:tab') {
            line += '\t';
          } else if (node.nodeName === 'w:br') {
            line += '\n';
          }
        }
      }
      return line;
    };

    const lines = [];

    const traverse = (node) => {
      if (node.nodeType === 1) {
        if (node.nodeName === 'w:p') {
          const text = getParagraphText(node);
          if (text.trim()) lines.push(text);
          return;
        }

        if (node.nodeName === 'w:tbl') {
          const rows = node.getElementsByTagName('w:tr');
          for (let row of rows) {
            const cells = row.getElementsByTagName('w:tc');
            const rowContent = [];
            for (let cell of cells) {
              let cellText = '';
              const ps = cell.getElementsByTagName('w:p');
              for (let p of ps) {
                cellText += getParagraphText(p) + ' ';
              }
              rowContent.push(cellText.trim());
            }
            const line = rowContent.join(' | ').trim();
            if (line) lines.push(line);
          }
          return;
        }
      }

      for (let child of node.childNodes) {
        traverse(child);
      }
    };

    traverse(body);
    return lines.join('\n');
  } catch (e) {
    console.error('Error extracting text:', e);
    return 'Error parsing document.';
  }
};

/**
 * Extracts Markdown from DOCX.
 */
export const extractMarkdownFromDocx = async (file) => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const html = result.value || '';

    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '_'
    });

    turndownService.use(gfm);
    turndownService.keep(['table']);

    let markdown = turndownService.turndown(html);

    markdown = markdown.replace(/!\[[^\]]*]\([^)]*\)/gi, '');
    markdown = markdown.replace(/\n{3,}/g, '\n\n');
    markdown = markdown.trim();

    return markdown;
  } catch (e) {
    console.error('Error extracting markdown:', e);
    return '';
  }
};

// Frontend variable replacement (fallback only)
export const replaceVariablesInDocx = async (file, mappings, toPlaceholder = true) => {
  // This is now a fallback - backend handles processing
  console.warn('Using frontend fallback for variable replacement');
  
  const zip = new JSZip();
  const content = await file.arrayBuffer();
  const loadedZip = await zip.loadAsync(content);
  
  // Simplified processing for fallback
  const docFile = loadedZip.file('word/document.xml');
  if (!docFile) throw new Error('Invalid DOCX');
  
  let xml = await docFile.async('string');
  
  mappings.forEach(m => {
    const target = toPlaceholder ? m.originalText : `{{${m.variableName}}}`;
    const replacement = toPlaceholder ? `{{${m.variableName}}}` : m.originalText;
    if (target) {
      xml = xml.split(target).join(replacement);
    }
  });
  
  loadedZip.file('word/document.xml', xml);
  
  return await loadedZip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
};

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


// Utility functions (kept for compatibility)
export const convertDocxToHtml = async (file) => {
  try {
    const buffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer: buffer });
    return result.value || '';
  } catch {
    return "<p class='text-red-500'>Error previewing document.</p>";
  }
};
