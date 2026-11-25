import React from "react";
import { ENGINEERING_MODEL_VERSION } from "../lib/engineering";
import { ShieldCheck, Layers, FileText, AlertCircle } from "lucide-react";

export function Transparency() {
  return (
    <div 
      className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6"
      style={{ fontFamily: "'Inter', Arial, Helvetica, sans-serif" }}
    >
      <header className="pb-3 border-b border-white/10 space-y-1">
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span>PROVENANCE &amp; METHODOLOGY</span>
          <span className="text-slate-600">•</span>
          <span className="text-slate-400">v{ENGINEERING_MODEL_VERSION}</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Technical Transparency &amp; Provenance
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Deterministic mathematical engines, physical boundary conditions, and evidence classifications.
        </p>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Section title="Model Versions &amp; Deterministic Engines">
            <Item label="Model Release" value={`v${ENGINEERING_MODEL_VERSION}`} />
            <Item label="RO Mass & Salt Balance" value="RO-v2.1 (Van 't Hoff derivation & Salt Balance)" />
            <Item label="MD Vapor-Transport Engine" value="MD-v2.1 (Hollow-fiber DCMD Knudsen/Darcy)" />
            <Item label="Thermal Energy Constraint" value="Latent Heat Ceiling (2,420 kJ/kg)" />
            <Item label="Vapor Pressure Equation" value="Antoine Saturation Model (10°C - 100°C)" />
            <Item label="Saline Water Activity (aw)" value="Electrolyte correlation (0 - 260,000 ppm)" />
            <Item label="Secondary Heat Transfer" value="Titanium plate HEX (88% effectiveness)" />
          </Section>

          <Section title="Evidence & Value Classification">
            <div className="space-y-3">
               <BadgeRow type="MEASURED" desc="Physical sensor telemetry (ESP32 / ESP8266) from actual prototype hardware." color="text-emerald-400 border-emerald-500/30 bg-emerald-950/40" />
               <BadgeRow type="CALCULATED" desc="Deterministic mass and energy conservation equations solved in engineering.ts." color="text-slate-300 border-slate-700 bg-slate-800/60" />
               <BadgeRow type="MODELLED" desc="Scenario simulations parameterized to server thermal loads & cooling architectures." color="text-cyan-300 border-cyan-500/30 bg-cyan-950/40" />
               <BadgeRow type="PROJECTED" desc="Extrapolated regional and campus-scale performance figures." color="text-teal-300 border-teal-500/30 bg-teal-950/40" />
               <BadgeRow type="ASSUMED" desc="Explicitly stated operating baselines (e.g., 80% utilization, 35,000 ppm feed)." color="text-amber-300 border-amber-500/30 bg-amber-950/40" />
            </div>
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Core Thermodynamic Equations & Boundaries">
            <ul className="list-disc list-inside text-xs text-slate-300 space-y-2.5 font-mono leading-relaxed">
              <li>Nearly all IT electrical power is converted to thermal energy: P_thermal ≈ P_active (1st Law).</li>
              <li>Recoverable heat accounts for direct liquid cooling capture (70-80%), secondary HEX effectiveness (88%), and piping distribution losses (5%).</li>
              <li>Liquid coolant NEVER directly contacts saline water; an isolated secondary plate HEX provides absolute physical containment.</li>
              <li>Membrane Distillation strictly treats the concentrated RO reject stream (Q_feed_MD = Q_reject_RO), NOT raw feed.</li>
              <li>MD production is physically constrained to min(mass-transfer limit, thermal-energy ceiling, reject stream volume).</li>
              <li>Raoult-modified saline water activity (a_w) suppresses vapor pressure as brine salinity rises.</li>
            </ul>
          </Section>

          <div className="border border-cyan-500/20 bg-[#061822] p-5 rounded-2xl text-xs text-slate-400 leading-relaxed font-mono shadow-lg space-y-2">
            <div className="flex items-center gap-2 text-cyan-400 font-bold">
              <AlertCircle size={15} />
              <span>ENGINEERING TRANSPARENCY &amp; WATER QUALITY DISCLAIMER</span>
            </div>
            <p className="font-sans text-slate-300 leading-normal">
              THERMORA is an engineering modelling and resource-intelligence platform evaluating compute waste-heat recovery. The membrane distillation stage is a deterministic model estimate and is not experimentally validated.
            </p>
            <p className="font-sans text-slate-400 leading-normal">
              Output distillate is high-purity demineralized water (&lt;10 ppm TDS). Recovered water is not potable and requires site mineral balancing, treatment, and certified water-quality laboratory testing before reuse.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="border border-cyan-500/20 bg-[#061822] p-5 rounded-2xl shadow-lg space-y-3">
      <h3 className="text-xs text-cyan-400 font-bold tracking-wider uppercase border-b border-white/5 pb-2.5">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Item({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0">
      <span className="text-xs text-slate-400 font-medium">{label}</span>
      <span className="text-xs font-mono text-white">{value}</span>
    </div>
  );
}

function BadgeRow({ type, desc, color }: { type: string, desc: string, color: string }) {
  return (
    <div className="flex gap-3 items-start">
      <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase tracking-wider border ${color} w-24 text-center shrink-0 font-bold`}>
        {type}
      </span>
      <span className="text-xs text-slate-400 flex-1 pt-0.5 leading-normal">{desc}</span>
    </div>
  );
}
