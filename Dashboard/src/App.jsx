import React, { useState, useEffect } from 'react';
import { Activity, ShieldBan, Fingerprint, GlobeLock, RefreshCcw, Bug } from 'lucide-react';
import StatCard from './components/StatCard';
import ThreatChart from './components/ThreatChart';
import RecentThreatsTable from './components/RecentThreatsTable';
import ThreatTrendChart from './components/ThreatTrendChart';

// --- MOCK DATA FOR UI TESTING ---

// export const mockSummaryData = {
//   totalThreatsMitigated: 1428,
//   trackersBlocked: 942,
//   phishingPrevented: 47,
//   malwareStopped: 12,
//   webrtcLeaksMasked: 427,
  
//   // The perfectly formatted 7-day trend (Notice the 0-day to test your chart!)
//   weeklyTrend: [
//     { date: "Apr 01", threats: 145 },
//     { date: "Apr 02", threats: 189 },
//     { date: "Apr 03", threats: 214 },
//     { date: "Apr 04", threats: 0 },   // Simulates a day the user didn't open Chrome
//     { date: "Apr 05", threats: 412 }, // Simulates a huge spike (maybe visited a sketchy site)
//     { date: "Apr 06", threats: 290 },
//     { date: "Apr 07", threats: 178 }
//   ]
// };

// export const mockRecentLogs = [
//   {
//     _id: "65a1b2c3d4e5f6a7b8c9d0e1",
//     eventType: "Network_Request_Blocked",
//     actionTaken: "Blocked",
//     recordedThreatType: "Malware",
//     createdAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(), // 2 mins ago
//     threatId: {
//       url: "https://freedownload-movies-hd-1080p.sketchysite.ru/payload.exe",
//       threatType: "Malware",
//       score: 98
//     }
//   },
//   {
//     _id: "65a1b2c3d4e5f6a7b8c9d0e2",
//     eventType: "Network_Request_Blocked",
//     actionTaken: "Blocked",
//     recordedThreatType: "Phishing",
//     createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(), // 15 mins ago
//     threatId: {
//       url: "http://secure-update-paypal-billing-auth.com/login",
//       threatType: "Phishing",
//       score: 95
//     }
//   },
//   {
//     _id: "65a1b2c3d4e5f6a7b8c9d0e3",
//     eventType: "WebRTC_Masked",
//     actionTaken: "IP Masked",
//     recordedThreatType: "Tracker",
//     createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago
//     threatId: {
//       url: "https://omegle-clone-chat.tv/room/1a2b3c",
//       threatType: "Tracker",
//       score: 65
//     }
//   },
//   {
//     _id: "65a1b2c3d4e5f6a7b8c9d0e4",
//     eventType: "Network_Request_Blocked",
//     actionTaken: "Blocked",
//     recordedThreatType: "Tracker",
//     createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
//     threatId: {
//       url: "https://connect.facebook.net/en_US/fbevents.js",
//       threatType: "Tracker",
//       score: 80
//     }
//   },
//   {
//     _id: "65a1b2c3d4e5f6a7b8c9d0e5",
//     eventType: "Canvas_Poisoned",
//     actionTaken: "Fingerprint Randomized",
//     recordedThreatType: "Tracker",
//     createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(), // 3 hours ago
//     threatId: {
//       url: "https://fingerprintjs.com/demo/",
//       threatType: "Tracker",
//       score: 85
//     }
//   },
//   {
//     _id: "65a1b2c3d4e5f6a7b8c9d0e6",
//     eventType: "Network_Request_Blocked",
//     actionTaken: "Blocked",
//     recordedThreatType: "Suspicious",
//     createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 hours ago
//     threatId: {
//       // Testing a super long URL to ensure your UI truncates it properly!
//       url: "https://ad-delivery-network.metrics.com/v1/track?user_id=89123&session=abc&ref=google",
//       threatType: "Tracker", 
//       score: 45
//     }
//   }
// ];

function App() {
  const [summary, setSummary] = useState(null);
  const [recentLogs, setRecentLogs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. SAFETY CHECK: Ensure Chrome API exists before calling it to prevent minified crashes
      if (!window.chrome || !window.chrome.storage || !window.chrome.storage.local) {
        throw new Error("Chrome Storage API not ready. Are you running this inside the extension?");
      }

      // 2. Ask Chrome for the user's specific Database ID
      const data = await new Promise((resolve) => {
          window.chrome.storage.local.get(['mongoDeviceId'], resolve);
      });
      
      const deviceId = data.mongoDeviceId;

      if (!deviceId) {
        throw new Error("Device not synced with backend yet. Please refresh the extension.");
      }

      // 3. Pass the deviceId in the URL
      const [summaryRes, logsRes] = await Promise.all([
        fetch(`http://localhost:5000/api/analytics/summary?deviceId=${deviceId}`),
        fetch(`http://localhost:5000/api/analytics/recent?deviceId=${deviceId}`)
      ]);

      if (!summaryRes.ok || !logsRes.ok) {
         throw new Error('Backend server rejected the request.');
      }

      setSummary(await summaryRes.json());
      setRecentLogs(await logsRes.json());
    } catch (err) {
      console.error("Dashboard Fetch Error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="min-h-screen w-full bg-slate-950 bg-[radial-gradient(ellipse_at_top,var(--tw-gradient-stops))] from-slate-900 via-[#020617] to-black text-slate-200 font-sans selection:bg-cyan-500/30 flex justify-center">
      
      {/* The Fluid Container */}
      <div className="w-[92%] max-w-6xl py-8 md:py-10 flex flex-col">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 pb-6 border-b border-slate-800/80">
          <div className="flex items-center gap-4 md:gap-5">
            <div className="p-3 md:p-3.5 bg-linear-to-br from-emerald-500 to-cyan-600 rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.2)] shrink-0">
              <Activity className="w-7 h-7 md:w-8 md:h-8 text-white" />
            </div>
            
            <div className="flex flex-col">
              <div className="flex flex-wrap items-center gap-2.5 mb-1">
                <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
                  SafeTabGuard
                </h1>
                <div className="px-2 py-1 rounded-md bg-cyan-500/10 border border-cyan-500/30 shadow-inner">
                  <span className="text-xs font-black text-cyan-400 tracking-widest uppercase block mt-px transform scale-[0.85] origin-left sm:scale-100">
                    V2 Analytics
                  </span>
                </div>
              </div>
              <p className="text-slate-400 text-sm md:text-base font-medium tracking-wide">
                Enterprise-Grade Threat Intelligence
              </p>
            </div>
          </div>
          
          <button 
            onClick={fetchDashboardData}
            disabled={loading}
            className="group flex items-center justify-center gap-2 px-6 py-3 bg-slate-800/50 hover:bg-slate-700/80 border border-slate-600/50 rounded-xl transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] hover:-translate-y-0.5 active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none w-full md:w-auto backdrop-blur-md"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : 'text-slate-300 group-hover:text-white transition-colors'}`} />
            <span className="text-sm font-bold tracking-wide text-white">Sync Data</span>
          </button>
        </header>

        {/* Error State */}
        {error ? (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-5 rounded-2xl flex items-center justify-center mb-8 backdrop-blur-md shadow-xl shadow-red-500/5">
            <p className="font-medium flex items-center space-x-3">
              <Bug className="w-6 h-6 shrink-0" />
              <span>Database Connection Error: {error}. Is your backend server running?</span>
            </p>
          </div>
        ) : (
          <>
            {/* Top Row: Hero Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 lg:gap-6 mb-8">
              <StatCard title="Total Interventions" value={summary?.totalThreatsMitigated || 0} icon={ShieldBan} colorClass="border-slate-700/80 text-slate-300" trend="+Active" />
              <StatCard title="Trackers Blocked" value={summary?.trackersBlocked || 0} icon={Fingerprint} colorClass="border-cyan-500/30 text-cyan-400" />
              <StatCard title="Phishing Stopped" value={summary?.phishingPrevented || 0} icon={Activity} colorClass="border-red-500/30 text-red-400" />
              <StatCard title="Malware Stopped" value={summary?.malwareStopped || 0} icon={Bug} colorClass="border-purple-500/30 text-purple-400" />
              <StatCard title="IP Leaks Masked" value={summary?.webrtcLeaksMasked || 0} icon={GlobeLock} colorClass="border-emerald-500/30 text-emerald-400" />
            </div>

            {/* ---> NEW MIDDLE ROW: 7-Day Trend Chart <--- */}
            <div className="bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-2xl mb-8 flex flex-col min-h-87.5 transition-all hover:bg-slate-800/40">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white/90 flex items-center tracking-wider uppercase">
                  7-Day Threat Activity
                </h2>
                {/* A cool pulsing live-status badge for extra polish */}
                <div className="flex items-center gap-2 text-[10px] sm:text-xs font-bold text-cyan-400 bg-cyan-400/10 px-3 py-1.5 rounded-lg border border-cyan-400/20 shadow-inner tracking-wide uppercase">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                  </span>
                  Trailing 7 Days
                </div>
              </div>
              
              {/* The Chart Container */}
              <div className="flex-1 w-full">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-slate-500 animate-pulse font-medium tracking-wide">Calculating trend data...</div>
                ) : (
                  <ThreatTrendChart data={summary?.weeklyTrend} />
                )}
              </div>
            </div>

            {/* Bottom Row: Charts and Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6">
              
              {/* Pie Chart Section */}
              <div className="bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-6 shadow-2xl lg:col-span-1 flex flex-col min-h-112.5 transition-all hover:bg-slate-800/40">
                <h2 className="text-lg font-bold text-white/90 mb-6 flex items-center tracking-wider uppercase">
                  Threat Distribution
                </h2>
                <div className="flex-1 flex items-center justify-center">
                  {loading ? (
                    <div className="text-slate-500 animate-pulse font-medium tracking-wide">Loading engine data...</div>
                  ) : (
                    <ThreatChart summaryData={summary} />
                  )}
                </div>
              </div>

              {/* Table Section */}
              <div className="bg-slate-800/30 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-0 shadow-2xl lg:col-span-2 flex flex-col min-h-112.5 overflow-hidden transition-all hover:bg-slate-800/40">
                <div className="p-6 pb-5 border-b border-slate-700/50 bg-slate-800/20">
                  <h2 className="text-lg font-bold text-white/90 flex items-center tracking-wider uppercase">
                    Live Intelligence Feed
                  </h2>
                </div>
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                  {loading ? (
                    <div className="h-full flex items-center justify-center text-slate-500 animate-pulse font-medium tracking-wide">Retrieving telemetry logs...</div>
                  ) : (
                    <RecentThreatsTable logs={recentLogs} />
                  )}
                </div>
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;