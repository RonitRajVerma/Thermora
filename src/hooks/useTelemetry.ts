import { useState, useEffect, useCallback } from 'react';

export interface TelemetryData {
  deviceId: string;
  timestamp: string | Date;
  ambientTemperature?: number | null;
  temperature?: number | null;
  humidity?: number | null;
  hotTemperature?: number | null;
  coldTemperature?: number | null;
  flowRate?: number | null;
  pumpState?: boolean | null;
  firmwareVersion?: string;
  mode?: "MEASURED" | "SIMULATED" | "OFFLINE";
  status?: string;
  receivedAt?: string;
}

export function useTelemetry() {
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [connected, setConnected] = useState(false);
  const [isHardwareLive, setIsHardwareLive] = useState(false);
  const [isSimulationActive, setIsSimulationActive] = useState(false);

  // Initial fetch
  const fetchLatest = useCallback(async () => {
    try {
      const res = await fetch('/api/telemetry/latest');
      if (res.ok) {
        const data = await res.json();
        setIsHardwareLive(!!data.isHardwareLive);
        setIsSimulationActive(!!data.isSimulationActive);
        if (data.telemetry && data.telemetry.mode !== "OFFLINE") {
          setTelemetry(data.telemetry);
        } else {
          setTelemetry(null);
        }
      }
    } catch {
      // server starting up
    }
  }, []);

  useEffect(() => {
    fetchLatest();

    const eventSource = new EventSource('/api/telemetry/stream');
    
    eventSource.onopen = () => setConnected(true);
    eventSource.onerror = () => setConnected(false);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data && data.mode === "OFFLINE") {
          setTelemetry(null);
          setIsHardwareLive(false);
        } else if (data && (data.mode === "MEASURED" || data.mode === "SIMULATED")) {
          setTelemetry(data);
          setIsHardwareLive(data.mode === "MEASURED");
          setIsSimulationActive(data.mode === "SIMULATED");
        }
      } catch (err) {
        console.error('Error parsing telemetry stream:', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [fetchLatest]);

  const startSimulation = async () => {
    try {
      const res = await fetch('/api/telemetry/simulate/start', { method: 'POST' });
      const data = await res.json();
      setIsSimulationActive(true);
      if (data.telemetry) setTelemetry(data.telemetry);
    } catch (err) {
      console.error(err);
    }
  };

  const stopSimulation = async () => {
    try {
      await fetch('/api/telemetry/simulate/stop', { method: 'POST' });
      setIsSimulationActive(false);
      if (!isHardwareLive) setTelemetry(null);
    } catch (err) {
      console.error(err);
    }
  };

  const classification = isHardwareLive && telemetry?.mode === "MEASURED"
    ? "MEASURED"
    : isSimulationActive || telemetry?.mode === "SIMULATED"
    ? "SIMULATED"
    : "OFFLINE";

  return { 
    telemetry, 
    connected, 
    isHardwareLive, 
    isSimulationActive, 
    classification,
    startSimulation, 
    stopSimulation,
    refresh: fetchLatest 
  };
}

