const StatsTab = ({ schemaData }) => {
  console.log('StatsTab schemaData:', schemaData);
  
  // Try different possible locations for stats
  const stats = schemaData?.stats || schemaData?.schema?.stats;
  const estimatedCost = schemaData?.estimated_cost || schemaData?.schema?.estimated_cost;
  
  console.log('Stats:', stats);
  console.log('Estimated Cost:', estimatedCost);

  if (!stats) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <p className="text-sm text-slate-600">
          Stats will appear after schema discovery
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Processing Stats */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-lg font-semibold mb-4">Processing Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.docs_processed}</div>
            <div className="text-xs text-slate-500">Documents</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.total_fields}</div>
            <div className="text-xs text-slate-500">Fields</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.total_locations}</div>
            <div className="text-xs text-slate-500">Locations</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.total_chars_processed?.toLocaleString()}</div>
            <div className="text-xs text-slate-500">Characters</div>
          </div>
        </div>
      </div>

      {/* LLM Stats */}
      {stats.llm && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-lg font-semibold mb-4">AI Processing</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">{stats.llm.summary.llm_calls}</div>
              <div className="text-xs text-slate-500">API Calls</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">{stats.llm.summary.total_input_tokens?.toLocaleString()}</div>
              <div className="text-xs text-slate-500">Input Tokens</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-rose-600">{stats.llm.summary.total_output_tokens?.toLocaleString()}</div>
              <div className="text-xs text-slate-500">Output Tokens</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-slate-600">{stats.llm.summary.total_tokens?.toLocaleString()}</div>
              <div className="text-xs text-slate-500">Total Tokens</div>
            </div>
          </div>
        </div>
      )}

      {/* Performance */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-lg font-semibold mb-4">Performance</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-cyan-600">{(stats.processing_time * 1000).toFixed(1)}ms</div>
            <div className="text-xs text-slate-500">Processing Time</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-teal-600">{stats.cache_hit ? 'Yes' : 'No'}</div>
            <div className="text-xs text-slate-500">Cache Hit</div>
          </div>
        </div>
      </div>

      {/* Cost Estimate */}
      {estimatedCost && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-lg font-semibold mb-4">Cost Estimate</h3>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">${estimatedCost.total_cost_usd?.toFixed(4) || '0.0000'}</div>
            <div className="text-xs text-slate-500">Total Cost (USD)</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatsTab;