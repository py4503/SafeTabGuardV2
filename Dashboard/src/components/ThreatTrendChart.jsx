import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ThreatTrendChart({ data }) {
    
  if (!data || data.length === 0) return null;

  return (
    <div className="w-full h-full min-h-62.5">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          
          <XAxis 
            dataKey="date" 
            stroke="#64748b" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
            dy={10}
          />
          
          <YAxis 
            stroke="#64748b" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
            allowDecimals={false}
          />
          
          <Tooltip 
            cursor={{ fill: '#1e293b', opacity: 0.5 }}
            contentStyle={{ 
              backgroundColor: '#0f172a', 
              borderColor: '#1e293b', 
              borderRadius: '12px', 
              color: '#f8fafc',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
            }}
            itemStyle={{ color: '#22d3ee', fontWeight: 'bold' }}
          />
          
          {/* The Bar itself */}
          <Bar 
            dataKey="threats" 
            fill="#06b6d4" 
            radius={[6, 6, 0, 0]} 
            maxBarSize={50} 
          />
          
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}