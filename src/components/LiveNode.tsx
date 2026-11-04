import React, { useState, useEffect } from "react";
import { useTelemetry } from "../hooks/useTelemetry";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { format } from "date-fns";
import { 
  Wifi, 
  WifiOff, 
  Copy, 
  Check, 
  Terminal, 
  Send, 
  Cpu, 
  Code2, 
  ChevronDown, 
  ChevronUp,
  Activity
} from "lucide-react";

export function LiveNode() {
  const { 
    telemetry, 
    isHardwareLive, 
    isSimulationActive, 
    startSimulation, 
    stopSimulation 
  } = useTelemetry();

  const [history, setHistory] = useState<any[]>([]);
  const [curlCopied, setCurlCopied] = useState<boolean>(false);
  const [codeCopied, setCodeCopied] = useState<boolean>(false);
  const [pingLoading, setPingLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [showCodeGuide, setShowCodeGuide] = useState<boolean>(false);
  const [selectedBoard, setSelectedBoard] = useState<"esp8266" | "esp32">("esp8266");

  // Load telemetry history
  useEffect(() => {
    fetch('/api/telemetry/history')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setHistory(data);
      })
      .catch(() => {});
  }, []);

  // Update history buffer as packets stream in
  useEffect(() => {
    if (telemetry && (telemetry.temperature != null || telemetry.ambientTemperature != null)) {
      setHistory(prev => [
        ...prev.slice(-39),
        {
          ...telemetry,
          displayTemp: telemetry.temperature ?? telemetry.ambientTemperature ?? null,
          displayHumidity: telemetry.humidity ?? null,
          displayTime: new Date(telemetry.timestamp || Date.now()).getTime(),
          timeLabel: format(new Date(telemetry.timestamp || Date.now()), "HH:mm:ss")
        }
      ]);
    }
  }, [telemetry]);

  // Send a test packet to /api/telemetry
  const handleSendPing = async () => {
    setPingLoading(true);
    setNotification(null);
    try {
      const simulatedTemp = Number((26.2 + (Math.random() * 0.8 - 0.4)).toFixed(1));
      const simulatedHumidity = Number((54 + Math.floor(Math.random() * 4 - 2)).toFixed(0));
      const deviceName = selectedBoard === "esp8266" ? "TEST-PACKET-ESP8266" : "TEST-PACKET-ESP32";
      
      const res = await fetch("/api/telemetry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: deviceName,
          temperature: simulatedTemp,
          humidity: simulatedHumidity,
          firmwareVersion: `${selectedBoard.toUpperCase()}-v1.2`,
          mode: "SIMULATED"
        })
      });
      if (res.ok) {
        setNotification(`Test packet delivered to /api/telemetry (${deviceName}) [SIMULATED]`);
        setTimeout(() => setNotification(null), 4500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPingLoading(false);
    }
  };

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const curlCommand = `curl -X POST ${origin}/api/telemetry \\
  -H "Content-Type: application/json" \\
  -d '{"deviceId":"ESP8266-DHT11","temperature":26.5,"humidity":52.0}'`;

  const copyCurl = () => {
    navigator.clipboard.writeText(curlCommand);
    setCurlCopied(true);
    setTimeout(() => setCurlCopied(false), 2500);
  };

  const isSimulatedData = Boolean(
    isSimulationActive || 
    telemetry?.mode === "SIMULATED" || 
    (telemetry?.deviceId && (telemetry.deviceId.includes("SIM") || telemetry.deviceId.includes("TEST")))
  );
  const isRealHardwareLive = Boolean(isHardwareLive && !isSimulatedData);

  const currentTemp = (isRealHardwareLive || isSimulatedData) && (telemetry?.ambientTemperature != null || telemetry?.temperature != null)
    ? Number(telemetry.ambientTemperature ?? telemetry.temperature).toFixed(1)
    : null;

  const currentHumidity = (isRealHardwareLive || isSimulatedData) && telemetry?.humidity != null
    ? Number(telemetry.humidity).toFixed(0)
    : null;

  const rawHot = telemetry?.hotTemp ?? telemetry?.hotTemperature ?? null;
  const rawCold = telemetry?.coldTemp ?? telemetry?.coldTemperature ?? null;
  const liveHot = typeof rawHot === "number" ? rawHot : null;
  const liveCold = typeof rawCold === "number" ? rawCold : null;
  const hasBothTemps = liveHot !== null && liveCold !== null;
  const deltaT = hasBothTemps ? (liveHot! - liveCold!) : null;
  const flowRateVal = typeof telemetry?.flowRate === "number" && telemetry.flowRate > 0 ? telemetry.flowRate : null;
  const measuredHeatKW = hasBothTemps && flowRateVal !== null ? ((flowRateVal * 4.184 * deltaT!) / 3600) : null;

  const espCode = selectedBoard === "esp8266" ? `// Thermora ESP8266 (NodeMCU / D1 Mini) + DHT11
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include "DHT.h"

const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "${origin}/api/telemetry";

#define DHTPIN 4       // GPIO 4 (D2 on NodeMCU)
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(115200);
  dht.begin();
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);
  Serial.println("Connected!");
}

void loop() {
  float tempC = dht.readTemperature();
  float hum = dht.readHumidity();

  if (!isnan(tempC) && !isnan(hum)) {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient https;
    if (https.begin(client, serverUrl)) {
      https.addHeader("Content-Type", "application/json");
      String json = "{\\"deviceId\\":\\"ESP8266-DHT11\\",\\"temperature\\":" + String(tempC, 1) + ",\\"humidity\\":" + String(hum, 1) + "}";
      https.POST(json);
      https.end();
    }
  }
  delay(3000);
}` : `// Thermora ESP32 + DHT11 / DHT22 + Optional Liquid Probes
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include "DHT.h"

const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "${origin}/api/telemetry";

#define DHTPIN 4       // GPIO 4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

void setup() {
  Serial.begin(115200);
  dht.begin();
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) delay(500);
  Serial.println("Connected!");
}

void loop() {
  float tempC = dht.readTemperature();
  float hum = dht.readHumidity();

  if (!isnan(tempC) && !isnan(hum)) {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient https;
    if (https.begin(client, serverUrl)) {
      https.addHeader("Content-Type", "application/json");
      // Optionally pass hotTemp & coldTemp if liquid temperature probes connected
      String json = "{\\"deviceId\\":\\"ESP32-NODE\\",\\"temperature\\":" + String(tempC, 1) + ",\\"humidity\\":" + String(hum, 1) + "}";
      https.POST(json);
      https.end();
    }
  }
  delay(3000);
}`;

  return (
    <div className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      
      {/* 1. Header: LIVE TELEMETRY NODE */}
      <header className="pb-3 border-b border-white/10 space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span>PHYSICAL HARDWARE INTERFACE</span>
          </div>

          <div className="flex items-center gap-2">
            {!isRealHardwareLive && (
              <button
                onClick={isSimulationActive ? stopSimulation : startSimulation}
                className={`px-3 py-1 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                  isSimulationActive
                    ? "bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {isSimulationActive ? "Stop Simulation" : "Start Software Simulation"}
              </button>
            )}

            <button
              onClick={handleSendPing}
              disabled={pingLoading}
              className="px-3 py-1 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs font-mono transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Send size={12} className={pingLoading ? "animate-spin" : ""} />
              <span>Send Test Packet</span>
            </button>
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          Live Telemetry Node
        </h1>
        <p className="text-xs sm:text-sm text-slate-400">
          Single edge node telemetry stream via REST webhook at /api/telemetry.
        </p>
      </header>

      {notification && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 font-mono">
          <Check size={14} className="text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* 2. Connection Status */}
      <section className="bg-[#061822] border border-cyan-500/20 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3.5">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isRealHardwareLive 
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" 
              : isSimulatedData
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              : "bg-white/5 text-slate-500 border border-white/10"
          }`}>
            {isRealHardwareLive ? <Wifi size={20} /> : <WifiOff size={20} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white uppercase tracking-wider">
                Connection Status:
              </span>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                isRealHardwareLive
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : isSimulatedData
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : "bg-white/5 text-slate-400"
              }`}>
                {isRealHardwareLive 
                  ? "LIVE / MEASURED" 
                  : isSimulatedData 
                  ? "SIMULATED" 
                  : "EDGE NODE OFFLINE"}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {isRealHardwareLive
                ? `Actively receiving physical telemetry from ${telemetry?.deviceId || "microcontroller"}.`
                : isSimulatedData
                ? "Simulated packet stream active. Synthetic mathematical telemetry."
                : "No telemetry received. Connect an ESP32/ESP8266 or trigger a test packet."}
            </p>
          </div>
        </div>

        <div className="text-xs font-mono text-slate-400 sm:text-right shrink-0">
          <div>Transport: HTTP POST</div>
          <div className="text-slate-500">Port 3000 /api/telemetry</div>
        </div>
      </section>

      {/* 3. Ambient Sensor Channels (DHT11 / DHT22 Air Measurements) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-white uppercase tracking-wider font-mono text-slate-400">
            Channel A: Chamber Ambient Environment (DHT11 Sensor)
          </span>
          <span className="text-[10px] font-mono">
            {isRealHardwareLive ? (
              <span className="text-emerald-400">[MEASURED LIVE]</span>
            ) : isSimulatedData ? (
              <span className="text-amber-400">[SIMULATED]</span>
            ) : (
              <span className="text-slate-500">[OFFLINE / NO DATA]</span>
            )}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Temperature */}
          <div className="bg-[#061822] border border-cyan-500/20 rounded-2xl p-6 flex flex-col justify-between h-36 shadow-lg">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Ambient Air Temperature</span>
              <span className="font-mono text-[10px]">
                {isRealHardwareLive ? "[MEASURED]" : isSimulatedData ? "[SIMULATED]" : "[NO DATA]"}
              </span>
            </div>
            <div className="flex items-baseline gap-2 my-auto">
              <span className="text-4xl sm:text-5xl font-mono font-bold text-white">
                {currentTemp !== null ? currentTemp : "—"}
              </span>
              <span className="text-lg font-mono text-slate-400">°C</span>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              DHT11 GPIO4 chamber ambient air reading
            </div>
          </div>

          {/* Humidity */}
          <div className="bg-[#061822] border border-cyan-500/20 rounded-2xl p-6 flex flex-col justify-between h-36 shadow-lg">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Ambient Relative Humidity</span>
              <span className="font-mono text-[10px]">
                {isRealHardwareLive ? "[MEASURED]" : isSimulatedData ? "[SIMULATED]" : "[NO DATA]"}
              </span>
            </div>
            <div className="flex items-baseline gap-2 my-auto">
              <span className="text-4xl sm:text-5xl font-mono font-bold text-cyan-400">
                {currentHumidity !== null ? currentHumidity : "—"}
              </span>
              <span className="text-lg font-mono text-slate-400">% RH</span>
            </div>
            <div className="text-xs text-slate-500 font-mono">
              DHT11 chamber relative humidity
            </div>
          </div>
        </div>
      </section>

      {/* 3B. Liquid Process Loop */}
      <section className="bg-[#061822] border border-cyan-500/20 rounded-2xl p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between border-b border-white/5 pb-2">
          <span className="text-xs font-bold text-white uppercase tracking-wider font-mono text-slate-400">
            Channel B: Liquid loop temperatures
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            {hasBothTemps ? "[PROBES CONNECTED]" : liveHot !== null || liveCold !== null ? "[PARTIAL PROBE]" : "[NO PROBE DETECTED]"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-[#020b12] border border-white/5 space-y-1">
            <div className="text-slate-400 text-[11px]">Hot Return Liquid</div>
            <div className={`text-lg font-bold ${liveHot !== null ? "text-amber-400" : "text-slate-500"}`}>
              {liveHot !== null ? `${liveHot.toFixed(1)} °C` : "No probe"}
            </div>
            <div className="text-[10px] text-slate-500 font-sans">Coolant inlet to secondary heat exchanger</div>
          </div>

          <div className="p-3 rounded-xl bg-[#020b12] border border-white/5 space-y-1">
            <div className="text-slate-400 text-[11px]">Cold Condensing Liquid</div>
            <div className={`text-lg font-bold ${liveCold !== null ? "text-cyan-400" : "text-slate-500"}`}>
              {liveCold !== null ? `${liveCold.toFixed(1)} °C` : "No probe"}
            </div>
            <div className="text-[10px] text-slate-500 font-sans">Distillate condensing circuit</div>
          </div>
        </div>

        {/* Delta T and optional Measured Heat Transfer */}
        {hasBothTemps && (
          <div className="p-3 rounded-xl bg-[#020b12] border border-cyan-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono">
            <div>
              <span className="text-slate-400">Thermal Gradient (ΔT): </span>
              <span className="text-white font-bold">{deltaT!.toFixed(1)} °C</span>
            </div>
            {flowRateVal !== null && (
              <div>
                <span className="text-slate-400">Measured heat transfer: </span>
                <span className="text-amber-400 font-bold">{measuredHeatKW!.toFixed(2)} kW</span>
              </div>
            )}
          </div>
        )}

        {/* Prototype disclaimer note */}
        <div className="text-[11px] text-slate-500 font-sans pt-1">
          Prototype measures temperatures. Membrane distillation is modelled, not physically demonstrated.
        </div>
      </section>

      {/* 4. Telemetry Graph */}
      <section className="bg-[#061822] border border-cyan-500/20 rounded-2xl p-5 space-y-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Telemetry Trend
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Historical temperature readings over time
            </p>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            {history.length} data points
          </span>
        </div>

        <div className="h-48 w-full">
          {history.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis 
                  dataKey="timeLabel" 
                  stroke="#64748b" 
                  fontSize={10} 
                  tickLine={false}
                />
                <YAxis 
                  domain={['auto', 'auto']} 
                  stroke="#64748b" 
                  fontSize={10} 
                  unit="°C"
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#020b12",
                    borderColor: "#ffffff15",
                    fontSize: "11px",
                    borderRadius: "8px",
                    fontFamily: "monospace"
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="displayTemp" 
                  stroke="#38bdf8" 
                  strokeWidth={2} 
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-xs text-slate-500 font-mono">
              <Activity size={20} className="text-slate-600 mb-2" />
              <span>Waiting for stream packets to plot curve...</span>
            </div>
          )}
        </div>
      </section>

      {/* 5. Device Information */}
      <section className="bg-[#061822] border border-cyan-500/20 rounded-2xl p-5 space-y-3 shadow-lg">
        <h3 className="text-xs font-bold text-white uppercase tracking-wider">
          Device Information
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[#020b12] border border-white/5">
            <div className="text-slate-400 text-[11px]">Device ID</div>
            <div className="font-mono font-semibold text-white mt-1 truncate">
              {telemetry?.deviceId || "None Connected"}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#020b12] border border-white/5">
            <div className="text-slate-400 text-[11px]">Hardware Board</div>
            <div className="font-mono font-semibold text-white mt-1">
              {telemetry?.firmwareVersion || "ESP8266 / ESP32"}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#020b12] border border-white/5">
            <div className="text-slate-400 text-[11px]">Last Packet</div>
            <div className="font-mono font-semibold text-white mt-1">
              {telemetry?.timestamp ? format(new Date(telemetry.timestamp), "HH:mm:ss") : "Never"}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#020b12] border border-white/5">
            <div className="text-slate-400 text-[11px]">Data Ingestion</div>
            <div className="font-mono font-semibold text-emerald-400 mt-1">
              /api/telemetry
            </div>
          </div>
        </div>
      </section>

      {/* 6. Integration Guide (cURL & Arduino Firmware) */}
      <section className="bg-[#061822] border border-cyan-500/20 rounded-2xl overflow-hidden shadow-lg">
        <button
          onClick={() => setShowCodeGuide(!showCodeGuide)}
          className="w-full px-5 py-3.5 flex items-center justify-between text-left text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2 font-mono">
            <Terminal size={14} className="text-slate-400" />
            <span>Connect Your Microcontroller (cURL &amp; Arduino C++ Code)</span>
          </div>
          {showCodeGuide ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>

        {showCodeGuide && (
          <div className="px-5 pb-5 pt-2 border-t border-white/5 space-y-4">
            
            {/* cURL */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Direct cURL Test Command:</span>
                <button
                  onClick={copyCurl}
                  className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white font-mono text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {curlCopied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  <span>{curlCopied ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <pre className="p-3 rounded-xl bg-[#020b12] border border-white/5 font-mono text-emerald-400 text-[11px] overflow-x-auto leading-relaxed">
                {curlCommand}
              </pre>
            </div>

            {/* Arduino Code */}
            <div className="space-y-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Board Sketch:</span>
                  <div className="flex items-center gap-1 bg-[#020b12] p-0.5 rounded-lg border border-white/5">
                    <button
                      onClick={() => setSelectedBoard("esp8266")}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                        selectedBoard === "esp8266" ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-400/30" : "text-slate-400"
                      }`}
                    >
                      ESP8266
                    </button>
                    <button
                      onClick={() => setSelectedBoard("esp32")}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                        selectedBoard === "esp32" ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-400/30" : "text-slate-400"
                      }`}
                    >
                      ESP32
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(espCode);
                    setCodeCopied(true);
                    setTimeout(() => setCodeCopied(false), 2500);
                  }}
                  className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white font-mono text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                >
                  {codeCopied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                  <span>{codeCopied ? "Copied" : "Copy Code"}</span>
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-[#020b12] border border-white/5 font-mono text-slate-300 text-[11px] overflow-x-auto leading-relaxed max-h-60 overflow-y-auto">
                {espCode}
              </pre>
            </div>

          </div>
        )}
      </section>

    </div>
  );
}
