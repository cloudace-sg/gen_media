import React from 'react';
import { getBillingSummary, getBillingCredits, getRemainingCounts } from '../services/api';
import PageHeader from '../components/ui/PageHeader';
import { useAuth } from '../contexts/auth-context';

export default function BillingPage() {
  const { userRole } = useAuth();
  const [summary, setSummary] = React.useState(null);
  const [credits, setCredits] = React.useState(null);
  const [remaining, setRemaining] = React.useState(null);
  const [range, setRange] = React.useState('30d');
  const [loading, setLoading] = React.useState(false);
  const [chartView, setChartView] = React.useState('net'); // 'net' or 'gross'

  const load = React.useCallback(async () => {
    setLoading(true);
    console.log('Loading billing data...', { range });
    try {
      const params = new URLSearchParams();
      if (range) {
        params.set('range', range);
      }
      const summaryUrl = params.toString()
        ? `/api/billing/summary?${params.toString()}`
        : '/api/billing/summary';

      // Direct fetch instead of using API service to avoid dependency issues
      const [summaryResponse, creditsResponse, remainingResponse] = await Promise.all([
        fetch(summaryUrl),
        fetch('/api/billing/credits'),
        fetch('/api/billing/remaining')
      ]);
      
      if (!summaryResponse.ok) {
        throw new Error(`Summary API error: ${summaryResponse.status}`);
      }
      if (!creditsResponse.ok) {
        throw new Error(`Credits API error: ${creditsResponse.status}`);
      }
      if (!remainingResponse.ok) {
        throw new Error(`Remaining API error: ${remainingResponse.status}`);
      }
      
      const s = await summaryResponse.json();
      const c = await creditsResponse.json();
      const r = await remainingResponse.json();
      
      console.log('Billing data loaded:', { summary: s, credits: c, remaining: r });
      setSummary(s); setCredits(c); setRemaining(r);
    } catch (error) {
      console.error('Error loading billing data:', error);
      console.error('Error details:', error.message);
    } finally { setLoading(false); }
  }, [range]);

  React.useEffect(() => { load(); }, [load]);

  // Check if user is admin
  if (userRole !== 'admin') {
    return (
      <div className="max-w-7xl mx-auto px-6 py-6 md:px-8 md:py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-dark-text mb-4">Access Denied</h1>
          <p className="text-dark-text-secondary">
            You need administrator privileges to access the billing page.
          </p>
        </div>
      </div>
    );
  }

  const byDay = summary?.byDay || [];
  const hasData = summary?.hasData !== false && byDay.length > 0;
  const chartData = chartView === 'gross' ? byDay.map(d => d.cost || 0) : byDay.map(d => d.net || 0);
  const maxY = Math.max(1, ...chartData);

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 md:px-8 md:py-8 space-y-6">
      <PageHeader
        title="Billing"
        right={(
          <div className="flex gap-2">
            <button onClick={()=>setRange('7d')} className={`h-9 px-3 rounded-lg ${range==='7d'?'bg-accent text-white':'bg-dark-border text-dark-text hover:bg-gray-200'}`}>Last 7 days</button>
            <button onClick={()=>setRange('30d')} className={`h-9 px-3 rounded-lg ${range==='30d'?'bg-accent text-white':'bg-dark-border text-dark-text hover:bg-gray-200'}`}>Last 30 days</button>
          </div>
        )}
      />

      {/* Remaining counts - most prominent section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-dark-text">Generation Quota</h2>
          <div className="h-1 w-8 bg-accent rounded-full"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard 
            label="Images remaining" 
            value={remaining?.hasData === false ? 'No data' : (remaining?.imageRemaining !== null && remaining?.imageRemaining !== undefined ? `${remaining.imageRemaining}` : '—')} 
            loading={loading} 
            highlighted 
            large 
          />
          <StatCard 
            label="Videos remaining" 
            value={remaining?.hasData === false ? 'No data' : (remaining?.videoRemaining !== null && remaining?.videoRemaining !== undefined ? `${remaining.videoRemaining}` : '—')} 
            loading={loading} 
            highlighted 
            large 
          />
        </div>
      </div>

      {/* Billing summary */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-dark-text">Billing Summary</h2>
          <div className="h-1 w-8 bg-gray-400 rounded-full"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard 
            label="Total charges" 
            value={!hasData && (summary?.hasData === false || credits?.hasData === false) ? 'No data' : `$${(credits?.charges || summary?.totalCost || 0).toFixed(2)}`} 
            loading={loading} 
          />
          <StatCard 
            label="Applied credits" 
            value={!hasData && (summary?.hasData === false || credits?.hasData === false) ? 'No data' : `$${(credits?.creditsApplied || Math.abs(summary?.totalCredits || 0)).toFixed(2)}`} 
            loading={loading} 
          />
          <StatCard 
            label="Net uncovered" 
            value={!hasData && (summary?.hasData === false || credits?.hasData === false) ? 'No data' : `$${(credits?.net || summary?.netCost || 0).toFixed(2)}`} 
            loading={loading} 
          />
        </div>
      </div>

      <div className="rounded-2xl border border-dark-border bg-dark-bg p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-dark-text">Spending over time</h2>
          <div className="flex gap-2">
            <button onClick={()=>setChartView('gross')} className={`h-8 px-3 rounded-lg text-xs ${chartView==='gross'?'bg-accent text-white':'bg-dark-border text-dark-text hover:bg-gray-200'}`}>Gross</button>
            <button onClick={()=>setChartView('net')} className={`h-8 px-3 rounded-lg text-xs ${chartView==='net'?'bg-accent text-white':'bg-dark-border text-dark-text hover:bg-gray-200'}`}>Net</button>
          </div>
        </div>
        <div className="h-56 w-full">
          {!hasData ? (
            <div className="h-full flex items-center justify-center text-dark-text-secondary text-sm">No data</div>
          ) : (
            <MiniArea data={chartData} labels={byDay.map(d=>d.date)} maxY={maxY} showYAxis showTooltip />
          )}
        </div>
        <div className="mt-3 text-xs text-dark-text-secondary">
          {!hasData ? (
            'No billing data available'
          ) : (
            <>
              Range: {summary?.start} → {summary?.end} {summary?.configured === false && '(Billing export not configured)'} {chartView==='gross'?'(before credits)':'(after credits)'}
            </>
          )}
        </div>
      </div>

      {credits?.creditsByProgram?.length > 0 && (
        <div className="rounded-2xl border border-dark-border bg-dark-bg p-4">
          <h2 className="text-sm font-medium text-dark-text mb-3">Credit grants usage</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-dark-border text-dark-text">
                <tr>
                  <th className="text-left px-4 py-2">Credit</th>
                  <th className="text-right px-4 py-2">Applied</th>
                  <th className="text-right px-4 py-2">First used</th>
                  <th className="text-right px-4 py-2">Last used</th>
                </tr>
              </thead>
              <tbody>
                {credits.creditsByProgram.map((g) => (
                  <tr key={g.id} className="border-t border-dark-border">
                    <td className="px-4 py-2 text-dark-text-secondary">{g.name || g.id}</td>
                    <td className="px-4 py-2 text-right text-dark-text">${g.applied.toFixed(2)}</td>
                    <td className="px-4 py-2 text-right text-dark-text">{g.firstDate ? (g.firstDate.value || g.firstDate) : '—'}</td>
                    <td className="px-4 py-2 text-right text-dark-text">{g.lastDate ? (g.lastDate.value || g.lastDate) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-xs text-dark-text-secondary">
            Shows applied amounts from invoices; total grant values are not exposed by the export.
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-dark-border bg-dark-bg p-0 overflow-hidden">
        {!hasData ? (
          <div className="p-8 text-center text-dark-text-secondary">
            <p className="text-sm">No billing data available</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-dark-border text-dark-text">
              <tr>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-right px-4 py-2">Cost</th>
                <th className="text-right px-4 py-2">Credits</th>
                <th className="text-right px-4 py-2">Net</th>
              </tr>
            </thead>
            <tbody>
              {byDay.map((r)=> (
                <tr key={r.date} className="border-t border-dark-border">
                  <td className="px-4 py-2 text-dark-text-secondary">{r.date}</td>
                  <td className="px-4 py-2 text-right text-dark-text">${(r.cost || 0).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-dark-text">${Math.abs(r.credits || 0).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right font-medium text-dark-text">${(r.net || 0).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, loading, highlighted = false, large = false }) {
  return (
    <div className={`rounded-2xl border p-4 ${highlighted ? 'border-accent bg-accent/5' : 'border-dark-border bg-dark-bg'} ${large ? 'p-6' : ''}`}>
      <div className={`text-dark-text-secondary ${large ? 'text-sm font-medium' : 'text-xs'}`}>{label}</div>
      <div className={`font-semibold text-dark-text mt-1 ${large ? 'text-4xl' : 'text-2xl'}`}>{loading ? '—' : value}</div>
    </div>
  );
}

function MiniArea({ data = [], labels = [], maxY = 1, showYAxis = false, showTooltip = false }) {
  const [hi, setHi] = React.useState(null);
  const wrapperRef = React.useRef(null);
  const svgRef = React.useRef(null);
  const tipRef = React.useRef(null);
  const [tipW, setTipW] = React.useState(80);
  React.useLayoutEffect(() => { if (tipRef.current) setTipW(tipRef.current.offsetWidth || 80); }, [hi]);

  const w = 820, h = 220, pad = 24, yPad = showYAxis ? 28 : 0;
  const xs = (i) => pad + yPad + (i * (w - 2*pad - yPad)) / Math.max(1, data.length - 1);
  const ys = (v) => h - pad - (v * (h - 2*pad)) / maxY;

  // Tooltip left (px) using the SVG's actual screen transform
  const tooltipLeftPx = React.useMemo(() => {
    if (hi == null || !wrapperRef.current || !svgRef.current) return 0;
    const rect = wrapperRef.current.getBoundingClientRect();
    const svg = svgRef.current;
    const ctm = svg.getScreenCTM();
    if (!ctm) return 0;

    // helper: map viewBox X to pixels relative to wrapper's left
    const toPx = (xView) => (xView * ctm.a + ctm.e) - rect.left;

    const centerPx = toPx(xs(hi));
    const innerLeftPx  = toPx(pad + yPad);
    const innerRightPx = toPx(w - pad);

    const half = (tipW || 80) / 2;
    return Math.max(innerLeftPx + half + 2, Math.min(innerRightPx - half - 2, centerPx));
  }, [hi, tipW, pad, yPad, w]);

  if (!data.length) return <div className="h-full flex items-center justify-center text-dark-text-secondary text-sm">No data</div>;

  const path = data.map((v,i)=>`${i===0?'M':'L'} ${xs(i)} ${ys(v)}`).join(' ');
  const fillPath = `${path} L ${xs(data.length-1)} ${h-pad} L ${xs(0)} ${h-pad} Z`;

  // Calculate hover zones - each data point gets a zone around it
  const hoverZones = data.map((_, i) => {
    const centerX = xs(i);
    const nextX = i < data.length - 1 ? xs(i + 1) : w - pad;
    const prevX = i > 0 ? xs(i - 1) : pad + yPad;
    // Symmetric zones: midpoint between prev-center and center-next
    const leftMid = i > 0 ? (prevX + centerX) / 2 : pad + yPad;
    const rightMid = i < data.length - 1 ? (centerX + nextX) / 2 : w - pad;
    const zoneLeft = Math.max(pad + yPad, leftMid);
    const zoneRight = Math.min(w - pad, rightMid);
    return { left: zoneLeft, right: zoneRight, centerX, index: i };
  });

  return (
    <div className="relative w-full h-full" ref={wrapperRef}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full" ref={svgRef}>
        {showYAxis && (
          <g>
            <text x={pad} y={ys(0)} fontSize="10" className="fill-current text-dark-text-secondary">$0</text>
            <text x={pad} y={ys(maxY)} fontSize="10" className="fill-current text-dark-text-secondary">${`$${maxY.toFixed(0)}`}</text>
          </g>
        )}
        <path d={fillPath} fill="rgba(234, 179, 8, 0.2)" />
        <path d={path} stroke="rgb(234,179,8)" strokeWidth="2" fill="none" />
        {labels.map((l, i) => (i % Math.ceil(labels.length/6) === 0) ? (
          <text key={l} x={xs(i)} y={h-6} fontSize="10" textAnchor="middle" className="fill-current text-dark-text-secondary">{String(l || '').slice(5)}</text>
        ) : null)}

        {/* Invisible hover zones */}
        {showTooltip && hoverZones.map((zone) => (
          <rect
            key={zone.index}
            x={zone.left}
            y={pad}
            width={zone.right - zone.left}
            height={h - 2*pad}
            fill="transparent"
            onMouseEnter={() => setHi(zone.index)}
            onMouseLeave={() => setHi(null)}
            style={{ cursor: 'pointer' }}
          />
        ))}

        {/* Highlight for active point */}
        {showTooltip && hi != null && (
          <g>
            <line x1={xs(hi)} x2={xs(hi)} y1={pad} y2={h-pad} stroke="rgba(0,0,0,0.2)" />
            <circle cx={xs(hi)} cy={ys(data[hi])} r="3" fill="rgb(234,179,8)" stroke="white" />
          </g>
        )}
      </svg>

      {/* Tooltip positioned above the chart */}
      {showTooltip && hi != null && (
        <div ref={tipRef} className="absolute bg-white/95 text-xs text-dark-text border border-dark-border rounded px-2 py-1 pointer-events-none z-10"
             style={{
               left: `${tooltipLeftPx}px`,
               top: 4,
               transform: 'translateX(-50%)'
             }}>
          <div>{labels[hi]}</div>
          <div className="font-semibold">${(data[hi] || 0).toFixed(2)}</div>
        </div>
      )}
    </div>
  );
}
