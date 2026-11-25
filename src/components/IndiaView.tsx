import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import {
  INDIA_STATES,
  INDIA_DATA_CENTERS,
  DataCenterNode
} from '../data/indiaMapData';
import {
  calculateComputeAndThermal,
  calculateHybridRecovery,
  HybridRecoveryResult
} from '../lib/engineering';
import {
  Server,
  Flame,
  Droplets,
  X,
  ArrowRight,
  Cpu,
  MapPin,
  Sun
} from 'lucide-react';

const COASTAL_CITY_IDS = new Set(['mumbai', 'chennai', 'kochi']);

interface CityModelledOpportunity {
  dc: DataCenterNode;
  capacityMW: number;
  deliveredThermalMWt: number;
  isCoastal: boolean;
  waterRecovery: HybridRecoveryResult | null;
}

export function IndiaView() {
  const navigate = useNavigate();
  const [selectedDC, setSelectedDC] = useState<DataCenterNode | null>(null);
  const [hoveredDC, setHoveredDC] = useState<DataCenterNode | null>(null);
  // Default to the subtler setting
  const [mapTheme, setMapTheme] = useState<'vibrant' | 'subtle'>('subtle');

  // States hosting hyperscale data centers for visual accentuation
  const ACTIVE_DC_STATES = new Set([
    'Maharashtra',
    'Telangana',
    'Tamil Nadu',
    'Karnataka',
    'Uttar Pradesh',
    'Delhi',
    'Gujarat',
    'West Bengal',
    'Kerala'
  ]);

  // Compute thermal and water recovery per city deterministically
  const { cityOpportunities, totalCapacityMW, totalDeliveredThermalMWt, totalCoastalWaterLph } = useMemo(() => {
    const opps: Record<string, CityModelledOpportunity> = {};
    let capSum = 0;
    let heatSum = 0;
    let coastalWaterSum = 0;

    INDIA_DATA_CENTERS.forEach((dc) => {
      capSum += dc.capacityMW;
      // Thermal model: calculateComputeAndThermal(capacityMW, 80, 24, 0.72, 0.88, 0.05)
      const thermalResult = calculateComputeAndThermal(dc.capacityMW, 80, 24, 0.72, 0.88, 0.05);
      heatSum += thermalResult.deliveredThermalPowerMWt;

      const isCoastal = COASTAL_CITY_IDS.has(dc.id);
      let waterRecovery: HybridRecoveryResult | null = null;

      if (isCoastal) {
        // Water model for coastal cities:
        // feed = 50000 * (capacity / 80) L/h
        // membrane = 6000 * (capacity / 80) m2
        // RO recovery = 45%, 50C, 22C, 35000 ppm, Bm 2.2, delivered thermal power
        waterRecovery = calculateHybridRecovery(
          50000 * (dc.capacityMW / 80),
          0.45,
          50,
          22,
          35000,
          2.2,
          6000 * (dc.capacityMW / 80),
          thermalResult.deliveredThermalPowerMWt
        );
        coastalWaterSum += waterRecovery.totalWaterLph;
      }

      opps[dc.id] = {
        dc,
        capacityMW: dc.capacityMW,
        deliveredThermalMWt: thermalResult.deliveredThermalPowerMWt,
        isCoastal,
        waterRecovery
      };
    });

    return {
      cityOpportunities: opps,
      totalCapacityMW: capSum,
      totalDeliveredThermalMWt: heatSum,
      totalCoastalWaterLph: coastalWaterSum
    };
  }, []);

  // State fill color
  const getStateFill = (stateName: string) => {
    const isHub = ACTIVE_DC_STATES.has(stateName);
    if (mapTheme === 'vibrant') {
      return isHub ? '#124c68' : '#0e3a50';
    } else {
      return isHub ? '#14384a' : '#0a2330';
    }
  };

  const getStateStroke = (stateName: string) => {
    const isHub = ACTIVE_DC_STATES.has(stateName);
    if (mapTheme === 'vibrant') {
      return isHub ? '#38bdf8' : '#2298c5';
    } else {
      return isHub ? '#2298c5' : '#144c66';
    }
  };

  // Network connection corridors between major Indian cloud regions
  const CORRIDORS = [
    { from: [155.2, 546.7], to: [179.4, 561.2], label: "Mumbai-Pune" },
    { from: [155.2, 546.7], to: [293.7, 590.7], label: "Mumbai-Hyd" },
    { from: [293.7, 590.7], to: [271.7, 703.6], label: "Hyd-Blr" },
    { from: [271.7, 703.6], to: [337.7, 700.8], label: "Blr-Chennai" },
    { from: [266.6, 291.1], to: [155.2, 546.7], label: "Delhi-Mumbai" },
    { from: [155.2, 546.7], to: [147.7, 442.3], label: "Mumbai-Ahmedabad" },
    { from: [293.7, 590.7], to: [537.5, 454.4], label: "Hyd-Kolkata" },
    { from: [271.7, 703.6], to: [238.9, 780.2], label: "Blr-Kochi" },
  ];

  const selectedOpp = selectedDC ? cityOpportunities[selectedDC.id] : null;

  return (
    <div
      id="india-opportunity-view"
      className="w-full h-[calc(100vh-4.25rem)] overflow-hidden bg-[#020b12] text-slate-100 flex flex-col font-sans select-none relative"
      style={{ fontFamily: "'Inter', Arial, Helvetica, sans-serif" }}
    >
      {/* Top Header Strip */}
      <header className="px-5 py-3 border-b border-white/10 bg-[#061e29]/90 backdrop-blur-md shrink-0 flex items-center justify-between gap-3 z-20 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500/30 via-teal-500/20 to-blue-500/30 border border-cyan-400/50 flex items-center justify-center text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
            <Server size={17} />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-white tracking-wider uppercase flex items-center gap-2">
              India Opportunity Map
              <span className="hidden sm:inline-flex text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 font-semibold shadow-[0_0_8px_rgba(6,182,212,0.2)]">
                {INDIA_DATA_CENTERS.length} CITIES
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Illustrative scenario using approximate city-level capacity. Not facility-level data.
            </p>
          </div>
        </div>

        {/* Vibrant / Subtle Glow Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMapTheme(mapTheme === 'vibrant' ? 'subtle' : 'vibrant')}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono border border-cyan-400/30 bg-cyan-950/40 text-cyan-300 hover:border-cyan-400 transition-colors cursor-pointer"
            title="Toggle map glow mode"
          >
            <Sun size={12} className={mapTheme === 'vibrant' ? 'text-amber-400' : 'text-slate-400'} />
            <span>{mapTheme === 'vibrant' ? 'VIBRANT GLOW' : 'SUBTLE GLOW'}</span>
          </button>
        </div>
      </header>

      {/* Main Interactive Stage: Map Centered */}
      <div className="flex-1 relative w-full h-full flex items-center justify-center overflow-hidden">
        
        {/* Subtle Background Grid & Gradients */}
        <div className="absolute inset-0 pointer-events-none opacity-25 bg-[radial-gradient(#14b8a6_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.08)_0%,transparent_75%)]" />

        {/* Scaled SVG Map Canvas */}
        <div className="relative w-full h-full max-w-[1040px] max-h-full flex items-center justify-center p-1 sm:p-2">
          <svg
            viewBox="20 20 750 850"
            className="w-full h-full object-contain filter drop-shadow-[0_10px_35px_rgba(0,0,0,0.8)]"
          >
            <defs>
              {/* Glow Filter for Active Nodes */}
              <filter id="hub-glow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="corridor-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* 1. Base Indian States Geography */}
            <g id="state-polygons">
              {INDIA_STATES.map((state) => {
                const isHubState = ACTIVE_DC_STATES.has(state.name);
                return (
                  <path
                    key={state.name}
                    d={state.path}
                    fill={getStateFill(state.name)}
                    stroke={getStateStroke(state.name)}
                    strokeWidth={isHubState ? 1.4 : 0.8}
                    className="transition-colors duration-300 hover:brightness-125"
                  >
                    <title>{state.name}</title>
                  </path>
                );
              })}
            </g>

            {/* 2. Fiber & Energy Corridors between Hyperscale Hubs */}
            <g id="inter-hub-corridors" opacity={mapTheme === 'vibrant' ? 0.6 : 0.35}>
              {CORRIDORS.map((c, i) => (
                <line
                  key={i}
                  x1={c.from[0]}
                  y1={c.from[1]}
                  x2={c.to[0]}
                  y2={c.to[1]}
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  strokeDasharray="4 6"
                  filter="url(#corridor-glow)"
                  className={mapTheme === 'vibrant' ? "animate-pulse" : ""}
                />
              ))}
            </g>

            {/* 3. Interactive Data Center Hub Markers */}
            <g id="datacenter-nodes">
              {INDIA_DATA_CENTERS.map((dc) => {
                const [cx, cy] = dc.projected;
                const isSelected = selectedDC?.id === dc.id;
                const isHovered = hoveredDC?.id === dc.id;
                const opp = cityOpportunities[dc.id];

                return (
                  <g
                    key={dc.id}
                    onClick={() => {
                      setSelectedDC(dc);
                    }}
                    onMouseEnter={() => setHoveredDC(dc)}
                    onMouseLeave={() => setHoveredDC(null)}
                    className="cursor-pointer group"
                  >
                    {/* Continuous Pulsing Wave */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isSelected ? "24" : "18"}
                      fill="none"
                      stroke={dc.color}
                      strokeWidth={isSelected ? "2" : "1.2"}
                      strokeOpacity={isSelected ? "0.9" : mapTheme === 'vibrant' ? "0.6" : "0.25"}
                      className={mapTheme === 'vibrant' || isSelected ? "animate-ping" : ""}
                      style={{ animationDuration: isSelected ? '1.5s' : '3.5s' }}
                    />

                    {/* Secondary Breathing Pulsing Halo */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isSelected ? "17" : "12"}
                      fill={dc.color}
                      fillOpacity={isSelected ? "0.4" : mapTheme === 'vibrant' ? "0.2" : "0.1"}
                      stroke={dc.color}
                      strokeWidth={isSelected ? "2" : "1.2"}
                      filter="url(#hub-glow)"
                      className={mapTheme === 'vibrant' ? "animate-pulse" : ""}
                    />

                    {/* Core Dot */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={isSelected ? "5.5" : "4"}
                      fill="#ffffff"
                      stroke={dc.color}
                      strokeWidth={isSelected ? "2.5" : "2"}
                      className="transition-all duration-200"
                    />

                    {/* City Label Badge */}
                    <text
                      x={cx + dc.labelOffset.x}
                      y={cy + dc.labelOffset.y}
                      fill={isSelected ? "#ffffff" : isHovered ? "#38bdf8" : "#e2e8f0"}
                      fontSize={isSelected ? "13" : "11"}
                      fontFamily="'Inter', Arial, sans-serif"
                      fontWeight={isSelected ? "bold" : "600"}
                      textAnchor={dc.labelOffset.anchor}
                      filter="drop-shadow(0 2px 4px rgba(0,0,0,0.9))"
                      className="transition-all duration-200 pointer-events-none select-none"
                    >
                      {dc.city.split('/')[0]}
                    </text>

                    {/* Interactive Selection Tooltip Badge on Map */}
                    {isSelected && (
                      <g className="pointer-events-none">
                        <rect
                          x={cx + (dc.labelOffset.anchor === 'end' ? -155 : 10)}
                          y={cy + dc.labelOffset.y + 4}
                          width={opp.isCoastal && opp.waterRecovery ? 140 : 150}
                          height="20"
                          rx="4"
                          fill="#061e29"
                          stroke="#38bdf8"
                          strokeWidth="1"
                          filter="drop-shadow(0 4px 6px rgba(0,0,0,0.8))"
                        />
                        <text
                          x={cx + (dc.labelOffset.anchor === 'end' ? -85 : 85)}
                          y={cy + dc.labelOffset.y + 18}
                          fill="#38bdf8"
                          fontSize="9.5"
                          fontFamily="'Inter', Arial, sans-serif"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          {opp.isCoastal && opp.waterRecovery
                            ? `${dc.capacityMW} MW • ${Math.round(opp.waterRecovery.totalWaterLph).toLocaleString()} L/h`
                            : `${dc.capacityMW} MW • Needs saline feed`}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Floating Quick Region Switcher (Left Dock) */}
        <div className="absolute left-4 top-4 hidden lg:flex flex-col gap-1.5 bg-[#061822]/90 border border-white/10 rounded-2xl p-2.5 backdrop-blur-md shadow-xl z-10 w-48">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2 py-1 flex items-center justify-between">
            <span>Select City</span>
            <MapPin size={11} className="text-cyan-400" />
          </div>
          {INDIA_DATA_CENTERS.map((dc) => (
            <button
              key={dc.id}
              onClick={() => {
                setSelectedDC(dc);
              }}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium text-left flex items-center justify-between transition-all cursor-pointer ${
                selectedDC?.id === dc.id
                  ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-400/40 shadow-xs'
                  : 'text-slate-300 hover:bg-white/5'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dc.color }} />
                <span className="truncate">{dc.city.split('/')[0]}</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 shrink-0">
                {dc.capacityMW} MW
              </span>
            </button>
          ))}
          {/* Footnote on city capacity data source */}
          <div className="text-[9.5px] text-slate-400/80 px-2 pt-2 border-t border-white/10 mt-1 leading-snug">
            Approximate, compiled from published industry reports (2025-26). Figures vary by source.
          </div>
        </div>

        {/* 4. FIXED SIDE PANEL */}
        <AnimatePresence>
          {selectedDC && selectedOpp && (
            <motion.div
              key={selectedDC.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 50 }}
              transition={{ duration: 0.25 }}
              className="absolute right-3 sm:right-6 top-4 bottom-4 w-[92%] sm:w-96 max-w-sm bg-[#061822]/95 border border-cyan-400/50 rounded-3xl p-5 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.9)] backdrop-blur-2xl z-30 flex flex-col justify-between overflow-y-auto"
            >
              {/* Popover Header */}
              <div>
                <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-cyan-300/90 font-medium">
                        {selectedDC.state}
                      </span>
                      {selectedOpp.isCoastal && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                          COASTAL
                        </span>
                      )}
                    </div>
                    <h3 className="text-xl font-extrabold text-white mt-1.5">
                      {selectedDC.city}
                    </h3>
                    <p className="text-xs text-slate-300/80">
                      {selectedDC.regionName}
                    </p>
                  </div>

                  <button
                    onClick={() => setSelectedDC(null)}
                    className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                    title="Close"
                  >
                    <X size={17} />
                  </button>
                </div>

                {/* Popover Key Metrics Grid */}
                <div className="grid grid-cols-2 gap-2.5 my-4">
                  {/* Card 1: IT Capacity */}
                  <div className="p-3 rounded-2xl bg-black/50 border border-white/10">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <Cpu size={13} className="text-cyan-400" />
                      <span>IT Capacity</span>
                    </div>
                    <div className="text-xl font-extrabold text-white mt-1">
                      {selectedOpp.capacityMW} <span className="text-xs font-normal text-slate-400">MW</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      Approx. operational
                    </div>
                  </div>

                  {/* Card 2: Delivered Thermal Power */}
                  <div className="p-3 rounded-2xl bg-black/50 border border-white/10">
                    <div className="flex items-center gap-1.5 text-xs text-amber-400">
                      <Flame size={13} />
                      <span>Delivered Heat</span>
                    </div>
                    <div className="text-xl font-extrabold text-amber-300 mt-1">
                      {selectedOpp.deliveredThermalMWt.toFixed(1)} <span className="text-xs font-normal text-slate-400">MWth</span>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      80% util · 72% capture
                    </div>
                  </div>

                  {/* Card 3: Water Recovery */}
                  <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 col-span-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-cyan-300">
                        <Droplets size={13} className="text-cyan-400" />
                        <span className="font-medium">Total Water Recovery</span>
                      </div>
                      {selectedOpp.isCoastal && selectedOpp.waterRecovery && (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          DAILY: {Math.round(selectedOpp.waterRecovery.totalWaterLph * 24).toLocaleString()} L/day
                        </span>
                      )}
                    </div>

                    {selectedOpp.isCoastal && selectedOpp.waterRecovery ? (
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-extrabold text-cyan-300">
                            {Math.round(selectedOpp.waterRecovery.totalWaterLph).toLocaleString()}
                          </span>
                          <span className="text-xs text-slate-400">L/h total (RO + MD)</span>
                        </div>
                        <div className="text-xs text-slate-300/90 mt-1">
                          of which waste-heat MD: <span className="font-semibold text-cyan-200">{Math.round(selectedOpp.waterRecovery.mdWaterLph).toLocaleString()} L/h</span> ({Math.round(selectedOpp.waterRecovery.mdWaterLph * 24).toLocaleString()} L/day)
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1.5 italic">
                          If a seawater-grade RO reject stream is available.
                        </div>
                      </div>
                    ) : (
                      <div className="py-1">
                        <div className="text-sm font-bold text-amber-300/90">
                          Needs saline feed source
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                          Inland location without direct seawater or coastal brine feed stream.
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Popover Engineering Context (Unsourced rows removed) */}
                <div className="space-y-2 text-xs text-slate-300 border-t border-white/10 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Saline Feed Context:</span>
                    <span className="font-semibold text-slate-200">
                      {selectedOpp.isCoastal ? 'Coastal seawater candidate' : 'Inland (Saline source required)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Local Climate:</span>
                    <span className="font-semibold text-slate-200">{selectedDC.climateZone}</span>
                  </div>
                </div>

                {/* Popover Description */}
                <p className="text-xs text-slate-400 leading-relaxed mt-3.5 bg-black/30 p-3 rounded-xl border border-white/5">
                  {selectedDC.description}
                </p>

                {/* Mandatory Disclaimer Caption */}
                <p className="text-[11px] text-slate-400 text-center italic mt-3 pt-3 border-t border-white/10">
                  Model-based estimate. Not experimentally validated.
                </p>
              </div>

              {/* CTA: Simulate in Engineering Model */}
              <div className="pt-4 border-t border-white/10 mt-3">
                <button
                  onClick={() => navigate('/model')}
                  className="w-full py-2.5 px-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-pointer"
                >
                  <span>Simulate in Engineering Model</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Bottom Aggregated Grid Stats Strip */}
      <footer className="px-5 py-2.5 border-t border-white/10 bg-[#061e29]/95 backdrop-blur-md shrink-0 flex flex-wrap items-center justify-between gap-4 z-20">
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Total Operational IT:</span>
            <span className="font-bold text-white text-sm">
              {totalCapacityMW.toLocaleString()} MW
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span className="text-slate-400">Delivered Thermal Power:</span>
            <span className="font-bold text-amber-300 text-sm">
              {Math.round(totalDeliveredThermalMWt).toLocaleString()} MWth
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Total Water Recovery:</span>
            <span className="font-bold text-cyan-300 text-sm">
              {Math.round(totalCoastalWaterLph).toLocaleString()} L/h
            </span>
            <span className="text-[11px] text-emerald-400">
              (~{(Math.round(totalCoastalWaterLph * 24 / 1000)).toLocaleString()}k L/day · coastal scenario)
            </span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 text-xs text-slate-400">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span>Scenario view: approximate capacities, modelled heat and water. Not live data.</span>
        </div>
      </footer>
    </div>
  );
}
