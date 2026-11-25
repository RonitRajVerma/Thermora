# THERMORA — Burn Tokens. Make Water.

> **Winner — Best Hardware Project** at **HACK-DAY** (School of Computing and Artificial Intelligence, Lovely Professional University)

**THERMORA** is a thermal water-recovery system and resource-intelligence platform that captures low-grade waste heat ($\approx 50^\circ\text{C}$) from AI data centres to drive **RO + MD (Reverse Osmosis + Membrane Distillation)** on desalination reject brine—turning two massive industrial waste streams into one closed freshwater recovery loop.

---

## The Problem
* **Data Centre Waste Heat:** Global data centres consume ~485 TWh of electricity annually, rejecting vast amounts of low-grade thermal energy ($\approx 50^\circ\text{C}$) into the atmosphere.
* **Desalination Reject Brine:** Conventional Reverse Osmosis (RO) desalination plants recover ~45% of intake seawater and discharge ~55% (>150 million $\text{m}^3$/day globally) back into marine ecosystems as hyper-saline brine.

## How THERMORA Works
1. **Heat Capture:** Warm server coolant ($\approx 50^\circ\text{C}$) transfers thermal energy through an isolated heat exchanger to pre-heat RO reject brine ($\approx 47^\circ\text{C}$).
2. **Membrane Distillation (MD):** Driven by the vapour pressure gradient ($\Delta T \approx 28^\circ\text{C}$), pure water vapour passes through a hydrophobic microporous membrane (PTFE/PVDF) while concentrated salts stay behind.
3. **Condensation & Telemetry:** Vapour condenses on the cold side ($\approx 22^\circ\text{C}$) into additional recovered freshwater, monitored live via embedded temperature sensors and microcontroller telemetry.

---

## Key Features
* **Physical RO + MD Benchtop Prototype:** Functional hardware loop integrating RO filtration, circulation pumping, induction heating coils, temperature sensors, and real-time LCD telemetry.
* **Engineering & Resource Impact Model:** Models thermal recovery and freshwater yield across custom data centre IT capacities and utilization rates (~499,000 L/day additional freshwater recovery for an illustrative 80 MW facility).
* **India Opportunity Grid:** Interactive geospatial simulator mapping 9 major Indian data centre hubs (1,790 MW total capacity, 862 MWth recoverable thermal power) to evaluate coastal desalination co-location vs. inland saline-feed requirements.

---

## Tech Stack
* **Frontend & Simulator:** React, TypeScript, Vite, Tailwind CSS
* **Hardware & Embedded Telemetry:** C++, Microcontroller (Arduino/ESP32), Temperature Sensors, 16x2 LCD, RO + MD Fluid Loop

---

## Local Setup

```bash
# Install dependencies
npm install

# Configure environment variables (if using AI assistant features)
cp .env.example .env

# Run development server
npm run dev
