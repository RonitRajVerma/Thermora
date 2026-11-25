import React, { useState, useMemo } from "react";
import { Droplets, Calendar, Flame } from "lucide-react";
import { 
  calculateComputeAndThermal, 
  calculateHybridRecovery 
} from "../lib/engineering";

export function Impact() {
  const [capacityMW, setCapacityMW] = useState<number>(80);
  const [utilizationPercent, setUtilizationPercent] = useState<number>(80);

  const { thermal, hybrid } = useMemo(() => {
    // 1. Deterministic compute & thermal model
    const t = calculateComputeAndThermal(
      capacityMW,
      utilizationPercent,
      24,
      0.72, // 72% direct-to-chip heat capture
      0.88, // 88% plate HEX effectiveness
      0.05  // 5% distribution and piping loss
    );

    // 2. Coupled hybrid RO + MD proportional sizing
    // Baseline: 50,000 L/h feed & 6,000 m² membrane area per 80 MW capacity
    const scale = capacityMW / 80;
    const feedVolLph = 50000 * scale;
    const membraneAreaM2 = 6000 * scale;

    const h = calculateHybridRecovery(
      feedVolLph,
      0.45,  // 45% RO recovery rate
      50,    // 50°C return temperature
      22,    // 22°C condensing temperature
      35000, // 35,000 ppm seawater/saline groundwater
      2.2,   // Membrane permeability coefficient
      membraneAreaM2,
      t.deliveredThermalPowerMWt
    );

    return { thermal: t, hybrid: h };
  }, [capacityMW, utilizationPercent]);

  return (
    <div 
      className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 pt-24"
      style={{ fontFamily: "'Inter', Arial, Helvetica, sans-serif" }}
    >
      {/* =========================================================================
          1. HEADER
          ========================================================================= */}
      <header className="pb-3 border-b border-white/10 space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Resource Impact.
        </h1>
        <p className="text-slate-400 text-sm">
          Projected water and energy recovery from compute waste heat.
        </p>
      </header>

      {/* =========================================================================
          2. DATA CENTRE CAPACITY
          Compact selector showing IT capacity (MW), Utilisation (%), Active IT load (MW)
          ========================================================================= */}
      <section className="p-4 rounded-xl bg-[#061822] border border-cyan-500/20 shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          {/* IT Capacity */}
          <div className="space-y-1.5 p-3 rounded-lg bg-[#020b12] border border-white/5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">IT Capacity</span>
              <span className="text-white font-mono font-bold">{capacityMW} MW</span>
            </div>
            <input
              type="range"
              min="10"
              max="200"
              step="5"
              value={capacityMW}
              onChange={(e) => setCapacityMW(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          {/* Utilisation */}
          <div className="space-y-1.5 p-3 rounded-lg bg-[#020b12] border border-white/5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Utilisation</span>
              <span className="text-white font-mono font-bold">{utilizationPercent}%</span>
            </div>
            <input
              type="range"
              min="30"
              max="100"
              step="5"
              value={utilizationPercent}
              onChange={(e) => setUtilizationPercent(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          {/* Active IT Load Readout */}
          <div className="p-3 rounded-lg bg-[#020b12] border border-cyan-500/20">
            <div className="text-xs text-slate-400">Active IT Load</div>
            <div className="text-lg font-bold text-cyan-400 font-mono mt-0.5">
              {thermal.activeITPowerMW.toFixed(1)} <span className="text-xs text-slate-400 font-normal">MW</span>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          3. EXACTLY FOUR IMPACT CARDS (2x2 Clean Grid)
          - Card 1: Total water recovery (RO + MD) (L/day)
          - Card 2: Annual Water Recovery (m³/year)
          - Card 3: Thermal Energy Recovered (MWhth/day)
          - Card 4: Freshwater Withdrawal Avoided (Neutral dash "—")
          ========================================================================= */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* CARD 1 — TOTAL WATER RECOVERY (RO + MD) */}
        <div className="p-5 rounded-xl bg-[#061822] border border-cyan-500/20 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Total water recovery (RO + MD)
            </span>
            <Droplets size={16} className="text-cyan-400" />
          </div>
          <div className="my-3">
            <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono">
              {Math.round(hybrid.totalWaterLpd).toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 font-mono mt-1">L/day</div>
            <div className="text-[11px] text-slate-500 font-mono mt-1">
              of which waste-heat MD: {Math.round(hybrid.mdWaterLph * 24).toLocaleString()} L/day
            </div>
          </div>
        </div>

        {/* CARD 2 — ANNUAL WATER RECOVERY */}
        <div className="p-5 rounded-xl bg-[#061822] border border-cyan-500/20 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Annual Water Recovery
            </span>
            <Calendar size={16} className="text-cyan-400" />
          </div>
          <div className="my-3">
            <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono">
              {Math.round(hybrid.totalWaterM3Yr).toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 font-mono mt-1">m³/year</div>
          </div>
        </div>

        {/* CARD 3 — THERMAL ENERGY RECOVERED */}
        <div className="p-5 rounded-xl bg-[#061822] border border-amber-500/20 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Thermal Energy Recovered
            </span>
            <Flame size={16} className="text-amber-400" />
          </div>
          <div className="my-3">
            <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono">
              {thermal.deliveredThermalEnergyMWhth.toFixed(1)}
            </div>
            <div className="text-xs text-slate-400 font-mono mt-1">MWhth/day</div>
          </div>
        </div>

        {/* CARD 4 — FRESHWATER WITHDRAWAL AVOIDED */}
        <div className="p-5 rounded-xl bg-[#061822] border border-cyan-500/20 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              Freshwater Withdrawal Avoided
            </span>
            <Droplets size={16} className="text-slate-500" />
          </div>
          <div className="my-3">
            <div className="text-3xl sm:text-4xl font-extrabold text-slate-300 font-mono">
              —
            </div>
            <div className="text-xs text-slate-500 font-mono mt-1">
              Requires site reuse data
            </div>
          </div>
        </div>
      </section>

      {/* Model Footnote */}
      <div className="text-xs text-slate-500 font-mono px-1">
        Model-based estimate. Assumes 50,000 L/h seawater-grade feed per 80 MW. Not experimentally validated.
      </div>

      {/* =========================================================================
          4. SUSTAINABLE DEVELOPMENT GOALS
          Display official coloured SDG icons: SDG 6, SDG 9, SDG 12 (enlarged for legibility)
          Caption: Conceptual alignment with SDG 6, 9, 12. Not a certification.
          ========================================================================= */}
      <section className="pt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-white/10">
        <div className="flex items-center gap-3 sm:gap-4">
          <img
            src="/assets/sdg-6.svg"
            alt="SDG 6 — Clean Water and Sanitation"
            title="SDG 6 — Clean Water and Sanitation"
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-contain border border-white/10 shadow-md bg-[#020b12]"
          />
          <img
            src="/assets/sdg-9.svg"
            alt="SDG 9 — Industry, Innovation and Infrastructure"
            title="SDG 9 — Industry, Innovation and Infrastructure"
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-contain border border-white/10 shadow-md bg-[#020b12]"
          />
          <img
            src="/assets/sdg-12.svg"
            alt="SDG 12 — Responsible Consumption and Production"
            title="SDG 12 — Responsible Consumption and Production"
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-contain border border-white/10 shadow-md bg-[#020b12]"
          />
        </div>
        <p className="text-xs text-slate-400 font-mono">
          Conceptual alignment with SDG 6, 9, 12. Not a certification.
        </p>
      </section>
    </div>
  );
}
