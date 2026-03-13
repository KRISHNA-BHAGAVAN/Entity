import React from 'react';
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer,
  Legend
} from 'recharts';

const StatsTab = ({ schemaData }) => {
  console.log('StatsTab schemaData:', schemaData);
  
  // Try different possible locations for stats
  const stats = schemaData?.stats || schemaData?.schema?.stats;
  const estimatedCost = schemaData?.estimated_cost || schemaData?.schema?.estimated_cost;
  
  if (!stats) {
    return (
      <div className="bg-white rounded-xl border p-6">
        <p className="text-sm text-slate-600">
          Stats will appear after schema discovery
        </p>
      </div>
    );
  }

  // Data preps for Recharts
  const processData = [
    { name: 'Docs', value: stats.docs_processed, fill: '#3b82f6' }, // blue-500
    { name: 'Fields', value: stats.total_fields, fill: '#22c55e' }, // green-500
    { name: 'Locations', value: stats.total_locations, fill: '#a855f7' }, // purple-500
  ];

  const charsProcessed = stats.total_chars_processed || 0;

  let llmData = [];
  if (stats.llm?.summary) {
    llmData = [
      { name: 'Input', value: stats.llm.summary.total_input_tokens || 0, fill: '#0ea5e9' }, // sky-500
      { name: 'Output', value: stats.llm.summary.total_output_tokens || 0, fill: '#f43f5e' }, // rose-500
    ];
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border rounded shadow-sm p-2 text-sm text-slate-700">
          <p className="font-semibold">{label || payload[0].payload.name}</p>
          <p>{payload[0].value.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Processing Stats with Bar Chart */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="text-lg font-semibold mb-4 text-slate-800">Processing Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
              <div className="text-3xl font-bold text-blue-600">{stats.docs_processed}</div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Documents</div>
            </div>
            <div className="text-center p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
              <div className="text-3xl font-bold text-green-600">{stats.total_fields}</div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Fields</div>
            </div>
            <div className="text-center p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
              <div className="text-3xl font-bold text-purple-600">{stats.total_locations}</div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Locations</div>
            </div>
            <div className="text-center p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
              <div className="text-3xl font-bold text-orange-500">{charsProcessed.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Characters</div>
            </div>
          </div>
          <div className="h-48 w-full block">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={processData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                <XAxis dataKey="name" tick={{fontSize: 11, fill: '#64748b', fontWeight: 600}} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                  {processData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* LLM Stats with Pie Chart */}
      {stats.llm && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-lg font-semibold mb-4 text-slate-800">AI Processing</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
                <div className="text-3xl font-bold text-indigo-600">{stats.llm.summary.llm_calls}</div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">API Calls</div>
              </div>
              <div className="text-center p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
                <div className="text-3xl font-bold text-slate-700">{stats.llm.summary.total_tokens?.toLocaleString()}</div>
                <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Total Tokens</div>
              </div>
              <div className="text-center p-4 bg-sky-50/50 border border-sky-100 rounded-xl">
                <div className="text-2xl font-bold text-sky-600">{stats.llm.summary.total_input_tokens?.toLocaleString()}</div>
                <div className="text-[10px] text-sky-600/80 font-bold uppercase tracking-widest mt-1">Input Tokens</div>
              </div>
              <div className="text-center p-4 bg-rose-50/50 border border-rose-100 rounded-xl">
                <div className="text-2xl font-bold text-rose-600">{stats.llm.summary.total_output_tokens?.toLocaleString()}</div>
                <div className="text-[10px] text-rose-600/80 font-bold uppercase tracking-widest mt-1">Output Tokens</div>
              </div>
            </div>
            
            <div className="h-48 w-full flex items-center justify-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={llmData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {llmData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '12px', fontWeight: 500, color: '#64748b'}} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-x-0 bottom-[95px] flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">Tokens</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Performance & Cost */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <h3 className="text-lg font-semibold mb-4 text-slate-800">Performance</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
              <div className="text-3xl font-bold text-cyan-600">{(stats.processing_time * 1000).toFixed(1)}<span className="text-lg text-cyan-500 font-medium">ms</span></div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Processing Time</div>
            </div>
            <div className="text-center p-4 bg-slate-50/50 border border-slate-100 rounded-xl">
              <div className={`text-3xl font-bold ${stats.cache_hit ? 'text-teal-600' : 'text-slate-400'}`}>
                {stats.cache_hit ? 'Yes' : 'No'}
              </div>
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Cache Hit</div>
            </div>
          </div>
        </div>

        {estimatedCost && (
          <div className="bg-white rounded-xl border p-6 flex flex-col justify-center items-center">
            <h3 className="text-lg font-semibold w-full text-left text-slate-800">Cost Estimate</h3>
            <div className="text-center mt-4 flex-grow flex flex-col justify-center">
              <div className="text-4xl font-black text-emerald-500 flex items-start justify-center">
                <span className="text-2xl mt-1 mr-1 text-emerald-600/70">$</span>
                {estimatedCost.total_cost_usd?.toFixed(5) || '0.00000'}
              </div>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-2">Total Cost (USD)</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsTab;