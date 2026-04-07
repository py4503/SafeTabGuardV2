import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const ThreatChart = ({ summaryData }) => {
  const data = [
    { name: 'Trackers Blocked', value: summaryData?.trackersBlocked || 0, color: '#06b6d4' }, // Cyan
    { name: 'Malware Stopped', value: summaryData?.malwareStopped || 0, color: '#a855f7' },
    { name: 'Phishing Prevented', value: summaryData?.phishingPrevented || 0, color: '#ef4444' }, // Red
    { name: 'IP Leaks Masked', value: summaryData?.webrtcLeaksMasked || 0, color: '#10b981' }, // Emerald
  ];

  // Hide chart if no data yet
  if (data.every(d => d.value === 0)) {
    return <div className="h-64 flex items-center justify-center text-slate-500">Awaiting Threat Data...</div>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={80}
            outerRadius={110}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }}
            itemStyle={{ color: '#f8fafc' }}
          />
          <Legend verticalAlign="bottom" height={36} wrapperStyle={{ paddingTop: '20px' }}/>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ThreatChart;