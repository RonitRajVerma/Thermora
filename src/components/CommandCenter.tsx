import React, { useState, useEffect } from "react";
import { useTelemetry } from "../hooks/useTelemetry";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ComposedChart, Bar } from 'recharts';
import { calculateHybridRecovery, calculateITEnergy, calculateThermalEnergy } from "../lib/engineering";
import { motion } from "motion/react";
import { Cpu, Droplets, ThermometerSun, Activity, Server, ArrowRight } from "lucide-react";
import { format } from "date-fns";

export function CommandCenter() {
  const { telemetry, connected } = useTelemetry();
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/telemetry/history')
      .then(res => res.json())
      .then(data => setHistory(data.slice(-100))) // keep last 100
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (telemetry) {
      setHistory(prev => [...prev.slice(-99), telemetry]);
    }
  }, [telemetry]);

  const tHot = telemetry?.hotTemperature || 45;
  const tCold = telemetry?.coldTemperature || 20;
  
  const itLoadMW = (tHot / 50) * 10; 
  const thermalEnergy = calculateThermalEnergy(calculateITEnergy(itLoadMW, 80, 1)); 
  
  const hybridResult = calculateHybridRecovery(1000, 0.45, tHot, tCold, 35000, 3.5, 10);
  const totalRecoveryPercent = (hybridResult.totalWaterLph / hybridResult.feedLph) * 100;
  const roRecoveryPercent = (hybridResult.roWaterLph / hybridResult.feedLph) * 100;
  
  const modeStatus = connected && telemetry?.mode !== "SIMULATED" ? "MEASURED" : "SIMULATED";
  const systemHealth = connected ? 98 : 0;

  // Build chart data
  const chartData = history.map(h => {
    const tempLoad = (h.hotTemperature / 50) * 10;
    const tempThermal = calculateThermalEnergy(calculateITEnergy(tempLoad, 80, 1));
    const tempHybrid = calculateHybridRecovery(1000, 0.45, h.hotTemperature, h.coldTemperature, 35000, 3.5, 10);
    return {
      time: h.timestamp,
      hotTemperature: h.hotTemperature,
      coldTemperature: h.coldTemperature,
      ambientTemperature: h.ambientTemperature,
      thermalOutput: tempThermal,
      recoveredHeat: tempThermal * 0.72, // assuming 72% recovery efficiency
      roWater: tempHybrid.roWaterLph,
      mdWater: tempHybrid.mdWaterLph,
      totalWater: tempHybrid.totalWaterLph
    }
  });

  return (
    <div className="flex flex-col h-full bg-[#030303] text-gray-300 relative overflow-y-auto overflow-x-hidden p-6 space-y-6">
      {/* Background Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-20 z-0" 
           style={{ backgroundImage: 'linear-gradient(to right, #1a1a1a 1px, transparent 1px), linear-gradient(to bottom, #1a1a1a 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>

      {/* HEADER */}
      <header className="flex items-end justify-between border-b border-gray-800 pb-4 relative z-10 shrink-0">
        <div>
          <h1 className="text-2xl font-light text-white tracking-[0.2em] mb-1">THERMORA</h1>
          <div className="flex items-center gap-3">
            <h2 className="text-sm text-gray-500 font-mono tracking-widest uppercase">Command Center</h2>
            <div className="h-3 w-px bg-gray-700"></div>
            <h2 className="text-sm text-gray-400 font-mono tracking-widest uppercase">Live System Status</h2>
          </div>
        </div>
        
        {/* Compact Status */}
        <div className="flex gap-6 items-center">
          <StatusItem label="EDGE NODE" value={connected ? (telemetry?.mode !== "SIMULATED" ? "ONLINE" : "SIMULATED") : "OFFLINE"} color={connected ? "text-cyan-400" : "text-red-500"} pulse={connected} />
          <StatusItem label="DATA SOURCE" value={modeStatus} color={modeStatus === 'MEASURED' ? "text-green-500" : "text-amber-500"} />
          <StatusItem label="MODEL" value="HYBRID-v0.1" color="text-gray-400" />
        </div>
      </header>

      {/* TOP SECTION: Flow + Gauges */}
      <div className="flex gap-6 relative z-10 shrink-0 h-[450px]">
        {/* Animated Process Flow */}
        <div className="flex-[2] bg-[#080808] border border-gray-800 rounded-sm relative overflow-hidden flex flex-col">
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <Activity size={14} className="text-cyan-500" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-gray-500">Mass Flow & Energy Conversion Topology</span>
          </div>
          <div className="flex-1 flex items-center justify-center p-8 mt-4">
            <ProcessFlowVisualization itLoad={itLoadMW} thermal={thermalEnergy} mdWater={hybridResult.mdWaterLph} roWater={hybridResult.roWaterLph} />
          </div>
        </div>

        {/* Gauges Grid */}
        <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-4">
          <GaugeCard title="THERMAL RECOVERY" value={72} min={0} max={100} unit="%" classification={modeStatus} color="#ef4444" />
          <GaugeCard title="RO RECOVERY" value={roRecoveryPercent} min={0} max={100} unit="%" classification={modeStatus} color="#3b82f6" />
          <GaugeCard title="MD CONTRIBUTION" value={hybridResult.mdWaterLph} min={0} max={500} unit="L/h" classification={modeStatus} color="#06b6d4" />
          <GaugeCard title="SYSTEM HEALTH" value={systemHealth} min={0} max={100} unit="%" classification="MEASURED" color="#10b981" />
        </div>
      </div>

      {/* METRICS STRIP */}
      <div className="flex gap-6 relative z-10 shrink-0">
        <MetricStripItem title="IT LOAD" value={itLoadMW.toFixed(2)} unit="MW" classification={modeStatus} />
        <MetricStripItem title="THERMAL OUTPUT" value={thermalEnergy.toFixed(2)} unit="MWt" classification={modeStatus} />
        <MetricStripItem title="WATER RECOVERY" value={hybridResult.totalWaterLph.toFixed(0)} unit="L/h" classification={modeStatus} highlight />
        <MetricStripItem title="MD FLUX" value={hybridResult.mdFlux.toFixed(1)} unit="kg/m²·h" classification={modeStatus} />
      </div>

      {/* CHARTS SECTION */}
      <div className="grid grid-cols-3 gap-6 relative z-10 h-72 shrink-0">
        {/* Thermal Recovery Chart */}
        <div className="bg-[#080808] border border-gray-800 rounded-sm p-4 flex flex-col">
          <h3 className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-4">Thermal Recovery — Last 24 Hours</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRecov" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis stroke="#444" tick={{fontSize: 10, fill: '#666', fontFamily: 'monospace'}} tickFormatter={(v) => v.toFixed(1)} />
                <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333', fontSize: '11px', fontFamily: 'monospace' }} itemStyle={{ color: '#ccc' }} labelFormatter={() => ''} />
                <Area type="monotone" dataKey="recoveredHeat" name="Recovered Heat (MWt)" stroke="#ef4444" fillOpacity={1} fill="url(#colorRecov)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Water Recovery Chart */}
        <div className="bg-[#080808] border border-gray-800 rounded-sm p-4 flex flex-col">
          <h3 className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-4">Water Recovery — Last 24 Hours</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis stroke="#444" tick={{fontSize: 10, fill: '#666', fontFamily: 'monospace'}} />
                <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333', fontSize: '11px', fontFamily: 'monospace' }} itemStyle={{ color: '#ccc' }} labelFormatter={() => ''} />
                <Area type="monotone" dataKey="roWater" stackId="a" name="RO Contribution (L/h)" fill="#1e3a8a" stroke="#3b82f6" isAnimationActive={false} />
                <Area type="monotone" dataKey="mdWater" stackId="a" name="MD Contribution (L/h)" fill="#083344" stroke="#06b6d4" isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Live Thermal Chart */}
        <div className="bg-[#080808] border border-gray-800 rounded-sm p-4 flex flex-col">
          <h3 className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-4">Live Thermal Telemetry</h3>
          <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis stroke="#444" tick={{fontSize: 10, fill: '#666', fontFamily: 'monospace'}} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ backgroundColor: '#111', borderColor: '#333', fontSize: '11px', fontFamily: 'monospace' }} itemStyle={{ color: '#ccc' }} labelFormatter={(t) => t ? format(new Date(t), 'HH:mm:ss') : ''} />
                <Line type="monotone" dataKey="hotTemperature" name="Hot Side (°C)" stroke="#ef4444" dot={false} isAnimationActive={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="coldTemperature" name="Cold Side (°C)" stroke="#3b82f6" dot={false} isAnimationActive={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="ambientTemperature" name="Ambient (°C)" stroke="#9ca3af" dot={false} isAnimationActive={false} strokeWidth={1} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// Subcomponents

function StatusItem({ label, value, color, pulse }: { label: string, value: string, color: string, pulse?: boolean }) {
  return (
    <div className="flex flex-col items-end">
      <span className="text-[9px] font-mono text-gray-500 uppercase tracking-widest mb-1">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-mono font-bold tracking-widest uppercase ${color}`}>{value}</span>
        {pulse && (
          <motion.div 
            className={`w-1.5 h-1.5 rounded-full bg-current ${color}`}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>
    </div>
  );
}

function MetricStripItem({ title, value, unit, classification, highlight }: any) {
  return (
    <div className="flex-1 bg-[#080808] border border-gray-800 rounded-sm p-5 flex flex-col justify-between">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">{title}</h3>
        <span className={`text-[8px] font-mono px-1.5 py-0.5 border uppercase tracking-widest ${classification === 'MEASURED' ? 'border-green-900/50 text-green-600 bg-green-950/20' : 'border-amber-900/50 text-amber-600 bg-amber-950/20'}`}>
          {classification}
        </span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-4xl font-light font-mono tracking-tight ${highlight ? 'text-cyan-400' : 'text-gray-100'}`}>{value}</span>
        <span className="text-xs font-mono text-gray-600">{unit}</span>
      </div>
    </div>
  );
}

function GaugeCard({ title, value, min, max, unit, classification, color }: any) {
  // Normalize value for rotation
  const clampedValue = Math.min(Math.max(value, min), max);
  const percentage = (clampedValue - min) / (max - min);
  const rotation = -120 + (percentage * 240); // Sweep from -120 to +120 degrees

  return (
    <div className="bg-[#080808] border border-gray-800 rounded-sm p-4 flex flex-col items-center justify-between relative overflow-hidden group hover:border-gray-700 transition-colors">
      <div className="w-full flex justify-between items-start absolute top-4 left-4 right-4 z-10 pr-8">
        <h3 className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">{title}</h3>
        <span className={`text-[8px] font-mono px-1 border uppercase tracking-widest ${classification === 'MEASURED' ? 'border-green-900 text-green-700 bg-green-950/20' : 'border-amber-900 text-amber-700 bg-amber-950/20'}`}>
          {classification}
        </span>
      </div>

      <div className="relative w-full h-full flex items-center justify-center mt-6">
        <svg viewBox="0 0 200 150" className="w-full max-w-[200px] drop-shadow-md">
          {/* Background Arc */}
          <path d="M 30 130 A 80 80 0 1 1 170 130" fill="none" stroke="#1a1a1a" strokeWidth="12" strokeLinecap="round" />
          
          {/* Ticks */}
          {Array.from({ length: 11 }).map((_, i) => {
            const angle = -120 + (i * 24);
            const rad = (angle - 90) * (Math.PI / 180);
            const x1 = 100 + 72 * Math.cos(rad);
            const y1 = 100 + 72 * Math.sin(rad);
            const x2 = 100 + 88 * Math.cos(rad);
            const y2 = 100 + 88 * Math.sin(rad);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#333" strokeWidth={i % 5 === 0 ? "2" : "1"} />
          })}

          {/* Active Arc (Animated via stroke-dasharray) */}
          <motion.path 
            d="M 30 130 A 80 80 0 1 1 170 130" 
            fill="none" 
            stroke={color} 
            strokeWidth="12" 
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: percentage }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{ strokeDasharray: "1 1" }}
          />

          {/* Needle */}
          <motion.g
            initial={{ rotate: -120 }}
            animate={{ rotate: rotation }}
            transition={{ duration: 1, ease: "easeOut" }}
            style={{ transformOrigin: "100px 100px" }}
          >
            <polygon points="98,100 102,100 100,20" fill={color} opacity="0.8" />
            <circle cx="100" cy="100" r="4" fill="#fff" />
          </motion.g>
        </svg>

        <div className="absolute bottom-2 flex flex-col items-center">
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-mono text-white tracking-tight">
              {Number.isInteger(value) ? value : value.toFixed(1)}
            </span>
            <span className="text-[10px] font-mono text-gray-500">{unit}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------
// CUSTOM SVG PROCESS FLOW VISUALIZATION
// ---------------------------------------------------------
function ProcessFlowVisualization({ itLoad, thermal, mdWater, roWater }: any) {
  // Use SVG to build a robust, animatable flow diagram
  // Layout nodes: Compute -> Heat Recovery -> RO -> MD -> Output

  return (
    <div className="w-full h-full relative flex items-center justify-center">
      <svg viewBox="0 0 800 300" className="w-full h-full max-w-[800px] overflow-visible">
        <defs>
          {/* Gradients */}
          <linearGradient id="heatFlow" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#ea580c" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="coolFlow" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.8" />
          </linearGradient>
          <linearGradient id="waterFlow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.9" />
          </linearGradient>
          
          {/* Particle Animation Path (horizontal) */}
          <marker id="arrowRed" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#ef4444" />
          </marker>
          <marker id="arrowBlue" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#3b82f6" />
          </marker>
          <marker id="arrowCyan" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#06b6d4" />
          </marker>
        </defs>

        {/* ---------------- LINES & FLOWS ---------------- */}
        
        {/* Compute -> Heat Recovery (Hot) */}
        <path d="M 120 100 L 250 100" fill="none" stroke="url(#heatFlow)" strokeWidth="4" markerEnd="url(#arrowRed)" />
        <circle cx="0" cy="0" r="3" fill="#fff" filter="blur(1px)">
          <animateMotion dur="2s" repeatCount="indefinite" path="M 120 100 L 250 100" />
        </circle>

        {/* Heat Recovery -> Compute (Cold Return) */}
        <path d="M 250 130 L 120 130" fill="none" stroke="url(#coolFlow)" strokeWidth="4" markerEnd="url(#arrowBlue)" />
        <circle cx="0" cy="0" r="3" fill="#fff" filter="blur(1px)">
          <animateMotion dur="2s" repeatCount="indefinite" path="M 250 130 L 120 130" />
        </circle>

        {/* Heat Recovery -> MD (Thermal Flow) */}
        <path d="M 370 115 L 530 115" fill="none" stroke="#ea580c" strokeWidth="3" markerEnd="url(#arrowRed)" strokeDasharray="6 4">
          <animate attributeName="stroke-dashoffset" from="10" to="0" dur="1s" repeatCount="indefinite" />
        </path>

        {/* Saline Inlet -> RO */}
        <path d="M 310 280 L 310 240" fill="none" stroke="#1e3a8a" strokeWidth="4" markerEnd="url(#arrowBlue)" />

        {/* RO -> MD (Concentrate) */}
        <path d="M 370 210 L 530 210" fill="none" stroke="#4338ca" strokeWidth="4" markerEnd="url(#arrowBlue)" />
        <circle cx="0" cy="0" r="3" fill="#818cf8" filter="blur(1px)">
          <animateMotion dur="2.5s" repeatCount="indefinite" path="M 370 210 L 530 210" />
        </circle>

        {/* RO -> Fresh Water */}
        <path d="M 310 180 L 310 50 L 680 50" fill="none" stroke="#0ea5e9" strokeWidth="3" markerEnd="url(#arrowCyan)" />
        <circle cx="0" cy="0" r="2" fill="#fff">
          <animateMotion dur="3s" repeatCount="indefinite" path="M 310 180 L 310 50 L 680 50" />
        </circle>

        {/* MD -> Fresh Water */}
        <path d="M 590 180 L 590 50 L 680 50" fill="none" stroke="#06b6d4" strokeWidth="3" markerEnd="url(#arrowCyan)" />
        <circle cx="0" cy="0" r="2" fill="#fff">
          <animateMotion dur="2s" repeatCount="indefinite" path="M 590 180 L 590 50 L 680 50" />
        </circle>

        {/* MD -> Brine Out */}
        <path d="M 590 240 L 590 280" fill="none" stroke="#312e81" strokeWidth="4" markerEnd="url(#arrowBlue)" />


        {/* ---------------- NODES ---------------- */}
        
        {/* COMPUTE NODE */}
        <g transform="translate(0, 75)">
          <rect x="0" y="0" width="120" height="80" rx="4" fill="#0f0f0f" stroke="#333" strokeWidth="2" />
          <rect x="10" y="15" width="100" height="8" rx="1" fill="#222" />
          <rect x="10" y="30" width="100" height="8" rx="1" fill="#222" />
          <rect x="10" y="45" width="100" height="8" rx="1" fill="#222" />
          <rect x="10" y="60" width="100" height="8" rx="1" fill="#222" />
          <circle cx="15" cy="19" r="2" fill="#10b981" />
          <circle cx="15" cy="34" r="2" fill="#10b981" />
          <circle cx="15" cy="49" r="2" fill="#10b981" />
          
          <text x="60" y="-10" fill="#9ca3af" fontSize="10" fontFamily="monospace" textAnchor="middle" letterSpacing="1">COMPUTE NODE</text>
          <text x="60" y="95" fill="#f3f4f6" fontSize="12" fontFamily="monospace" textAnchor="middle">{itLoad.toFixed(1)} MW</text>
        </g>

        {/* HEAT EXCHANGER NODE */}
        <g transform="translate(250, 75)">
          <rect x="0" y="0" width="120" height="80" rx="4" fill="#1a0f0f" stroke="#7f1d1d" strokeWidth="2" />
          <path d="M 20 20 L 100 20 L 20 40 L 100 40 L 20 60 L 100 60" fill="none" stroke="#ef4444" strokeWidth="4" strokeLinejoin="round" opacity="0.5" />
          <text x="60" y="-10" fill="#ef4444" fontSize="10" fontFamily="monospace" textAnchor="middle" letterSpacing="1">THERMAL LOOP</text>
          <text x="60" y="95" fill="#fca5a5" fontSize="12" fontFamily="monospace" textAnchor="middle">{thermal.toFixed(1)} MWt</text>
        </g>

        {/* RO STAGE NODE */}
        <g transform="translate(250, 180)">
          <rect x="0" y="0" width="120" height="60" rx="4" fill="#0f172a" stroke="#1e3a8a" strokeWidth="2" />
          <line x1="20" y1="30" x2="100" y2="30" stroke="#3b82f6" strokeWidth="2" strokeDasharray="4 2" />
          <text x="60" y="-10" fill="#60a5fa" fontSize="10" fontFamily="monospace" textAnchor="middle" letterSpacing="1">RO STAGE</text>
          <text x="60" y="75" fill="#93c5fd" fontSize="12" fontFamily="monospace" textAnchor="middle">{roWater.toFixed(0)} L/h</text>
        </g>

        {/* MD STAGE NODE */}
        <g transform="translate(530, 85)">
          <rect x="0" y="0" width="120" height="155" rx="4" fill="#082f49" stroke="#0369a1" strokeWidth="2" />
          {/* Vertical membrane simulation */}
          <line x1="60" y1="20" x2="60" y2="135" stroke="#06b6d4" strokeWidth="4" strokeDasharray="6 3" />
          <text x="60" y="-10" fill="#22d3ee" fontSize="10" fontFamily="monospace" textAnchor="middle" letterSpacing="1">MD STAGE</text>
          <text x="60" y="170" fill="#67e8f9" fontSize="12" fontFamily="monospace" textAnchor="middle">{mdWater.toFixed(0)} L/h</text>
        </g>

        {/* OUTPUT NODE */}
        <g transform="translate(680, 20)">
          <rect x="0" y="0" width="100" height="60" rx="4" fill="#042f2e" stroke="#0f766e" strokeWidth="2" />
          <path d="M 20 40 Q 50 30 80 40 L 80 60 L 20 60 Z" fill="#14b8a6" opacity="0.3" />
          <text x="50" y="-10" fill="#14b8a6" fontSize="10" fontFamily="monospace" textAnchor="middle" letterSpacing="1">FRESH WATER</text>
          <text x="50" y="35" fill="#5eead4" fontSize="14" fontFamily="monospace" textAnchor="middle font-bold">{(roWater + mdWater).toFixed(0)} L/h</text>
        </g>
        
        {/* LABELS */}
        <text x="310" y="295" fill="#475569" fontSize="10" fontFamily="monospace" textAnchor="middle">SALINE FEED</text>
        <text x="450" y="200" fill="#4f46e5" fontSize="10" fontFamily="monospace" textAnchor="middle">CONCENTRATE</text>
        <text x="590" y="295" fill="#312e81" fontSize="10" fontFamily="monospace" textAnchor="middle">BRINE OUT</text>
        <text x="500" y="40" fill="#0ea5e9" fontSize="10" fontFamily="monospace" textAnchor="middle">DISTILLATE</text>
        <text x="450" y="105" fill="#ea580c" fontSize="10" fontFamily="monospace" textAnchor="middle">MD HEAT INPUT</text>
      </svg>
    </div>
  )
}
