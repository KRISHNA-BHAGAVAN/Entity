// PreviewPage.jsx
import { useState } from "react";
import { Worker, Viewer } from "@react-pdf-viewer/core";
import { defaultLayoutPlugin } from "@react-pdf-viewer/default-layout";
import { searchPlugin } from "@react-pdf-viewer/search";

import "@react-pdf-viewer/core/lib/styles/index.css";
import "@react-pdf-viewer/default-layout/lib/styles/index.css";
import "@react-pdf-viewer/search/lib/styles/index.css";

function expandPhraseIntoSearchKeys(phrase, windowSize = 3) {
  const trimmed = phrase.trim();
  if (!trimmed) return [];

  const tokens = trimmed.split(/\s+/);
  if (tokens.length <= windowSize) {
    return [trimmed];
  }

  const keys = [trimmed]; // keep full phrase too
  for (let i = 0; i <= tokens.length - windowSize; i += 1) {
    const slice = tokens.slice(i, i + windowSize).join(" ");
    keys.push(slice);
  }
  return keys;
}

function buildSearchTerms(rawInput) {
  const phrases = rawInput
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const allKeys = new Set();

  phrases.forEach((phrase) => {
    const keys = expandPhraseIntoSearchKeys(phrase, 3);
    keys.forEach((k) => allKeys.add(k));
  });

  return Array.from(allKeys);
}

function PreviewPage({ fileUrl = "/modified_brochure.pdf" }) {
  const [input, setInput] = useState(
    "Build Web/Enterprise Applications using SpringBoot WITH REST API"
  );
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(false);

  const searchPluginInstance = searchPlugin();
  const { highlight } = searchPluginInstance;

  const defaultLayoutPluginInstance = defaultLayoutPlugin({
    toolbarPlugin: {
      searchPlugin: searchPluginInstance,
    },
  });

  async function handleHighlight() {
    const expandedTerms = buildSearchTerms(input);
    setTerms(expandedTerms);

    if (!expandedTerms.length) {
      await highlight([]);
      return;
    }

    setLoading(true);
    try {
      await highlight(expandedTerms);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setInput("");
    setTerms([]);
    highlight([]);
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <div className="flex items-center gap-2 p-3 border-b border-slate-200 bg-white">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Comma-separated phrases to highlight"
          className="w-96 px-3 py-1.5 text-sm border border-slate-300 rounded-lg outline-none focus:ring-1 focus:ring-black"
        />
        <button
          onClick={handleHighlight}
          disabled={loading}
          className="px-4 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? "Highlighting..." : "Highlight"}
        </button>
        <button
          onClick={handleClear}
          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
        >
          Clear
        </button>
        {terms.length > 0 && (
          <span className="text-xs text-slate-500">
            Search keys: {terms.join(" | ")}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <Worker workerUrl="/pdf.worker.min.js">
          <div className="h-full">
            <Viewer
              fileUrl={fileUrl}
              plugins={[defaultLayoutPluginInstance, searchPluginInstance]}
            />
          </div>
        </Worker>
      </div>
    </div>
  );
}

export default PreviewPage;
