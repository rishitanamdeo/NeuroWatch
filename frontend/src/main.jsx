import React, { useState, useEffect } from 'react';

export default function App() {
  const [scenario, setScenario] = useState('Normal');
  const [data, setData] = useState({
    grid: Array(100).fill(0),
    risk: 10,
    count: 250
  });

  // Simulator running every 800ms
  useEffect(() => {
    const interval = setInterval(() => {
      const mult = scenario === 'Normal' ? 0.3 : scenario === 'Kumbh Surge' ? 0.7 : 1.0;
      
      setData({
        grid: Array.from({ length: 100 }, () => Math.random() * mult),
        risk: Math.floor(mult * 70 + Math.random() * 25),
        count: Math.floor(mult * 12000 + Math.random() * 2000)
      });
    }, 800);
    return () => clearInterval(interval);
  }, [scenario]);

  const getColor = (v) => {
    if (v < 0.3) return `rgba(59, 130, 246, ${v + 0.15})`;
    if (v < 0.7) return `rgba(245, 158, 11, ${v})`;
    return `rgba(239, 68, 68, ${v})`;
  };

  const statusColor = data.risk < 40 ? '#10b981' : data.risk < 75 ? '#f59e0b' : '#ef4444';

  return (
    <div style={{ background: '#0a0f1d', color: '#f8fafc', minHeight: '100vh', padding: '20px', fontFamily: 'monospace' }}>
      
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
        <h2 style={{ margin: 0, fontSize: '1.5rem' }}>NEUROWATCH // LIVE_FEED</h2>
        <div style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }}></span>
          ONLINE
        </div>
      </header>

      {/* Control Panel */}
      <div style={{ margin: '20px 0', padding: '15px', background: '#121829', borderRadius: '6px', border: '1px solid #1e293b' }}>
        <p style={{ margin: '0 0 10px 0', color: '#64748b' }}>SELECT SYSTEM OPERATIONAL SCENARIO:</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          {['Normal', 'Kumbh Surge', 'Crush Scenario'].map(m => (
            <button key={m} onClick={() => setScenario(m)} style={{
              padding: '8px 16px', background: scenario === m ? '#f8fafc' : '#1e293b',
              color: scenario === m ? '#0a0f1d' : '#f8fafc', border: 'none', fontWeight: 'bold', cursor: 'pointer', borderRadius: '4px'
            }}>{m.toUpperCase()}</button>
          ))}
        </div>
      </div>

      {/* Main Grid Setup */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        
        {/* Heatmap Grid */}
        <div style={{ background: '#121829', padding: '15px', borderRadius: '6px', border: '1px solid #1e293b' }}>
          <p style={{ color: '#64748b', margin: '0 0 10px 0' }}>SPATIAL DENSITY MATRIX (10x10)</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: '4px' }}>
            {data.grid.map((v, i) => (
              <div key={i} style={{
                aspectRatio: '1', backgroundColor: getColor(v), borderRadius: '2px', transition: 'all 0.3s',
                boxShadow: v > 0.7 ? '0 0 8px #ef4444' : 'none'
              }} />
            ))}
          </div>
        </div>

        {/* Risk Arc Gauge */}
        <div style={{ background: '#121829', padding: '15px', borderRadius: '6px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p style={{ color: '#64748b', margin: '0 0 20px 0', width: '100%' }}>CRITICAL RISK INDEX</p>
          <div style={{ position: 'relative', width: '130px', height: '130px' }}>
            <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="50" cy="50" r="40" fill="none" stroke="#1e293b" strokeWidth="10"/>
              <circle cx="50" cy="50" r="40" fill="none" stroke={statusColor} strokeWidth="10"
                      strokeDasharray="251.2" strokeDashoffset={251.2 - (Math.min(data.risk, 100) / 100) * 251.2} style={{ transition: 'stroke-dashoffset 0.4s' }}/>
            </svg>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '1.5rem', fontWeight: 'bold', color: statusColor }}>
              {data.risk}%
            </div>
          </div>
        </div>

        {/* Telemetry Readout */}
        <div style={{ background: '#121829', padding: '15px', borderRadius: '6px', border: '1px solid #1e293b' }}>
          <p style={{ color: '#64748b', margin: '0 0 15px 0' }}>METRICS TELEMETRY</p>
          <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '5px 0' }}>CURRENT MODE</p>
          <p style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: '0 0 15px 0' }}>{scenario}</p>
          <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '5px 0' }}>DENSITY TARGET COUNT</p>
          <p style={{ fontSize: '1.6rem', fontWeight: 'bold', color: '#f59e0b', margin: 0 }}>{data.count.toLocaleString()}</p>
        </div>

      </div>
    </div>
  );
}



