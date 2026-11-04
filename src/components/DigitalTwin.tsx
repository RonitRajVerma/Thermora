import React, { useState, useMemo } from "react";
import {
  calculateComputeAndThermal,
  calculateHybridRecovery,
  HEAT_SOURCE_SCENARIOS
} from "../lib/engineering";
import {
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ArrowRight
} from "lucide-react";

interface SimParams {
  // Essential inputs
  itLoadMW: number;
  utilizationPercent: number;
  tHot: number;
  tCold: number;
  roRecoveryRate: number;

  // Secondary / advanced inputs
  heatScenarioId: string;
  recoverableHeatFraction: number;
  membraneArea: number;
  feedVolLph: number;
  feedSalinityPPM: number;
  bmCoefficient: number;
  hexEffectiveness: number;
}

export function DigitalTwin() {
  const [params, setParams] = useState<SimParams>({
    itLoadMW: 80,
    utilizationPercent: 80,
    tHot: 50,
    tCold: 22,
    roRecoveryRate: 0.45,
    heatScenarioId: "dlc-coldplate",
    recoverableHeatFraction: 0.72,
    membraneArea: 6000,
    feedVolLph: 50000,
    feedSalinityPPM: 35000,
    bmCoefficient: 2.2,
    hexEffectiveness: 0.88,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleParamChange = (key: keyof SimParams, value: number | string) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleScenarioChange = (scenarioId: string) => {
    const sc = HEAT_SOURCE_SCENARIOS.find((s) => s.id === scenarioId);
    if (sc) {
      setParams((prev) => ({
        ...prev,
        heatScenarioId: scenarioId,
        tHot: sc.typicalReturnTempC,
        recoverableHeatFraction: sc.captureFraction,
      }));
    }
  };

  const sim = useMemo(() => {
    const thermal = calculateComputeAndThermal(
      params.itLoadMW,
      params.utilizationPercent,
      24,
      params.recoverableHeatFraction,
      params.hexEffectiveness,
      0.05
    );

    const hybrid = calculateHybridRecovery(
      params.feedVolLph,
      params.roRecoveryRate,
      params.tHot,
      params.tCold,
      params.feedSalinityPPM,
      params.bmCoefficient,
      params.membraneArea,
      thermal.deliveredThermalPowerMWt
    );

    return { thermal, hybrid };
  }, [params]);

  return (
    <div
      className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6 pt-24"
      style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
    >
      {/* =========================================================================
          SECTION A: HEADER
          ========================================================================= */}
      <header className="pb-3 border-b border-white/10 space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          From Compute to Water.
        </h1>
        <p className="text-slate-400 text-sm">
          Simulate how compute waste heat supports additional water recovery.
        </p>
      </header>

      {/* =========================================================================
          SECTION B: PROCESS OVERVIEW
          Horizontal flow: COMPUTE → WASTE HEAT → RO + MD → RECOVERED WATER
          Showing only 3 important summary values:
          - Active IT power
          - Available/delivered thermal power
          - Total recovered water
          ========================================================================= */}
      <section className="p-4 rounded-xl bg-[#061822] border border-cyan-500/20 shadow-md">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-center">
          {/* Step 1: Compute */}
          <div className="p-3 rounded-lg bg-[#020b12] border border-white/5">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
              1. Compute
            </div>
            <div className="text-lg font-bold text-white font-mono mt-1">
              {sim.thermal.activeITPowerMW.toFixed(1)} <span className="text-xs font-normal text-slate-400">MW</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Active IT Power</div>
          </div>

          {/* Step 2: Waste Heat */}
          <div className="p-3 rounded-lg bg-[#020b12] border border-white/5">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
              2. Waste Heat
            </div>
            <div className="text-lg font-bold text-amber-400 font-mono mt-1">
              {sim.thermal.deliveredThermalPowerMWt.toFixed(1)} <span className="text-xs font-normal text-slate-400">MWth</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              {sim.thermal.deliveredThermalEnergyMWhth.toFixed(1)} MWhth/day
            </div>
          </div>

          {/* Step 3: RO + MD */}
          <div className="p-3 rounded-lg bg-[#020b12] border border-white/5">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
              3. RO + MD
            </div>
            <div className="text-lg font-bold text-cyan-400 font-mono mt-1">
              Coupled
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Dual-Stage Recovery</div>
          </div>

          {/* Step 4: Recovered Water */}
          <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-500/30">
            <div className="text-[10px] uppercase tracking-wider text-cyan-300 font-mono font-bold">
              4. Recovered Water
            </div>
            <div className="text-lg font-extrabold text-white font-mono mt-1">
              {Math.round(sim.hybrid.totalWaterLph).toLocaleString()} <span className="text-xs font-normal text-cyan-400">L/h</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Total Water Recovery</div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          SECTION C: OPERATING CONDITIONS
          Essential user-adjustable inputs:
          - IT capacity
          - Utilisation
          - Hot-side temperature
          - Cold-side temperature
          - RO recovery
          Collapsed Advanced Settings section for secondary parameters
          ========================================================================= */}
      <section className="p-5 rounded-xl bg-[#061822] border border-cyan-500/20 shadow-md space-y-4">
        <h2 className="text-xs uppercase tracking-wider font-bold text-slate-300 font-mono">
          Operating Conditions
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. IT capacity */}
          <div className="p-3 rounded-lg bg-[#020b12] border border-white/5 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">IT Capacity</span>
              <span className="text-white font-mono font-bold">{params.itLoadMW} MW</span>
            </div>
            <input
              type="range"
              min="10"
              max="200"
              step="5"
              value={params.itLoadMW}
              onChange={(e) => handleParamChange("itLoadMW", Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          {/* 2. Utilisation */}
          <div className="p-3 rounded-lg bg-[#020b12] border border-white/5 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Utilisation</span>
              <span className="text-white font-mono font-bold">{params.utilizationPercent}%</span>
            </div>
            <input
              type="range"
              min="30"
              max="100"
              step="5"
              value={params.utilizationPercent}
              onChange={(e) => handleParamChange("utilizationPercent", Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          {/* 3. Hot-side temperature */}
          <div className="p-3 rounded-lg bg-[#020b12] border border-white/5 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Hot-Side Temp (T_hot)</span>
              <span className="text-white font-mono font-bold">{params.tHot}°C</span>
            </div>
            <input
              type="range"
              min="38"
              max="65"
              step="1"
              value={params.tHot}
              onChange={(e) => handleParamChange("tHot", Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          {/* 4. Cold-side temperature */}
          <div className="p-3 rounded-lg bg-[#020b12] border border-white/5 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Cold-Side Temp (T_cold)</span>
              <span className="text-white font-mono font-bold">{params.tCold}°C</span>
            </div>
            <input
              type="range"
              min="10"
              max="30"
              step="1"
              value={params.tCold}
              onChange={(e) => handleParamChange("tCold", Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>

          {/* 5. RO recovery */}
          <div className="p-3 rounded-lg bg-[#020b12] border border-white/5 space-y-1.5 sm:col-span-2 lg:col-span-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">RO Recovery</span>
              <span className="text-white font-mono font-bold">{(params.roRecoveryRate * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.30"
              max="0.60"
              step="0.05"
              value={params.roRecoveryRate}
              onChange={(e) => handleParamChange("roRecoveryRate", Number(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
            />
          </div>
        </div>

        {/* Collapsed Advanced Settings */}
        <div className="pt-2 border-t border-white/5">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer py-1"
          >
            {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>Advanced Settings</span>
          </button>

          {showAdvanced && (
            <div className="pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* Heat capture fraction */}
              <div className="p-3 rounded-lg bg-[#020b12] border border-white/5 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Heat Capture</span>
                  <span className="text-white font-mono font-bold">{(params.recoverableHeatFraction * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.40"
                  max="0.85"
                  step="0.02"
                  value={params.recoverableHeatFraction}
                  onChange={(e) => handleParamChange("recoverableHeatFraction", Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Membrane area */}
              <div className="p-3 rounded-lg bg-[#020b12] border border-white/5 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Membrane Area</span>
                  <span className="text-white font-mono font-bold">{params.membraneArea.toLocaleString()} m²</span>
                </div>
                <input
                  type="range"
                  min="1000"
                  max="20000"
                  step="500"
                  value={params.membraneArea}
                  onChange={(e) => handleParamChange("membraneArea", Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Feed flow rate */}
              <div className="p-3 rounded-lg bg-[#020b12] border border-white/5 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Raw Feed Flow</span>
                  <span className="text-white font-mono font-bold">{params.feedVolLph.toLocaleString()} L/h</span>
                </div>
                <input
                  type="range"
                  min="10000"
                  max="150000"
                  step="5000"
                  value={params.feedVolLph}
                  onChange={(e) => handleParamChange("feedVolLph", Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Feed Salinity */}
              <div className="p-3 rounded-lg bg-[#020b12] border border-white/5 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Feed Salinity</span>
                  <span className="text-white font-mono font-bold">{params.feedSalinityPPM.toLocaleString()} ppm</span>
                </div>
                <input
                  type="range"
                  min="5000"
                  max="50000"
                  step="2500"
                  value={params.feedSalinityPPM}
                  onChange={(e) => handleParamChange("feedSalinityPPM", Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                />
              </div>

              {/* Cooling Architecture Presets */}
              <div className="p-3 rounded-lg bg-[#020b12] border border-white/5 space-y-1.5 sm:col-span-2">
                <span className="text-xs text-slate-400 block">Cooling Preset</span>
                <div className="grid grid-cols-3 gap-2">
                  {HEAT_SOURCE_SCENARIOS.slice(0, 3).map((sc) => (
                    <button
                      key={sc.id}
                      onClick={() => handleScenarioChange(sc.id)}
                      className={`px-2 py-1.5 rounded text-xs text-center border transition-colors cursor-pointer ${
                        params.heatScenarioId === sc.id
                          ? "bg-cyan-500/20 border-cyan-400 text-white font-bold"
                          : "border-white/5 text-slate-400 hover:text-white"
                      }`}
                    >
                      {sc.name.split(" ")[0]} ({sc.typicalReturnTempC}°C)
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* =========================================================================
          SECTION D: MAIN RESULT
          Additional MD recovery has the strongest visual emphasis.
          Compact result section showing:
          - Additional MD water recovery (prominent)
          - Primary RO water recovery
          - Total water recovery
          - Remaining brine
          Expandable calculation details (mass-transfer, thermal-energy, reject-flow)
          ========================================================================= */}
      <section className="p-5 rounded-xl bg-[#061822] border border-cyan-500/30 shadow-lg space-y-4">
        {/* Hero Card: Additional MD Water Recovery */}
        <div className="p-5 rounded-xl bg-gradient-to-r from-cyan-950/40 via-[#061822] to-cyan-950/30 border border-cyan-400/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-cyan-300 font-bold">
              Additional MD Water Recovery
            </div>
            <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono mt-1">
              +{Math.round(sim.hybrid.mdWaterLph).toLocaleString()}{" "}
              <span className="text-base sm:text-lg font-normal text-cyan-400">L/h</span>
            </div>
            <div className="text-xs text-slate-400 mt-1">
              +{sim.hybrid.additionalMDRecoveryGainPercent.toFixed(1)}% recovery yield gained from datacenter waste heat
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-1">
              Model-based estimate. Not experimentally validated.
            </div>
          </div>
          <div className="sm:text-right border-t sm:border-t-0 sm:border-l border-white/10 pt-3 sm:pt-0 sm:pl-6 shrink-0 font-mono">
            <div className="text-xs text-slate-400">Daily MD Yield</div>
            <div className="text-lg font-bold text-white">
              +{Math.round(sim.hybrid.mdWaterLph * 24).toLocaleString()} L/day
            </div>
          </div>
        </div>

        {/* Compact 3-metric row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Primary RO water recovery */}
          <div className="p-3.5 rounded-lg bg-[#020b12] border border-white/5">
            <div className="text-xs text-slate-400">Primary RO Recovery</div>
            <div className="text-xl font-bold text-white font-mono mt-1">
              {Math.round(sim.hybrid.roWaterLph).toLocaleString()}{" "}
              <span className="text-xs font-normal text-slate-400">L/h</span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              {(params.roRecoveryRate * 100).toFixed(0)}% base RO recovery
            </div>
          </div>

          {/* Total water recovery */}
          <div className="p-3.5 rounded-lg bg-[#020b12] border border-cyan-500/20">
            <div className="text-xs text-cyan-300 font-medium">Total Water Recovery</div>
            <div className="text-xl font-bold text-white font-mono mt-1">
              {Math.round(sim.hybrid.totalWaterLph).toLocaleString()}{" "}
              <span className="text-xs font-normal text-slate-400">L/h</span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono mt-0.5">
              {Math.round(sim.hybrid.totalWaterLpd).toLocaleString()} L/day
            </div>
          </div>

          {/* Remaining brine */}
          <div className="p-3.5 rounded-lg bg-[#020b12] border border-white/5">
            <div className="text-xs text-slate-400">Remaining Brine</div>
            <div className="text-xl font-bold text-white font-mono mt-1">
              {Math.round(sim.hybrid.remainingBrineLph).toLocaleString()}{" "}
              <span className="text-xs font-normal text-slate-400">L/h</span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              TDS: {Math.round(sim.hybrid.remainingBrineSalinityPPM).toLocaleString()} ppm
            </div>
          </div>
        </div>

        {/* Genuine Operational Warning (Reserved for genuine limits) */}
        {sim.hybrid.warnings.length > 0 && (
          <div className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0 text-amber-400" />
            <span>Salt saturation cap reached (~260,000 ppm, simplified). MD output is capped by brine chemistry, not by heat.</span>
          </div>
        )}

        {/* Small Expandable Calculation Details */}
        <div className="pt-1 border-t border-white/5">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer py-1 font-mono"
          >
            {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            <span>Calculation details</span>
          </button>

          {showDetails && (
            <div className="pt-3 space-y-3 font-mono text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-[#020b12] border border-white/5">
                  <div className="text-[10px] text-slate-400 uppercase">Mass-Transfer Limit</div>
                  <div className="text-base font-bold text-white mt-1">
                    {Math.round(sim.hybrid.mdMassTransferLimitedLph).toLocaleString()} L/h
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Flux: {sim.hybrid.mdFluxKgM2h.toFixed(2)} kg/m²h (ΔPv: {sim.hybrid.mdDrivingForceKPa.toFixed(1)} kPa)
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#020b12] border border-white/5">
                  <div className="text-[10px] text-slate-400 uppercase">Thermal-Energy Limit</div>
                  <div className="text-base font-bold text-amber-400 mt-1">
                    {Math.round(sim.hybrid.mdThermalEnergyLimitLph).toLocaleString()} L/h
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Available Heat / Latent Heat (ΔHvap)
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#020b12] border border-white/5">
                  <div className="text-[10px] text-slate-400 uppercase">Precipitation Limit</div>
                  <div className="text-base font-bold text-white mt-1">
                    {Math.round(sim.hybrid.mdSaturationLimitLph).toLocaleString()} L/h
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Active constraint: <span className="text-cyan-400">{sim.hybrid.mdLimitingFactor.replace('_', ' ')}</span>
                  </div>
                </div>
              </div>

              {/* Thermal Headroom and Theoretical Minimum Latent Heat */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-[#020b12] border border-white/5 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase">Thermal Headroom</div>
                  <div className="text-base font-bold text-amber-400">
                    {sim.hybrid.mdWaterLph > 0
                      ? `${(sim.hybrid.mdThermalEnergyLimitLph / sim.hybrid.mdWaterLph).toFixed(1)}x`
                      : "N/A"}
                  </div>
                  <div className="text-[11px] text-slate-500 font-sans">
                    Waste heat exceeds what the brine chemistry allows.
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#020b12] border border-white/5 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase">Theoretical Minimum Latent Heat Requirement</div>
                  <div className="text-base font-bold text-amber-400">
                    {((sim.hybrid.mdWaterLph * 2420) / 3600 / 1000).toFixed(1)} MWth
                  </div>
                  <div className="text-[11px] text-slate-500 font-sans">
                    Idealized latent heat only; excludes sensible heating, conductive losses and other thermal losses.
                  </div>
                </div>
              </div>

              {/* Delivered Heat & Brine Audits */}
              <div className="p-3 rounded-lg bg-[#020b12] border border-white/5 text-[11px] text-slate-400 font-sans space-y-1">
                <div>
                  <span className="text-white font-mono font-medium">Delivered Heat Audit: </span>
                  {sim.thermal.deliveredThermalPowerMWt.toFixed(1)} MWth instantaneous rate ({sim.thermal.deliveredThermalEnergyMWhth.toFixed(1)} MWhth/day cumulative). Calculated as: {sim.thermal.activeITPowerMW.toFixed(1)} MW active IT × {(params.recoverableHeatFraction * 100).toFixed(0)}% capture × 88% plate HEX effectiveness × 95% delivery (5% piping loss).
                </div>
                <div>
                  <span className="text-white font-mono font-medium">Brine Saturation Audit: </span>
                  Liquid-brine TDS is bounded to the physical halite saturation threshold (~260,000 ppm TDS) to prevent membrane scaling and solid salt precipitation.
                </div>
              </div>

              {/* Model Assumptions */}
              <div className="p-3 rounded-lg bg-[#020b12] border border-white/5 text-[11px] text-slate-400 font-sans space-y-1.5">
                <div className="text-white font-mono font-medium text-xs border-b border-white/5 pb-1">
                  Model Assumptions (Deterministic Baseline):
                </div>
                <ul className="list-disc list-inside space-y-1 text-slate-400">
                  <li><span className="text-slate-300 font-mono">[Assumption]</span> Membrane coefficient Bm: 2.2 kg/m²·h·kPa</li>
                  <li><span className="text-slate-300 font-mono">[Assumption]</span> Distillate salinity: 8 ppm TDS</li>
                  <li><span className="text-slate-300 font-mono">[Assumption]</span> Saturation cap: 260,000 ppm (simplified NaCl)</li>
                  <li><span className="text-slate-300 font-mono">[Assumption]</span> Temperature polarization factor: 0.80</li>
                  <li><span className="text-slate-300 font-mono">[Assumption]</span> 100% of delivered heat available for evaporation (idealized upper-bound assumption; excludes sensible heating, conductive losses, and other thermal losses)</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
