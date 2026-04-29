import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, AlertTriangle, History, EyeOff, 
  BrainCircuit, Globe, Fingerprint, ExternalLink 
} from 'lucide-react';

function App() {
  // Main Engine State
  const [isEnabled, setIsEnabled] = useState(true);
  
  // V2 Feature States
  const [strictAiMode, setStrictAiMode] = useState(false);
  const [webrtcMasking, setWebrtcMasking] = useState(true);
  const [canvasNoise, setCanvasNoise] = useState(true);
  
  // Stats States
  const [blockedCount, setBlockedCount] = useState(0);
  const [lastBlocked, setLastBlocked] = useState(null);

  useEffect(() => {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(
        [
          'protectionEnabled', 'strictAiMode', 'webrtcMaskingEnabled', 
          'canvasNoiseEnabled', 'blockedStats', 'lastBlockedSite'
        ],
        (result) => {
          // Initialize states, falling back to defaults if not set yet
          if (result.protectionEnabled !== undefined) setIsEnabled(result.protectionEnabled);
          if (result.strictAiMode !== undefined) setStrictAiMode(result.strictAiMode);
          if (result.webrtcMaskingEnabled !== undefined) setWebrtcMasking(result.webrtcMaskingEnabled);
          if (result.canvasNoiseEnabled !== undefined) setCanvasNoise(result.canvasNoiseEnabled);

          // Handle Stats
          const stats = result.blockedStats;
          const today = new Date().toLocaleDateString();
          if (stats && stats.date === today) {
            setBlockedCount(stats.count);
          }
          if (result.lastBlockedSite) {
            setLastBlocked(result.lastBlockedSite);
          }
        }
      );
    }
  }, []);
  
  // Universal Toggle Handler (V2 with Backend Sync)
  const handleToggle = async (key, currentState, stateSetter) => {
    const newState = !currentState;
    
    // 1. Update UI instantly
    stateSetter(newState);
    
    if (chrome.storage && chrome.storage.local) {
      // 2. Save locally for the background scripts
      await chrome.storage.local.set({ [key]: newState });

      // 3. Sync to the MongoDB Backend
      chrome.storage.local.get(['mongoDeviceId'], async (data) => {
        if (!data.mongoDeviceId) {
          console.warn("[UI] No database ID found. Skipping cloud sync.");
          return;
        }

        try {
          const response = await fetch('https://safetabguardv2.onrender.com/api/devices/settings', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              deviceId: data.mongoDeviceId,
              [key]: newState // Dynamically updates strictAiMode, webrtcMaskingEnabled, etc.
            })
          });

          if (!response.ok) {
            console.error("[UI] Backend rejected the settings update.");
          } else {
            console.log(`[UI] Successfully synced ${key} to cloud.`);
          }
        } catch (error) {
          console.error("[UI] Network error syncing settings:", error);
        }
      });
    }
  };

  const openDashboard = () => {
    if (chrome.tabs) {
      chrome.tabs.create({ url: chrome.runtime.getURL("dashboard-build/index.html") });
    }
  };

  const getDomain = (url) => {
    try { return new URL(url).hostname; } catch (e) { return url; }
  };

  // Reusable UI Component for the new V2 features
  const FeatureToggle = ({ icon: Icon, title, desc, state, toggleKey, setter }) => (
    <div className="flex items-center justify-between py-3 border-b border-slate-700/50 last:border-0">
      <div className="flex items-center space-x-3">
        <Icon className={`w-5 h-5 ${state ? 'text-cyan-400' : 'text-slate-500'}`} />
        <div>
          <p className="text-sm font-semibold text-slate-200">{title}</p>
          <p className="text-xs text-slate-400">{desc}</p>
        </div>
      </div>
      <div
        onClick={() => handleToggle(toggleKey, state, setter)}
        className={`w-10 h-5 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${
          state ? 'bg-cyan-500' : 'bg-slate-600'
        }`}
      >
        <div className={`bg-white w-3 h-3 rounded-full shadow-md transform transition-transform duration-300 ${
            state ? 'translate-x-5' : 'translate-x-0'
        }`}></div>
      </div>
    </div>
  );

  return (
    <div className="w-80 p-4 bg-slate-900 text-slate-200 font-sans">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
  <div className="flex items-center space-x-2">
    <h1 className="text-xl font-bold tracking-wider bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
      SafeTabGuard
    </h1>
    {/* The V2 Badge */}
    <div className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
      <span className="text-[10px] font-black text-emerald-400 tracking-widest leading-none mt-[1px]">
        V2
      </span>
    </div>
  </div>
  {/* Added a subtle drop shadow to make the shield glow */}
  <ShieldCheck className="w-6 h-6 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
</div>

      {/* Main Master Switch */}
      <div className={`p-4 rounded-xl mb-4 border transition-all duration-300 ${
          isEnabled ? 'bg-slate-800 border-emerald-500/30 shadow-lg shadow-emerald-500/10' : 'bg-slate-800/50 border-slate-700'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {isEnabled ? (
              <ShieldCheck className="w-8 h-8 text-emerald-400 animate-pulse" />
            ) : (
              <AlertTriangle className="w-8 h-8 text-yellow-400" />
            )}
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Firewall Status</p>
              <p className={`text-lg font-bold ${isEnabled ? 'text-emerald-400' : 'text-yellow-400'}`}>
                {isEnabled ? 'Active & Scanning' : 'Protection Disabled'}
              </p>
            </div>
          </div>
          <div
            onClick={() => handleToggle('protectionEnabled', isEnabled, setIsEnabled)}
            className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${
              isEnabled ? 'bg-emerald-500' : 'bg-slate-600'
            }`}
          >
            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                isEnabled ? 'translate-x-6' : 'translate-x-0'
            }`}></div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex flex-col items-center justify-center text-center">
          <EyeOff className="w-5 h-5 text-emerald-400 mb-1" />
          <p className="text-2xl font-bold text-slate-100">{blockedCount}</p>
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Threats Today</p>
        </div>
        <div className="bg-slate-800 p-3 rounded-lg border border-slate-700 flex flex-col items-center justify-center text-center overflow-hidden">
          <History className="w-5 h-5 text-red-400 mb-1" />
          <p className="text-sm font-mono text-slate-200 truncate w-full" title={lastBlocked?.url || ''}>
            {lastBlocked ? getDomain(lastBlocked.url) : 'None'}
          </p>
          <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider mt-1">Last Blocked</p>
        </div>
      </div>

      {/* V2 Advanced Privacy Settings */}
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 mb-4">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 border-b border-slate-700 pb-2">
          Active Privacy Controls
        </h2>
        
        <FeatureToggle 
          icon={BrainCircuit} title="Deep AI Scan" desc="Force Gemini on every page"
          state={strictAiMode} toggleKey="strictAiMode" setter={setStrictAiMode} 
        />
        <FeatureToggle 
          icon={Globe} title="WebRTC Masking" desc="Prevent local IP leaks"
          state={webrtcMasking} toggleKey="webrtcMaskingEnabled" setter={setWebrtcMasking} 
        />
        <FeatureToggle 
          icon={Fingerprint} title="Canvas Noise" desc="Spoof hardware fingerprints"
          state={canvasNoise} toggleKey="canvasNoiseEnabled" setter={setCanvasNoise} 
        />
      </div>

      {/* Dashboard Launcher */}
      <button 
        onClick={openDashboard}
        className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white p-3 rounded-lg font-bold transition-all duration-200 shadow-lg shadow-cyan-900/20"
      >
        <span>Open Security Dashboard</span>
        <ExternalLink className="w-4 h-4" />
      </button>

    </div>
  );
}

export default App;