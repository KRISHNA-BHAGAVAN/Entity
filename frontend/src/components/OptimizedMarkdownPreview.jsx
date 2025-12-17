import { useState, useEffect, useMemo, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { debounce } from '../utils/performanceOptimizer';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const OptimizedMarkdownPreview = ({ content, isLoading, onTextSelect }) => {
  const [renderedContent, setRenderedContent] = useState('');
  const [isRendering, setIsRendering] = useState(false);
  const containerRef = useRef(null);
  const renderTimeoutRef = useRef(null);

  // Memoize markdown content
  const processedContent = useMemo(() => {
    if (!content) return '';
    return content;
  }, [content]);

  // Debounced rendering function
  const debouncedRender = useMemo(
    () => debounce((content) => {
      setRenderedContent(content);
      setIsRendering(false);
    }, 50),
    []
  );

  // Effect for rendering
  useEffect(() => {
    if (!processedContent) {
      setRenderedContent('');
      setIsRendering(false);
      return;
    }

    setIsRendering(true);
    debouncedRender(processedContent);
  }, [processedContent, debouncedRender]);

  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection || !selection.toString().trim()) return;

    const container = containerRef.current;
    if (container && container.contains(selection.anchorNode)) {
      onTextSelect?.(selection.toString().trim());
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 min-h-[200px]">
        <Loader2 className="animate-spin text-blue-600" size={32} />
        <p className="text-xs font-medium">Loading document...</p>
      </div>
    );
  }



  return (
    <div 
      ref={containerRef}
      onMouseUp={handleMouseUp}
      className="h-full overflow-y-auto p-4 md:p-8 bg-white"
      style={{ 
        userSelect: 'text',
        WebkitUserSelect: 'text',
        MozUserSelect: 'text'
      }}
    >
      {renderedContent ? (
        <div className="prose prose-sm prose-slate max-w-none">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
          components={{
            h1: ({children}) => <h1 className="text-2xl font-bold mb-4 text-slate-800 border-b border-slate-200 pb-2">{children}</h1>,
            h2: ({children}) => <h2 className="text-xl font-bold mb-3 text-slate-800 border-b border-slate-200 pb-1">{children}</h2>,
            h3: ({children}) => <h3 className="text-lg font-bold mb-2 text-slate-800">{children}</h3>,
            p: ({children}) => <p className="mb-3 text-slate-700 leading-relaxed">{children}</p>,
            ul: ({children}) => <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>,
            ol: ({children}) => <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>,
            li: ({children}) => <li className="text-slate-700">{children}</li>,
            table: ({children}) => <table className="min-w-full border-collapse border border-slate-300 mb-4">{children}</table>,
            th: ({children}) => <th className="border border-slate-300 bg-slate-100 px-3 py-2 text-left font-semibold text-slate-800">{children}</th>,
            td: ({children}) => <td className="border border-slate-300 px-3 py-2 text-slate-700">{children}</td>,
            blockquote: ({children}) => <blockquote className="border-l-4 border-blue-500 pl-4 italic text-slate-600 mb-4">{children}</blockquote>,
            code: ({inline, children}) => 
              inline 
                ? <code className="bg-slate-100 px-1 py-0.5 rounded text-sm font-mono text-slate-800">{children}</code>
                : <pre className="bg-slate-100 p-3 rounded-lg overflow-x-auto mb-4"><code className="text-sm font-mono text-slate-800">{children}</code></pre>,
            strong: ({children}) => <strong className="font-bold text-slate-800">{children}</strong>,
            em: ({children}) => <em className="italic text-slate-700">{children}</em>
          }}
          >
            {renderedContent}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="text-center py-8 text-slate-400">
          <p>No content to preview</p>
        </div>
      )}
    </div>
  );
};

export default OptimizedMarkdownPreview;