import React from 'react';

const StatCard = ({ title, value, icon: Icon, colorClass, trend }) => {
  return (
    <div className="group bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 p-5 rounded-3xl flex flex-col shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:border-slate-600/80 min-h-35">
      
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-wide leading-snug mt-1">
          {title}
        </p>
        
        <div className={`p-2.5 rounded-xl bg-slate-900/50 border shrink-0 transition-colors group-hover:bg-slate-800/80 ${colorClass}`}>
          <Icon className="w-5 h-5" /> 
        </div>
      </div>

      {/* Bottom Row: Value & Trend */}
      <div className="flex items-center gap-3 mt-auto pt-4">
        <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight drop-shadow-sm leading-none">
          {value}
        </h3>
        
        {trend && (
          <span className="text-[10px] sm:text-xs text-emerald-400 font-bold tracking-wide bg-emerald-400/10 border border-emerald-400/20 px-2 py-0.5 rounded-md shadow-inner transform -translate-y-0.5">
            {trend}
          </span>
        )}
      </div>
      
    </div>
  );
};

export default StatCard;