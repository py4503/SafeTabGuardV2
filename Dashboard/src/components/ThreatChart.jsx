import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// V2 Feature: Dynamic Color Palette for AI Categories
// The chart will cycle through these colors for however many categories the AI finds
const COLORS = [
  '#ef4444', // Red (High Risk)
  '#a855f7', // Purple
  '#f59e0b', // Amber 
  '#06b6d4', // Cyan 
  '#10b981', // Emerald 
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#f97316'  // Orange
];

// Changed prop to accept our dynamically grouped array
const ThreatChart = ({ dynamicThreatData }) => { 
  
  // Hide chart if no data yet or if it's completely empty
  if (!dynamicThreatData || dynamicThreatData.length === 0 || dynamicThreatData.every(d => d.value === 0)) {
    return <div className="h-64 flex items-center justify-center text-slate-500">Awaiting Threat Data...</div>;
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={dynamicThreatData}
            cx="50%"
            cy="50%"
            innerRadius={80}
            outerRadius={110}
            paddingAngle={5}
            dataKey="value"
            nameKey="name"
            stroke="none"
          >
            {/* Dynamically assign colors based on the index */}
            {dynamicThreatData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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