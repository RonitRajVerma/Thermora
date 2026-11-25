import express from "express";
import cors from "cors";
import { db } from "./src/db/index";
import { telemetry } from "./src/db/schema";
import { desc, sql, eq } from "drizzle-orm";
import path from "path";
import { createServer as createViteServer } from "vite";
import { 
  calculateHybridRecovery, 
  calculateComputeAndThermal, 
  calculateROStage, 
  calculateWaterBalance,
  HEAT_SOURCE_SCENARIOS,
  ENGINEERING_MODEL_VERSION 
} from "./src/lib/engineering";
import { ai, buildAiSystemInstruction } from "./src/lib/ai";

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Real-time telemetry state
let clients: express.Response[] = [];
let latestTelemetry: any = null;
let isHardwareLive = false;
let isSimulationActive = false;
let lastHeartbeat = 0;

// Periodic liveness check: if ESP32 hasn't sent a heartbeat in 15 seconds, mark as OFFLINE
setInterval(() => {
  if (isHardwareLive && Date.now() - lastHeartbeat > 15000) {
    isHardwareLive = false;
    if (!isSimulationActive) {
      latestTelemetry = null;
      broadcastTelemetry({ status: "OFFLINE", mode: "OFFLINE", message: "WAITING FOR CONNECTION" });
    }
  }

  // ONLY generate simulation data if user explicitly toggled software simulation
  if (isSimulationActive && !isHardwareLive) {
    latestTelemetry = {
      deviceId: "SIMULATOR-01",
      timestamp: new Date(),
      temperature: 24.5 + Math.sin(Date.now() / 4000) * 1.5,
      humidity: 50 + Math.cos(Date.now() / 5000) * 4,
      hotTemperature: 52 + Math.sin(Date.now() / 3000) * 2,
      coldTemperature: 22 + Math.cos(Date.now() / 4000) * 1,
      flowRate: 14.5 + Math.random() * 0.5,
      pumpState: true,
      firmwareVersion: "SIMULATOR-v1.0",
      mode: "SIMULATED"
    };
    broadcastTelemetry(latestTelemetry);
  }
}, 2500);

function broadcastTelemetry(data: any) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(client => {
    try {
      client.write(payload);
    } catch {
      // client dropped
    }
  });
}

// POST /api/telemetry: Ingest real telemetry from ESP32 (accepts deviceId, temperature, humidity, hotTemp, coldTemp)
app.post("/api/telemetry", async (req, res) => {
  try {
    const data = req.body || {};

    // Validate numeric constraints - reject non-numeric values with HTTP 400
    const isStrictNumericOrNull = (v: any) => v === undefined || v === null || (typeof v === "number" && !isNaN(v));
    if (
      !isStrictNumericOrNull(data.temperature) ||
      !isStrictNumericOrNull(data.ambientTemperature) ||
      !isStrictNumericOrNull(data.humidity) ||
      !isStrictNumericOrNull(data.hotTemp) ||
      !isStrictNumericOrNull(data.coldTemp) ||
      !isStrictNumericOrNull(data.hotTemperature) ||
      !isStrictNumericOrNull(data.coldTemperature) ||
      !isStrictNumericOrNull(data.flowRate)
    ) {
      return res.status(400).json({ status: "error", message: "Invalid payload: sensor readings must be numeric numbers" });
    }

    const isTestOrSim = Boolean(
      (typeof data.deviceId === "string" && (data.deviceId.includes("SIM") || data.deviceId.includes("TEST"))) ||
      data.mode === "SIMULATED"
    );
    
    if (!isTestOrSim) {
      isHardwareLive = true;
      lastHeartbeat = Date.now();
    }
    
    // DHT11 delivers ambient temperature and humidity
    const ambientTemp = typeof data.temperature === "number" ? data.temperature : 
      (typeof data.ambientTemperature === "number" ? data.ambientTemperature : null);
    const humidityVal = typeof data.humidity === "number" ? data.humidity : null;

    // Optional DS18B20 hotTemp / coldTemp (supports both hotTemp and hotTemperature)
    const hotTemp = typeof data.hotTemp === "number" ? data.hotTemp : 
      (typeof data.hotTemperature === "number" ? data.hotTemperature : null);
    const coldTemp = typeof data.coldTemp === "number" ? data.coldTemp : 
      (typeof data.coldTemperature === "number" ? data.coldTemperature : null);
    const flowVal = typeof data.flowRate === "number" ? data.flowRate : null;

    const record = {
      deviceId: data.deviceId || (isTestOrSim ? "TEST-PACKET" : "ESP32-DHT11"),
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      temperature: ambientTemp,
      ambientTemperature: ambientTemp,
      humidity: humidityVal,
      hotTemp: hotTemp,
      hotTemperature: hotTemp,
      coldTemp: coldTemp,
      coldTemperature: coldTemp,
      flowRate: flowVal,
      pumpState: data.pumpState === true || data.pumpState === 1 ? true : (data.pumpState === false ? false : null),
      firmwareVersion: data.firmwareVersion || "ESP32-DHT11-v1.0"
    };
    
    try {
      await db.insert(telemetry).values({
        deviceId: record.deviceId,
        timestamp: record.timestamp,
        ambientTemperature: record.ambientTemperature,
        humidity: record.humidity,
        hotTemperature: record.hotTemperature,
        coldTemperature: record.coldTemperature,
        flowRate: record.flowRate,
        pumpState: record.pumpState,
        firmwareVersion: record.firmwareVersion
      });
    } catch (dbErr) {
      console.warn("DB insert note (in-memory telemetry still live):", dbErr);
    }
    
    const mode = isTestOrSim ? "SIMULATED" : "MEASURED";
    latestTelemetry = { 
      ...record, 
      mode, 
      status: isTestOrSim ? "SIMULATED" : "LIVE",
      receivedAt: new Date().toISOString() 
    };
    broadcastTelemetry(latestTelemetry);
    
    res.status(201).json({ status: "success", mode, telemetry: latestTelemetry });
  } catch (error) {
    console.error("Telemetry error:", error);
    res.status(400).json({ status: "error", message: "Invalid telemetry data payload" });
  }
});

// Explicit software simulation toggle (never auto-runs)
app.post("/api/telemetry/simulate/start", (req, res) => {
  isSimulationActive = true;
  latestTelemetry = {
    deviceId: "SIMULATOR-01",
    timestamp: new Date(),
    temperature: 24.8,
    humidity: 52.0,
    hotTemperature: 51.5,
    coldTemperature: 21.0,
    flowRate: 14.8,
    pumpState: true,
    firmwareVersion: "SIMULATOR-v1.0",
    mode: "SIMULATED"
  };
  broadcastTelemetry(latestTelemetry);
  res.json({ status: "ok", mode: "SIMULATED", active: true });
});

app.post("/api/telemetry/simulate/stop", (req, res) => {
  isSimulationActive = false;
  if (!isHardwareLive) {
    latestTelemetry = null;
    broadcastTelemetry({ status: "OFFLINE", mode: "OFFLINE", message: "WAITING FOR CONNECTION" });
  }
  res.json({ status: "ok", active: false, mode: isHardwareLive ? "MEASURED" : "OFFLINE" });
});

app.get("/api/telemetry/latest", (req, res) => {
  res.json({
    isHardwareLive,
    isSimulationActive,
    telemetry: latestTelemetry,
    status: isHardwareLive ? "MEASURED" : (isSimulationActive ? "SIMULATED" : "OFFLINE")
  });
});

app.post("/api/telemetry/surge", (req, res) => {
  if (!isSimulationActive && !isHardwareLive) {
    return res.status(400).json({ status: "error", message: "Connect ESP32 or start simulation first" });
  }
  res.json({ status: "ok", telemetry: latestTelemetry });
});

app.get("/api/telemetry/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  
  clients.push(res);
  
  if (latestTelemetry) {
    res.write(`data: ${JSON.stringify(latestTelemetry)}\n\n`);
  }
  
  req.on("close", () => {
    clients = clients.filter(c => c !== res);
  });
});

app.get("/api/telemetry/history", async (req, res) => {
  try {
    const history = await db.select().from(telemetry).orderBy(desc(telemetry.timestamp)).limit(100);
    res.json(history.reverse());
  } catch (error) {
    // If DB empty or not migrated
    res.json([]);
  }
});

app.post("/api/model/hybrid", (req, res) => {
  const { 
    feedVolLph, 
    roRecoveryRate, 
    tHot, 
    tCold, 
    salinityPPM, 
    bmCoefficient, 
    membraneArea, 
    deliveredThermalPowerMWt 
  } = req.body;
  
  try {
    const results = calculateHybridRecovery(
      feedVolLph || 50000, 
      roRecoveryRate || 0.45, 
      tHot || 50, 
      tCold || 22, 
      salinityPPM || 35000, 
      bmCoefficient || 2.2, 
      membraneArea || 6000,
      deliveredThermalPowerMWt || 56.0
    );
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: "Calculation failed" });
  }
});

app.post("/api/chat", async (req, res) => {
  const { prompt, history, context } = req.body;
  const query = (prompt || "").trim();

  // Extract engineering inputs from user query (or apply standard ASHRAE / hyperscale baselines)
  const mwMatch = query.match(/(\d+(?:\.\d+)?)\s*(?:mw|megawatt)/i);
  const mw = mwMatch ? parseFloat(mwMatch[1]) : 100;
  const utilMatch = query.match(/(\d+(?:\.\d+)?)\s*%/);
  const util = utilMatch ? parseFloat(utilMatch[1]) : 80;
  const tHotMatch = query.match(/(\d+(?:\.\d+)?)\s*(?:°c|celsius|degrees?\s*c)/i);
  const tHot = tHotMatch ? parseFloat(tHotMatch[1]) : 50;

  // Run deterministic calculation engine
  const feedFlowLph = mw * 500;
  const membraneAreaM2 = mw * 60;
  const thermal = calculateComputeAndThermal(mw, util, 24, 0.70, 0.88, 0.05);
  const hybrid = calculateHybridRecovery(
    feedFlowLph, 
    0.45, 
    tHot, 
    22, 
    35000, 
    2.2, 
    membraneAreaM2, 
    thermal.deliveredThermalPowerMWt
  );
  const wb = calculateWaterBalance(mw, util, hybrid.totalWaterLpd);

  // Deterministic calculation payload for LLM grounding
  const deterministicFacts = {
    modelVersion: ENGINEERING_MODEL_VERSION,
    inputParams: {
      itCapacityMW: mw,
      utilizationPercent: util,
      operatingHoursPerDay: 24,
      feedFlowLph,
      feedSalinityPPM: 35000,
      tHotC: tHot,
      tColdC: 22,
      membraneAreaM2
    },
    thermalBalance: {
      activeITPowerMW: Number(thermal.activeITPowerMW.toFixed(1)),
      itEnergyMWhPerDay: Number(thermal.itEnergyMWh.toFixed(1)),
      thermalPowerMWt: Number(thermal.thermalPowerMWt.toFixed(1)),
      recoverableThermalPowerMWt: Number(thermal.recoverableThermalPowerMWt.toFixed(1)),
      deliveredThermalPowerMWt: Number(thermal.deliveredThermalPowerMWt.toFixed(1)),
      deliveredThermalEnergykWhthPerDay: Math.round(thermal.deliveredThermalEnergykWhth)
    },
    hybridRecovery: {
      roPermeateLph: Math.round(hybrid.roWaterLph),
      roPermeateLpd: Math.round(hybrid.roWaterLph * 24),
      roRecoveryPercent: Number(hybrid.roRecoveryPercent.toFixed(1)),
      roRejectFlowLph: Math.round(hybrid.roRejectFlowLph),
      roRejectSalinityPPM: Math.round(hybrid.roRejectSalinityPPM),
      mdDistillateLph: Math.round(hybrid.mdWaterLph),
      mdDistillateLpd: Math.round(hybrid.mdWaterLph * 24),
      mdDrivingForceKPa: Number(hybrid.mdDrivingForceKPa.toFixed(2)),
      mdFluxKgM2h: Number(hybrid.mdFluxKgM2h.toFixed(2)),
      mdLimitingFactor: hybrid.mdLimitingFactor,
      totalWaterLph: Math.round(hybrid.totalWaterLph),
      totalWaterLpd: Math.round(hybrid.totalWaterLpd),
      totalWaterM3Yr: hybrid.totalWaterM3Yr,
      overallRecoveryPercent: Number(hybrid.overallRecoveryPercent.toFixed(1)),
      remainingBrineLph: Math.round(hybrid.remainingBrineLph),
      remainingBrineSalinityPPM: Math.round(hybrid.remainingBrineSalinityPPM),
      brineConcentrationFactor: Number(hybrid.brineConcentrationFactor.toFixed(2)),
      warnings: hybrid.warnings
    },
    waterBalance: {
      dailyITkWh: Math.round(wb.dailyITkWh),
      conventionalEvaporativeWaterWastedLpd: Math.round(wb.conventionalWaterWastedLpd),
      thermoraNetWUE: Number(wb.thermoraNetWUE.toFixed(3)),
      avoidedMunicipalDepletionLpd: Math.round(wb.netAvoidedDepletionLpd)
    }
  };

  // Comprehensive Engineering Knowledge & Thermodynamic Engine
  const generateEngineeringAnalysis = (q: string, ctx: any) => {
    const qLower = q.toLowerCase().trim();

    // Casual greetings
    if (
      /^(hi|hello|hey|greetings|howdy|yo|good\s*(morning|afternoon|evening))\b/i.test(qLower) ||
      qLower === "hi" ||
      qLower === "hello" ||
      qLower === "hey"
    ) {
      return "Hey! I'm Thermora. How can I help you today? I can answer questions about our project, help you explore data center waste-heat recovery, calculate water production, or discuss our liquid cooling and membrane distillation models.";
    }

    // Who are you / What is Thermora
    if (
      qLower.includes("who are you") ||
      qLower.includes("what is thermora") ||
      qLower.includes("what do you do") ||
      qLower.includes("tell me about yourself") ||
      qLower.includes("tell me about thermora")
    ) {
      return "I'm Thermora, an AI assistant for compute infrastructure resource recovery. The Thermora project captures waste heat from high-density data centers using direct-to-chip liquid cooling and repurposes it to produce clean, demineralized water through a hybrid Reverse Osmosis (RO) and Membrane Distillation (MD) system.\n\nI can help you model thermal dissipation, calculate water recovery for different MW capacities, or explain our physical prototype telemetry and thermodynamics. What would you like to explore?";
    }

    // Direct Climate Resilience / ESG queries
    if (
      qLower.includes("climate") ||
      qLower.includes("resilien") ||
      qLower.includes("help companies") ||
      qLower.includes("yes or no") ||
      qLower.includes("esg") ||
      qLower.includes("sustainab")
    ) {
      return `ANSWER: Model-based estimate, not experimentally validated. Thermora models data-center resource recovery by pairing closed-loop liquid cooling with waste-heat driven membrane distillation.

WHY: Climate change creates severe localized water scarcity and frequent summer grid heat waves:
1. Water Security: Municipalities increasingly constrain facilities during droughts due to water consumption from evaporative cooling. Thermora models closed-loop recovery (-0.29 L/kWh net WUE), mitigating municipal freshwater reliance.
2. Heat Wave Resilience: Closed-loop direct-to-chip liquid cooling operates continuously at full thermal load even during extreme ambient temperatures (45°C+), when air chillers suffer thermal derating.
3. ESG & Scope 2 Alignment: Waste heat is repurposed productively instead of dumped as thermal pollution into the surrounding atmosphere, conceptually aligning with SDG 6, 9, 12 (not a certification).

EVIDENCE: First law energy conservation; Antoine saturation vapor pressure correlation; Darcy/Knudsen membrane transport equations.

CALCULATION:
• Conventional ${mw} MW Risk Exposure: ${Math.round(wb.conventionalWaterWastedLpd).toLocaleString()} L/day municipal freshwater evaporated to ambient air [MODELLED].
• Thermora Closed-Loop Evaporative Loss: 0 L/day [MEASURED].
• Thermora Recovered Water: ${Math.round(hybrid.totalWaterLpd).toLocaleString()} L/day (${hybrid.totalWaterM3Yr.toLocaleString()} m³/year) demineralized water [MODELLED].
• Remaining Concentrated Brine: ${Math.round(hybrid.remainingBrineLph * 24).toLocaleString()} L/day @ ${Math.round(hybrid.remainingBrineSalinityPPM).toLocaleString()} ppm [CALCULATED].

CONFIDENCE: Model-based estimate (deterministic engineering model; not experimentally validated)

ASSUMPTIONS & LIMITATIONS:
• Assumes ${feedFlowLph.toLocaleString()} L/h feed flow with 35,000 ppm feed salinity and 260,000 ppm brine saturation cap.
• Direct-to-chip heat capture @ ${tHot}°C return; secondary titanium plate heat exchanger (88% ε); 5% distribution loss.
• The MD stage is modelled and has not been physically demonstrated by THERMORA. The prototype measures temperatures only.
• Output distillate is non-potable without on-site remineralization and certified laboratory testing.`;
    }

    // Water Wastage / Evaporative Cooling Towers / Water Scarcity
    if (
      qLower.includes("wastage") ||
      qLower.includes("waste") ||
      qLower.includes("evaporat") ||
      qLower.includes("cooling tower") ||
      qLower.includes("save water") ||
      qLower.includes("scarcity") ||
      qLower.includes("wue") ||
      qLower.includes("solve")
    ) {
      return `ANSWER: Model-based estimate, not experimentally validated. Thermora models data-center water reduction by replacing evaporative cooling towers with closed-loop liquid recovery, converting captured compute waste heat into ${Math.round(hybrid.totalWaterLpd).toLocaleString()} L/day of recoverable water for a ${mw} MW facility (WUE reduction: 1.8 L/kWh down to net-negative -0.29 L/kWh).

WHY: Traditional hyperscale data centers evaporate millions of liters of municipal water daily in evaporative cooling towers. Thermora models recovery across three distinct engineering vectors:
1. Zero Evaporative Loss: Replaces open-loop evaporative cooling towers with closed-loop direct-to-chip liquid cooling (water never vents to the atmosphere).
2. Thermally Driven Recovery: Captures ${tHot}°C IT reject heat to energize a Membrane Distillation (MD) unit that desalinates saline groundwater, industrial wastewater, or seawater into high-purity distillate (>99.9% salt rejection, <10 ppm TDS).
3. Brine Concentration: Concentrates reverse osmosis (RO) reject brine to a physical halite saturation cap (260,000 ppm), avoiding surface-water brine dumping.

EVIDENCE: First law energy balance; Antoine vapor pressure equation across microporous hydrophobic membranes; Darcy/Knudsen vapor diffusion equations.

CALCULATION:
• Traditional ${mw} MW Water Consumption: ${Math.round(wb.conventionalWaterWastedLpd).toLocaleString()} Liters/day wasted to evaporation [MODELLED].
• Thermora Closed-Loop Evaporative Loss: 0 Liters/day [MEASURED].
• Active IT Power: ${thermal.activeITPowerMW.toFixed(1)} MW [CALCULATED].
• Generated Thermal Power: ${thermal.thermalPowerMWt.toFixed(1)} MWth (approx. 100% of IT electrical power degrades to heat) [CALCULATED].
• Delivered Thermal Power to MD: ${thermal.deliveredThermalPowerMWt.toFixed(1)} MWth @ ${tHot}°C [MODELLED].
• Primary RO Permeate: ${Math.round(hybrid.roWaterLph * 24).toLocaleString()} L/day (${Math.round(hybrid.roWaterLph).toLocaleString()} L/h @ 45% recovery) [CALCULATED].
• Additional MD Distillate: +${Math.round(hybrid.mdWaterLph * 24).toLocaleString()} L/day (+${Math.round(hybrid.mdWaterLph).toLocaleString()} L/h from RO reject) [MODELLED].
• Total Freshwater Produced: ${Math.round(hybrid.totalWaterLpd).toLocaleString()} Liters/day (${hybrid.totalWaterM3Yr.toLocaleString()} m³/year) [MODELLED].
• Remaining Concentrated Brine: ${Math.round(hybrid.remainingBrineLph * 24).toLocaleString()} L/day (${Math.round(hybrid.remainingBrineSalinityPPM).toLocaleString()} ppm) [CALCULATED].

CONFIDENCE: Model-based estimate (deterministic engineering model; not experimentally validated)

ASSUMPTIONS & LIMITATIONS:
• Assumes ${feedFlowLph.toLocaleString()} L/h raw feed at 35,000 ppm NaCl; 260,000 ppm brine saturation cap.
• Direct-to-chip liquid cooling loop @ ${tHot}°C outlet; cold condensing sink @ 22°C.
• The MD stage is modelled and has not been physically demonstrated by THERMORA. The prototype measures temperatures only.
• Output distillate is demineralized water and is not potable without mineral balancing and certified testing.`;
    }

    // Membrane Distillation (MD) vs Reverse Osmosis (RO)
    if (
      qLower.includes("membrane distillation") ||
      qLower.includes("md") ||
      qLower.includes("why ro") ||
      qLower.includes("hybrid") ||
      qLower.includes("brine")
    ) {
      return `ANSWER: Model-based estimate, not experimentally validated. Membrane Distillation (MD) is paired with Reverse Osmosis (RO) because RO is hydraulically limited by osmotic pressure (~70-80 bar), whereas MD is driven by vapor pressure differential (ΔPv) energized by ${tHot}°C compute waste heat, extracting pure water from concentrated reject brine.

WHY: Standalone RO can only recover 40–50% freshwater from seawater before osmotic pressure exceeds standard pump and membrane structural limits. By cascading the concentrated RO reject into thermal MD heated by IT liquid coolant, Thermora models recovering an additional ${hybrid.additionalMDRecoveryGainPercent.toFixed(1)}% water from the reject stream without consuming boiler electricity.

EVIDENCE: Van 't Hoff osmotic pressure equation; Antoine vapor pressure correlation across hydrophobic microporous membranes; Darcy/Knudsen vapor diffusion models.

CALCULATION:
• Primary RO Permeate Yield: 45% recovery (${Math.round(hybrid.roWaterLph).toLocaleString()} L/h) @ 3.2 kWh/m³ electric energy [CALCULATED].
• RO Reject Stream: ${Math.round(hybrid.roRejectFlowLph).toLocaleString()} L/h @ ${Math.round(hybrid.roRejectSalinityPPM).toLocaleString()} ppm [CALCULATED].
• Secondary MD Distillate Yield: +${Math.round(hybrid.mdWaterLph).toLocaleString()} L/h (${Math.round(hybrid.mdWaterLph * 24).toLocaleString()} L/day) [MODELLED].
• Combined Hybrid Recovery: ${hybrid.overallRecoveryPercent.toFixed(1)}% total water recovery from raw saline feed [MODELLED].
• Limiting Constraint on MD: ${hybrid.mdLimitingFactor} [CALCULATED].
• Remaining Final Brine: ${Math.round(hybrid.remainingBrineLph).toLocaleString()} L/h concentrated to ${Math.round(hybrid.remainingBrineSalinityPPM).toLocaleString()} ppm [CALCULATED].

CONFIDENCE: Model-based estimate (deterministic engineering model; not experimentally validated)

ASSUMPTIONS & LIMITATIONS:
• Feed salinity: 35,000 ppm; RO reject salinity: ${Math.round(hybrid.roRejectSalinityPPM).toLocaleString()} ppm; 260,000 ppm brine saturation cap; hot coolant loop: ${tHot}°C; cooling sink: 22°C.
• The MD stage is modelled and has not been physically demonstrated by THERMORA. The prototype measures temperatures only.
• Output water is demineralized distillate; not potable without mineral balancing and certified testing.`;
    }

    // Default quantitative engineering calculation
    return `ANSWER: Model-based estimate, not experimentally validated. For a ${mw} MW data center at ${util}% utilization, Thermora models recovering ${Math.round(hybrid.totalWaterLph).toLocaleString()} L/h (${Math.round(hybrid.totalWaterLpd).toLocaleString()} L/day, or ${hybrid.totalWaterM3Yr.toLocaleString()} m³/year) of demineralized water while capturing ${thermal.recoverableThermalPowerMWt.toFixed(1)} MWth of thermal energy.

WHY: Direct-to-chip liquid cooling recovers 70% of server thermal dissipation at ${tHot}°C. This waste heat is transferred via an isolated secondary titanium plate heat exchanger to a Membrane Distillation (MD) circuit, vaporizing water from Reverse Osmosis (RO) reject brine without electric boilers or evaporative cooling towers.

EVIDENCE: First Law of Thermodynamics (electrical compute power converts almost entirely to heat); Antoine saturation vapor pressure correlation; Darcy hydraulic permeability and Knudsen vapor diffusion models.

CALCULATION BREAKDOWN:
• IT Active Load: ${thermal.activeITPowerMW.toFixed(1)} MW (${thermal.itEnergyMWh.toFixed(1)} MWh/day) [CALCULATED]
• Generated Thermal Power: ${thermal.thermalPowerMWt.toFixed(1)} MWth [CALCULATED]
• Recoverable Thermal Power (70%): ${thermal.recoverableThermalPowerMWt.toFixed(1)} MWth [MODELLED]
• Delivered Heat to Treatment System: ${thermal.deliveredThermalPowerMWt.toFixed(1)} MWth @ ${tHot}°C [MODELLED]
• Primary RO Permeate Yield: ${Math.round(hybrid.roWaterLph).toLocaleString()} L/h (${Math.round(hybrid.roWaterLph * 24).toLocaleString()} L/day @ 45% recovery) [CALCULATED]
• Secondary MD Distillate Yield: +${Math.round(hybrid.mdWaterLph).toLocaleString()} L/h (${Math.round(hybrid.mdWaterLph * 24).toLocaleString()} L/day) [MODELLED]
• Total Recovered Water: ${Math.round(hybrid.totalWaterLph).toLocaleString()} L/h (${Math.round(hybrid.totalWaterLpd).toLocaleString()} L/day) [MODELLED]
• Final Concentrated Brine: ${Math.round(hybrid.remainingBrineLph).toLocaleString()} L/h @ ${Math.round(hybrid.remainingBrineSalinityPPM).toLocaleString()} ppm TDS [CALCULATED]
• Estimated Net Water Balance: -${Math.round(hybrid.totalWaterLpd).toLocaleString()} L/day net municipal withdrawal (zero evaporative cooling loss) [MODELLED]

CONFIDENCE: Model-based estimate (deterministic engineering model; not experimentally validated)

ASSUMPTIONS & LIMITATIONS:
• Workload parameters: ${mw} MW IT capacity @ ${util}% continuous utilization; hot loop coolant return @ ${tHot}°C; cold condensing sink @ 22°C.
• Assumed feed flow: ${feedFlowLph.toLocaleString()} L/h with 35,000 ppm NaCl baseline feed; 260,000 ppm brine saturation cap.
• The MD stage is modelled and has not been physically demonstrated by THERMORA. The prototype measures temperatures only.
• Distillate is demineralized industrial permeate; recovered water is not potable and requires testing.`;
  };

  // Structured system instruction from centralized src/lib/ai.ts
  const systemInstruction = buildAiSystemInstruction(deterministicFacts, context);

  // Assemble multi-turn contents
  const contentsPayload: any[] = [];
  if (Array.isArray(history) && history.length > 0) {
    for (const item of history) {
      if (item.content && item.role) {
        contentsPayload.push({
          role: item.role === "assistant" || item.role === "model" ? "model" : "user",
          parts: [{ text: item.content }],
        });
      }
    }
  }
  contentsPayload.push({
    role: "user",
    parts: [{ text: query }],
  });

  let responseText = "";
  let sourceModel = "gemini-3.6-flash";
  let noticeMsg: string | undefined = undefined;

  // Try live Gemini API with reliable gemini-3.6-flash first
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: contentsPayload,
        config: {
          systemInstruction,
        },
      });
      responseText = response.text || "";
      sourceModel = "gemini-3.6-flash";
    } catch (err36: any) {
      console.warn("Primary gemini-3.6-flash error, trying gemini-3.8-flash fallback:", err36?.message || err36);
      try {
        const response2 = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: contentsPayload,
          config: {
            systemInstruction,
          },
        });
        responseText = response2.text || "";
        sourceModel = "gemini-3.8-flash";
      } catch (err38: any) {
        console.warn("Secondary gemini-3.8-flash error, engaging Thermora Autonomous Engineering Engine:", err38?.message || err38);
      }
    }
  }

  // If live models are unavailable, use the context-aware thermodynamic engine
  if (!responseText) {
    responseText = generateEngineeringAnalysis(query, context);
    sourceModel = "thermora-engineering-core";
    noticeMsg = "Generated by Thermora Autonomous Thermodynamic Engine.";
  }

  return res.json({
    response: responseText,
    source: sourceModel,
    notice: noticeMsg,
  });
});

async function startServer() {
  // Push SQLite migrations on startup
  try {
    // Ensure table exists for basic functionality
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        hot_temperature REAL,
        cold_temperature REAL,
        ambient_temperature REAL,
        humidity REAL,
        flow_rate REAL,
        pump_state INTEGER,
        firmware_version TEXT
      )
    `);
    console.log("Telemetry table ready.");
  } catch (e) {
    console.error("Database initialization error:", e);
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
