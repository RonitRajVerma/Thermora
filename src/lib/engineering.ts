// Engineering models and thermodynamic engines for THERMORA
// Resource intelligence & mass/energy balance for compute infrastructure waste-heat recovery

export const ENGINEERING_MODEL_VERSION = "2.1.0-deterministic";

export interface ITEnergyResult {
  activeITPowerMW: number;         // Active compute power (MW) [CALCULATED]
  itEnergyMWh: number;             // IT electrical energy over time period (MWh) [CALCULATED]
  thermalPowerMWt: number;         // First-order thermal dissipation rate (MWth) [CALCULATED]
  thermalEnergyMWhth: number;      // First-order thermal energy over time period (MWhth) [CALCULATED]
  recoverableThermalPowerMWt: number; // Thermal power captured by cooling loop (MWth) [MODELLED]
  deliveredThermalPowerMWt: number;   // Thermal power transferred via secondary HEX to MD (MWth) [MODELLED]
  deliveredThermalEnergykWhth: number;// Delivered thermal energy in period (kWhth) [CALCULATED]
  deliveredThermalEnergyMWhth: number;// Delivered thermal energy in period (MWhth/day) [CALCULATED]
}

export interface HeatSourceScenario {
  id: string;
  name: string;
  typicalSupplyTempC: number;
  typicalReturnTempC: number;
  captureFraction: number;
  description: string;
}

export const HEAT_SOURCE_SCENARIOS: HeatSourceScenario[] = [
  {
    id: "dlc-coldplate",
    name: "Direct Liquid Cooling (Cold Plate)",
    typicalSupplyTempC: 32,
    typicalReturnTempC: 50,
    captureFraction: 0.72,
    description: "Direct-to-chip copper microchannel cold plates capturing primary CPU/GPU heat."
  },
  {
    id: "immersion-single",
    name: "Single-Phase Immersion Cooling",
    typicalSupplyTempC: 35,
    typicalReturnTempC: 55,
    captureFraction: 0.82,
    description: "Dielectric fluid bath submersion capturing chassis, memory, and VRM heat."
  },
  {
    id: "facility-loop",
    name: "Facility Warm-Water Loop (ASHRAE W4)",
    typicalSupplyTempC: 30,
    typicalReturnTempC: 45,
    captureFraction: 0.58,
    description: "Building-level heat recovery loop before secondary dry cooling rejection."
  },
  {
    id: "rear-door-hx",
    name: "Rear-Door Heat Exchanger (RDHx)",
    typicalSupplyTempC: 25,
    typicalReturnTempC: 42,
    captureFraction: 0.50,
    description: "Air-to-liquid passive/active coil mounted on server rack exhaust doors."
  }
];

/**
 * C1. Compute and Thermal Model
 * P_active = P_IT * (utilization / 100)
 * First-order assumption: Nearly all electrical energy to IT silicon degrades into thermal heat (1st Law).
 * Delivered heat accounts for:
 * - Heat capture fraction (eta_capture)
 * - Heat exchanger effectiveness (epsilon_HEX)
 * - Piping and distribution thermal loss fraction (loss_fraction)
 */
export function calculateComputeAndThermal(
  itCapacityMW: number,
  utilizationPercent: number,
  operatingHours: number = 24,
  heatCaptureFraction: number = 0.70,
  hexEffectiveness: number = 0.88,
  distributionLossFraction: number = 0.05
): ITEnergyResult {
  const boundedCapacity = Math.max(0.1, itCapacityMW);
  const boundedUtilization = Math.min(100, Math.max(5, utilizationPercent)) / 100;
  const boundedHours = Math.max(0.1, operatingHours);

  // Electrical compute power & energy
  const activeITPowerMW = boundedCapacity * boundedUtilization;
  const itEnergyMWh = activeITPowerMW * boundedHours;

  // Thermal dissipation (approx. 98-100% of electrical power becomes heat)
  const thermalPowerMWt = activeITPowerMW;
  const thermalEnergyMWhth = itEnergyMWh;

  // Thermal power captured by primary liquid loop
  const recoverableThermalPowerMWt = thermalPowerMWt * Math.min(1.0, Math.max(0.1, heatCaptureFraction));

  // Delivered thermal power across isolated secondary titanium plate heat exchanger (never direct saline contact)
  const deliveredThermalPowerMWt = recoverableThermalPowerMWt * 
    Math.min(0.99, Math.max(0.4, hexEffectiveness)) * 
    (1 - Math.min(0.3, Math.max(0.0, distributionLossFraction)));

  const deliveredThermalEnergykWhth = deliveredThermalPowerMWt * boundedHours * 1000;
  const deliveredThermalEnergyMWhth = deliveredThermalPowerMWt * boundedHours;

  return {
    activeITPowerMW,
    itEnergyMWh,
    thermalPowerMWt,
    thermalEnergyMWhth,
    recoverableThermalPowerMWt,
    deliveredThermalPowerMWt,
    deliveredThermalEnergykWhth,
    deliveredThermalEnergyMWhth
  };
}

/**
 * Backward compatibility helpers
 */
export function calculateITEnergy(maxPowerMW: number, utilizationPercent: number, hours: number = 24): number {
  return maxPowerMW * (utilizationPercent / 100) * hours;
}

export function calculateThermalEnergy(energyIT: number): number {
  return energyIT;
}

export function calculateRecoverableHeat(thermalEnergy: number, recoverableFraction: number = 0.70): number {
  return thermalEnergy * recoverableFraction;
}


/**
 * C3. Saturation Vapor Pressure of Water via Antoine Equation
 * P_sat in kPa. Valid range: 10°C to 100°C.
 * Correlation parameters: A = 8.07131, B = 1730.63, C = 233.426 (T in °C, P in mmHg)
 */
export function calculateVaporPressure(T_celsius: number): number {
  if (T_celsius < 5 || T_celsius > 100) {
    // Extrapolate safely or clamp to physical water phase
    const clampedT = Math.min(100, Math.max(5, T_celsius));
    const p_mmHg = Math.pow(10, 8.07131 - (1730.63 / (233.426 + clampedT)));
    return p_mmHg * 0.133322;
  }
  const p_mmHg = Math.pow(10, 8.07131 - (1730.63 / (233.426 + T_celsius)));
  return p_mmHg * 0.133322; // Convert mmHg to kPa
}

/**
 * C3. Saline Water Activity (a_w) and Vapor Pressure Suppression
 * For saline brines (e.g., seawater to hyper-concentrated RO reject), dissolved ions suppress vapor pressure.
 * Documented electrolyte correlation for NaCl aqueous solution up to saturation (~260,000 ppm):
 * a_w = 1 - (5.7e-7 * S) - (1.2e-12 * S^2)
 * At 35,000 ppm (seawater): a_w ~ 0.978
 * At 70,000 ppm (RO reject): a_w ~ 0.954
 * At 140,000 ppm (concentrated reject): a_w ~ 0.896
 */
export function calculateWaterActivity(salinityPPM: number): number {
  const S = Math.max(0, Math.min(260000, salinityPPM));
  const aw = 1.0 - (5.7e-7 * S) - (1.2e-12 * S * S);
  return Math.max(0.75, Math.min(1.0, aw));
}

export function calculateSalineVaporPressure(T_celsius: number, salinityPPM: number): number {
  const pSat = calculateVaporPressure(T_celsius);
  const aw = calculateWaterActivity(salinityPPM);
  return pSat * aw;
}

/**
 * C3. MD Driving Force (Delta P_v) across hydrophobic microporous membrane
 * Accounts for bulk-to-membrane interface temperature polarization (TPF ~ 0.75-0.85)
 */
export function calculateMDDrivingForce(
  tHotBulk: number,
  tColdBulk: number,
  feedSalinityPPM: number,
  tpf: number = 0.80
): { deltaPvKPa: number; pHotKPa: number; pColdKPa: number; tHotMembrane: number; tColdMembrane: number } {
  // Temperature polarization reduces driving Delta T at membrane boundary
  const deltaTBulk = Math.max(0, tHotBulk - tColdBulk);
  const deltaTMembrane = deltaTBulk * Math.min(1.0, Math.max(0.4, tpf));
  
  const tMean = (tHotBulk + tColdBulk) / 2;
  const tHotMembrane = tMean + (deltaTMembrane / 2);
  const tColdMembrane = tMean - (deltaTMembrane / 2);

  const pHot = calculateSalineVaporPressure(tHotMembrane, feedSalinityPPM);
  const pCold = calculateVaporPressure(tColdMembrane);
  const deltaPv = Math.max(0, pHot - pCold);

  return {
    deltaPvKPa: deltaPv,
    pHotKPa: pHot,
    pColdKPa: pCold,
    tHotMembrane,
    tColdMembrane
  };
}

/**
 * C3. Membrane Distillation Flux Calculation
 * J = B_m * Delta P_v
 * B_m (membrane permeability coefficient): default 2.2 kg/(m²·h·kPa)
 * Provenance: Literature-derived for hydrophobic PTFE hollow fiber / flat sheet (pore size ~0.2 µm, porosity ~80%)
 */
export function calculateMDFlux(
  deltaPvKPa: number,
  bmCoefficient: number = 2.2
): number {
  return Math.max(0, bmCoefficient * deltaPvKPa); // kg/(m²·h)
}

/**
 * C2. Reverse Osmosis Mass & Salt Balance
 * Q_feed = Q_permeate + Q_reject
 * C_feed * Q_feed = C_permeate * Q_permeate + C_reject * Q_reject
 * Salt rejection R_salt (typically 0.990 - 0.998 for seawater RO)
 */
export interface ROResult {
  feedFlowLph: number;
  permeateFlowLph: number;
  rejectFlowLph: number;
  recoveryRatio: number;
  saltRejectionRatio: number;
  feedSalinityPPM: number;
  permeateSalinityPPM: number;
  rejectSalinityPPM: number;
  roSpecificEnergyKWhPerM3: number;
  roPumpingPowerKW: number;
}

export function calculateROStage(
  feedFlowLph: number,
  recoveryRatio: number = 0.45,
  feedSalinityPPM: number = 35000,
  saltRejectionRatio: number = 0.995,
  secKWhPerM3: number = 3.2
): ROResult {
  const boundedFeed = Math.max(10, feedFlowLph);
  // Physical safety bounds on RO recovery
  const boundedRecovery = Math.min(0.65, Math.max(0.10, recoveryRatio));
  const boundedRejection = Math.min(0.999, Math.max(0.90, saltRejectionRatio));
  const boundedSalinity = Math.max(500, feedSalinityPPM);

  const permeateFlowLph = boundedFeed * boundedRecovery;
  const rejectFlowLph = boundedFeed - permeateFlowLph;

  // Salt balance
  const permeateSalinityPPM = boundedSalinity * (1 - boundedRejection);
  const rejectSalinityPPM = rejectFlowLph > 0
    ? (boundedFeed * boundedSalinity - permeateFlowLph * permeateSalinityPPM) / rejectFlowLph
    : boundedSalinity;

  // RO electrical power (kW) = (permeate m3/h) * SEC (kWh/m3)
  const permeateM3h = permeateFlowLph / 1000;
  const roPumpingPowerKW = permeateM3h * secKWhPerM3;

  return {
    feedFlowLph: boundedFeed,
    permeateFlowLph,
    rejectFlowLph,
    recoveryRatio: boundedRecovery,
    saltRejectionRatio: boundedRejection,
    feedSalinityPPM: boundedSalinity,
    permeateSalinityPPM,
    rejectSalinityPPM,
    roSpecificEnergyKWhPerM3: secKWhPerM3,
    roPumpingPowerKW
  };
}

/**
 * C4. Coupled Hybrid RO + MD Mass and Energy Balance
 * MD strictly treats the RO reject stream (Q_feed_MD = Q_reject_RO)
 * MD production is constrained by the strict THERMAL CEILING (available heat / latent heat of vaporisation)
 * and available reject flow.
 */
export interface HybridRecoveryResult {
  // Backward-compatible aliases
  feedLph: number;
  mdFlux: number;
  roConcentrateLph: number;
  roConcentrateSalinityPPM: number;

  // Feed & Stage 1 RO
  feedFlowLph: number;
  feedSalinityPPM: number;
  roWaterLph: number;
  roRecoveryPercent: number;
  roRejectFlowLph: number;
  roRejectSalinityPPM: number;
  roPermeateSalinityPPM: number;
  roSpecificEnergyKWhPerM3: number;

  // Stage 2 MD (Vapor-Pressure & Thermal Limits)
  mdDrivingForceKPa: number;
  mdFluxKgM2h: number;
  mdMembraneAreaM2: number;
  mdMassTransferLimitedLph: number;
  mdThermalEnergyLimitLph: number;
  mdSaturationLimitLph: number;
  mdFeedLimitLph: number;
  mdLimitingFactor: "MASS_TRANSFER" | "THERMAL_ENERGY" | "SALT_SATURATION" | "REJECT_FEED_CAP";
  mdWaterLph: number;
  mdDistillateSalinityPPM: number;
  tHotC: number;
  tColdC: number;

  // Combined Recovery
  totalWaterLph: number;
  totalWaterLpd: number;
  totalWaterM3Yr: number;
  overallRecoveryPercent: number;
  additionalMDRecoveryGainPercent: number;

  // Final Concentrated Brine
  remainingBrineLph: number;
  remainingBrineSalinityPPM: number;
  brineConcentrationFactor: number;

  // Energy & Thermal Metrics
  deliveredThermalPowerMWt: number;
  thermalEnergyUsedKWt: number;
  auxiliaryPumpPowerKW: number;

  // Engineering warnings & condition checks
  warnings: string[];
}

export function calculateHybridRecovery(
  feedFlowLph: number,
  roRecoveryRate: number = 0.45,
  tHotC: number = 50,
  tColdC: number = 22,
  feedSalinityPPM: number = 35000,
  bmCoefficient: number = 2.2,
  membraneAreaM2: number = 6000,
  deliveredThermalPowerMWt: number = 56.0,
  roSaltRejection: number = 0.995,
  roSEC: number = 3.2
): HybridRecoveryResult {
  const warnings: string[] = [];

  // Stage 1: Reverse Osmosis
  const ro = calculateROStage(feedFlowLph, roRecoveryRate, feedSalinityPPM, roSaltRejection, roSEC);

  // Stage 2: Membrane Distillation treating the RO reject
  const drivingForceData = calculateMDDrivingForce(tHotC, tColdC, ro.rejectSalinityPPM);
  const flux = calculateMDFlux(drivingForceData.deltaPvKPa, bmCoefficient);
  
  // 1. Mass-transfer limit based on membrane area and flux
  const massTransferLimitLph = flux * Math.max(1, membraneAreaM2);

  // 2. Thermal Energy Ceiling (Latent Heat of Vaporisation)
  // Water vaporization enthalpy ~ 2380 kJ/kg @ 50°C + sensible heating (~4.18 kJ/kg·K * deltaT)
  // Total specific thermal heat required: q_th ~ 2420 kJ/kg = 0.672 kWh_th / kg
  const specificThermalEnergyKJPerKg = 2420;
  const availableThermalPowerKWt = Math.max(0, deliveredThermalPowerMWt) * 1000;
  // Maximum distillate flow sustainable by thermal heat:
  // m_dot = (P_th [kW] * 3600 [s/h]) / q_th [kJ/kg]
  const thermalEnergyLimitLph = availableThermalPowerKWt > 0
    ? (availableThermalPowerKWt * 3600) / specificThermalEnergyKJPerKg
    : 0;

  // 3. Salt saturation & precipitation limit (~260,000 ppm / 26 wt% halite solubility at 40-60°C)
  // Standard liquid-phase membrane distillation cannot operate on crystallizing slurries without
  // immediate crystallization fouling, scaling, pore wetting, and physical channel blockage.
  // Maximum distillate extraction before reaching liquid salt saturation (260,000 ppm TDS):
  const MAX_LIQUID_SALINITY_PPM = 260000;
  const mdSaturationLimitLph = ro.rejectSalinityPPM < MAX_LIQUID_SALINITY_PPM
    ? Math.max(0, ro.rejectFlowLph * (1 - (ro.rejectSalinityPPM / MAX_LIQUID_SALINITY_PPM)))
    : 0;

  // 4. Reject feed boundary: hydraulic cap (maximum 90% of reject stream)
  const maxSafeRejectEvaporation = ro.rejectFlowLph * 0.90;

  // Actual MD production is the MINIMUM of the physical constraints
  let mdProductionLph = massTransferLimitLph;
  let limitingFactor: "MASS_TRANSFER" | "THERMAL_ENERGY" | "SALT_SATURATION" | "REJECT_FEED_CAP" = "MASS_TRANSFER";

  if (thermalEnergyLimitLph < mdProductionLph) {
    mdProductionLph = thermalEnergyLimitLph;
    limitingFactor = "THERMAL_ENERGY";
  }

  if (mdSaturationLimitLph < mdProductionLph) {
    mdProductionLph = mdSaturationLimitLph;
    limitingFactor = "SALT_SATURATION";
  }

  if (maxSafeRejectEvaporation < mdProductionLph) {
    mdProductionLph = maxSafeRejectEvaporation;
    limitingFactor = "REJECT_FEED_CAP";
  }

  // Engineering sanity checks & warnings
  if (tHotC - tColdC < 10) {
    warnings.push("Low thermal driving head (ΔT < 10°C): Sub-optimal vapor pressure differential.");
  }
  if (tHotC < 40) {
    warnings.push("Hot loop temperature below 40°C: MD efficiency severely reduced at low vapor pressures.");
  }
  if (ro.rejectSalinityPPM > 120000) {
    warnings.push("High RO reject salinity (>120,000 ppm): Monitor for antiscalant requirements or gypsum precipitation.");
  }
  if (limitingFactor === "THERMAL_ENERGY") {
    warnings.push("Thermally constrained: Distillate output is limited by available data-center waste heat.");
  }
  if (limitingFactor === "SALT_SATURATION") {
    warnings.push("Salt saturation cap reached (~260,000 ppm, simplified). MD output is capped by brine chemistry, not by heat.");
  }

  // Distillate water quality: high thermal vapor selectivity (<10 ppm TDS)
  const mdDistillateSalinityPPM = 8.0;

  // Combined yields
  const totalWaterLph = ro.permeateFlowLph + mdProductionLph;
  const totalWaterLpd = totalWaterLph * 24;
  const totalWaterM3Yr = Math.round((totalWaterLpd * 365) / 1000);
  const overallRecoveryPercent = (totalWaterLph / ro.feedFlowLph) * 100;
  const additionalMDRecoveryGainPercent = (mdProductionLph / ro.feedFlowLph) * 100;

  // Final remaining concentrated brine (strictly liquid phase, mass-balanced)
  const remainingBrineLph = Math.max(0, ro.rejectFlowLph - mdProductionLph);
  const finalBrineSalinityPPM = remainingBrineLph > 0
    ? Math.min(MAX_LIQUID_SALINITY_PPM, (ro.rejectFlowLph * ro.rejectSalinityPPM - mdProductionLph * mdDistillateSalinityPPM) / remainingBrineLph)
    : MAX_LIQUID_SALINITY_PPM;

  if (finalBrineSalinityPPM >= 250000) {
    warnings.push("Brine concentration at saturation limit (~260,000 ppm TDS): Operating at liquid-phase boundary. Zero Liquid Discharge (ZLD) crystallizer required for any further recovery.");
  }

  const brineConcentrationFactor = ro.feedSalinityPPM > 0
    ? finalBrineSalinityPPM / ro.feedSalinityPPM
    : 1;

  // Actual thermal power consumed by vaporization (kWt)
  const thermalEnergyUsedKWt = (mdProductionLph * specificThermalEnergyKJPerKg) / 3600;

  // Auxiliary pumping energy for MD recirculation loop (~0.5 - 0.8 kWh/m3)
  const auxiliaryPumpPowerKW = (mdProductionLph / 1000) * 0.65;

  return {
    feedLph: ro.feedFlowLph,
    mdFlux: flux,
    roConcentrateLph: ro.rejectFlowLph,
    roConcentrateSalinityPPM: ro.rejectSalinityPPM,

    feedFlowLph: ro.feedFlowLph,
    feedSalinityPPM: ro.feedSalinityPPM,
    roWaterLph: ro.permeateFlowLph,
    roRecoveryPercent: ro.recoveryRatio * 100,
    roRejectFlowLph: ro.rejectFlowLph,
    roRejectSalinityPPM: ro.rejectSalinityPPM,
    roPermeateSalinityPPM: ro.permeateSalinityPPM,
    roSpecificEnergyKWhPerM3: ro.roSpecificEnergyKWhPerM3,

    mdDrivingForceKPa: drivingForceData.deltaPvKPa,
    mdFluxKgM2h: flux,
    mdMembraneAreaM2: membraneAreaM2,
    mdMassTransferLimitedLph: massTransferLimitLph,
    mdThermalEnergyLimitLph: thermalEnergyLimitLph,
    mdSaturationLimitLph,
    mdFeedLimitLph: maxSafeRejectEvaporation,
    mdLimitingFactor: limitingFactor,
    mdWaterLph: mdProductionLph,
    mdDistillateSalinityPPM,
    tHotC,
    tColdC,

    totalWaterLph,
    totalWaterLpd,
    totalWaterM3Yr,
    overallRecoveryPercent,
    additionalMDRecoveryGainPercent,

    remainingBrineLph,
    remainingBrineSalinityPPM: finalBrineSalinityPPM,
    brineConcentrationFactor,

    deliveredThermalPowerMWt,
    thermalEnergyUsedKWt,
    auxiliaryPumpPowerKW,

    warnings
  };
}

/**
 * E. Water Usage Effectiveness (WUE) & Water Balance
 * WUE = Annual Site Water Use (L) / Annual IT Energy (kWh)
 * Standard evaporative cooling tower baseline: ~1.8 L/kWh
 * Closed-loop direct liquid cooling: 0 L/kWh evaporative loss
 */
export function calculateWaterBalance(
  itCapacityMW: number,
  utilizationPercent: number,
  waterProducedLpd: number,
  coolingTowerWUEBaseline: number = 1.8
) {
  const dailyITkWh = itCapacityMW * 1000 * (utilizationPercent / 100) * 24;
  const conventionalWaterWastedLpd = dailyITkWh * coolingTowerWUEBaseline;
  const netAvoidedDepletionLpd = conventionalWaterWastedLpd + waterProducedLpd;
  const thermoraNetWUE = dailyITkWh > 0
    ? (0 - waterProducedLpd) / dailyITkWh // Net water negative (water positive)
    : 0;

  return {
    dailyITkWh,
    conventionalWaterWastedLpd,
    waterProducedLpd,
    netAvoidedDepletionLpd,
    thermoraNetWUE
  };
}
