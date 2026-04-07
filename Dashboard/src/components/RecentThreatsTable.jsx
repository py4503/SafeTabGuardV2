import React from 'react';
import { ShieldAlert, Fingerprint, Bug } from 'lucide-react';

const RecentThreatsTable = ({ logs }) => {
  if (!logs || logs.length === 0) {
    return <div className="text-center py-10 text-slate-500">No recent threats detected. Your browsing is secure.</div>;
  }
  const getThreatIcon = (type) => {
    switch(type) {
      case 'Phishing': return <ShieldAlert className="w-5 h-5 text-red-400" />;
      case 'Tracker': return <Fingerprint className="w-5 h-5 text-cyan-400" />;
      default: return <Bug className="w-5 h-5 text-yellow-400" />;
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-700/50 text-sm text-slate-400 uppercase tracking-wider">
            <th className="p-4 font-medium">Time</th>
            <th className="p-4 font-medium">Threat Type</th>
            <th className="p-4 font-medium">Target URL</th>
            <th className="p-4 font-medium">Action Taken</th>
            <th className="p-4 font-medium">Risk Score</th>
          </tr>
        </thead>
        <tbody className="text-slate-300 text-sm">
          {logs.map((log) => (
            <tr key={log._id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
              <td className="p-4 whitespace-nowrap text-slate-500">
                {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </td>
              <td className="p-4">
                <div className="flex items-center space-x-2">
                  {getThreatIcon(log.recordedThreatType)}
                  <span className="font-medium">{log.recordedThreatType || 'Unknown'}</span>
                </div>
              </td>
              <td className="p-4 max-w-xs truncate text-slate-400" title={log.threatId?.url}>
                {log.threatId?.url || 'Internal Request'}
              </td>
              <td className="p-4">
                <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded text-xs font-semibold tracking-wide">
                  {log.actionTaken}
                </span>
              </td>
              <td className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div 
                      className="bg-red-500 h-1.5 rounded-full" 
                      style={{ width: `${log.threatId?.score || 0}%` }}
                    ></div>
                  </div>
                  <span className="text-xs font-mono">{log.threatId?.score || 0}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RecentThreatsTable;