import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  X, 
  RefreshCw,
  Sparkles,
  Thermometer,
  Droplets,
  Layers,
  ChevronRight
} from 'lucide-react';

interface SimulationProps {
  onClose?: () => void;
}

export function SystemFlowSimulation({ onClose }: SimulationProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [selectedStep, setSelectedStep] = useState<number>(3); // Default to Step 3: Boiling Tank as in screenshot
  const [serverTemp, setServerTemp] = useState<number>(73.7);
  const [tankTemp, setTankTemp] = useState<number>(61.1);
  const [coilTemp, setCoilTemp] = useState<number>(32.3);
  const [waterMl, setWaterMl] = useState<number>(46.7);
  const [readingsCount, setReadingsCount] = useState<number>(70);
  const [currentStage, setCurrentStage] = useState<'warming' | 'evaporating' | 'condensing'>('evaporating');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  // Dynamic telemetry updates
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setReadingsCount((prev) => prev + 1);
      setWaterMl((prev) => Number((prev + 0.1).toFixed(1)));
      setServerTemp((prev) => Number((73.5 + (Math.sin(Date.now() / 3000) * 1.2)).toFixed(1)));
      setTankTemp((prev) => Number((60.8 + (Math.cos(Date.now() / 2500) * 0.8)).toFixed(1)));
      setCoilTemp((prev) => Number((32.2 + (Math.sin(Date.now() / 4000) * 0.5)).toFixed(1)));
    }, 1200);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // High-performance 60-FPS particle animation on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.offsetWidth);
    let height = (canvas.height = canvas.offsetHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = canvas.offsetWidth;
      height = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle definitions
    // 1. Heat particles: flowing from Server (x ~ 15%) to Heat Pipes (x ~ 32%) to Boiling Tank (x ~ 45%)
    // 2. Tank Bubbles: rising inside Boiling Tank (x: 45% - 58%, y: 55% - 85%)
    // 3. Steam particles: flowing from Boiling Tank top (x ~ 55%) across into Cooling Coil (x ~ 68%)
    // 4. Water droplets: flowing from Cooling Coil (x ~ 78%) into Clean Tank (x ~ 86%)

    interface Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      radius: number;
      alpha: number;
      color: string;
      type: 'heat' | 'bubble' | 'steam' | 'water';
      life: number;
      maxLife: number;
    }

    const particles: Particle[] = [];

    const spawnHeatParticle = () => {
      // Start between server and heat pipes
      const x = width * 0.20 + (Math.random() * 10 - 5);
      const y = height * 0.55 + (Math.random() * 20 - 10);
      particles.push({
        x,
        y,
        vx: 1.2 + Math.random() * 0.8,
        vy: (Math.random() - 0.5) * 0.4,
        radius: 2 + Math.random() * 3,
        alpha: 0.8,
        color: Math.random() > 0.4 ? '#f97316' : '#ef4444',
        type: 'heat',
        life: 0,
        maxLife: 90 + Math.random() * 40
      });
    };

    const spawnBubble = () => {
      // Bottom of boiling tank
      const x = width * 0.45 + Math.random() * (width * 0.12);
      const y = height * 0.82 + Math.random() * 5;
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -(0.8 + Math.random() * 0.9),
        radius: 1.5 + Math.random() * 2.5,
        alpha: 0.7,
        color: '#ffffff',
        type: 'bubble',
        life: 0,
        maxLife: 60 + Math.random() * 30
      });
    };

    const spawnSteamParticle = () => {
      // From boiling tank upper surface towards cooling coil
      const x = width * 0.52 + Math.random() * (width * 0.05);
      const y = height * 0.46 + Math.random() * 12;
      particles.push({
        x,
        y,
        vx: 1.1 + Math.random() * 0.7,
        vy: (Math.random() - 0.4) * 0.3,
        radius: 3 + Math.random() * 4,
        alpha: 0.5,
        color: '#7dd3fc',
        type: 'steam',
        life: 0,
        maxLife: 75 + Math.random() * 30
      });
    };

    const spawnWaterDroplet = () => {
      // From cooling coil to clean tank
      const x = width * 0.76;
      const y = height * 0.58 + (Math.random() * 10 - 5);
      particles.push({
        x,
        y,
        vx: 1.4 + Math.random() * 0.5,
        vy: 0.3 + Math.random() * 0.4,
        radius: 2 + Math.random() * 2,
        alpha: 0.85,
        color: '#38bdf8',
        type: 'water',
        life: 0,
        maxLife: 50 + Math.random() * 20
      });
    };

    let tick = 0;

    const render = () => {
      tick++;
      ctx.clearRect(0, 0, width, height);

      if (isPlaying) {
        if (tick % 4 === 0) spawnHeatParticle();
        if (tick % 5 === 0) spawnBubble();
        if (tick % 4 === 0) spawnSteamParticle();
        if (tick % 9 === 0) spawnWaterDroplet();
      }

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;

        // Progress fading
        const progress = p.life / p.maxLife;
        const currentAlpha = p.alpha * (1 - progress);

        if (p.life >= p.maxLife || currentAlpha <= 0.01) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = currentAlpha;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.type === 'heat' ? 8 : p.type === 'steam' ? 6 : 4;
        ctx.fill();
        ctx.restore();
      }

      animationFrameId.current = requestAnimationFrame(render);
    };

    animationFrameId.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [isPlaying]);

  // Step information metadata matching screenshot
  const stepsData = [
    {
      id: 1,
      title: "Step 1: Compute Server",
      desc: "Accelerators processing AI tokens dissipate electric power as direct thermal heat. Coolant absorbs the high temperature directly from server dies.",
      metricTitle: "Server Temperature",
      metricValue: `${serverTemp} °C`
    },
    {
      id: 2,
      title: "Step 2: Sealed Heat Pipes",
      desc: "Closed-loop heat pipes and vapor chambers transfer thermal energy into the evaporation module with zero external mass loss or energy dilution.",
      metricTitle: "Heat Transfer Efficiency",
      metricValue: "100% Sealed"
    },
    {
      id: 3,
      title: "Step 3: Boiling Chamber",
      desc: "Saline feed water is warmed by computer waste heat. Pure water evaporates into clean vapor and moves across the thermal gradient. Salt and dissolved contaminants stay behind.",
      metricTitle: "Chamber Temperature",
      metricValue: `Chamber Temp: ${tankTemp} °C`
    },
    {
      id: 4,
      title: "Step 4: Cooling Coil",
      desc: "Pure steam travels into the condenser coil. Thermal contact with the cooling circuit triggers rapid phase-change back into liquid freshwater.",
      metricTitle: "Condenser Temperature",
      metricValue: `${coilTemp} °C`
    },
    {
      id: 5,
      title: "Step 5: Clean Distillate Tank",
      desc: "High-purity distillate (< 10 ppm TDS) is collected in the clean tank, suitable for datacenter cooling loops or industrial reuse (non-potable without mineral treatment).",
      metricTitle: "Clean Water Output",
      metricValue: `${waterMl} mL`
    }
  ];

  const currentStepData = stepsData.find((s) => s.id === selectedStep) || stepsData[2];

  return (
    <div 
      id="system-flow-simulation"
      className="w-full bg-[#061822]/95 border border-cyan-500/30 rounded-3xl p-4 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.8)] text-slate-100 transition-all font-sans"
      style={{ fontFamily: "'Inter', Arial, Helvetica, sans-serif" }}
    >
      {/* 1. Top Status & Process Stage Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-white/10">
        {/* Left: Process Stages */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="font-semibold text-slate-400 mr-1">Process Stage:</span>
          
          <button
            onClick={() => {
              setCurrentStage('warming');
              setSelectedStep(1);
            }}
            className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              currentStage === 'warming'
                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-400/50 shadow-xs'
                : 'bg-black/40 text-slate-400 hover:bg-white/5 border border-white/5'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>1. Warming Up</span>
          </button>

          <span className="text-slate-500">→</span>

          <button
            onClick={() => {
              setCurrentStage('evaporating');
              setSelectedStep(3);
            }}
            className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              currentStage === 'evaporating'
                ? 'bg-amber-950/80 text-amber-300 border border-amber-400/50 shadow-xs'
                : 'bg-black/40 text-slate-400 hover:bg-white/5 border border-white/5'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>2. Evaporating</span>
          </button>

          <span className="text-slate-500">→</span>

          <button
            onClick={() => {
              setCurrentStage('condensing');
              setSelectedStep(4);
            }}
            className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              currentStage === 'condensing'
                ? 'bg-sky-950/80 text-sky-300 border border-sky-400/50 shadow-xs'
                : 'bg-black/40 text-slate-400 hover:bg-white/5 border border-white/5'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            <span>3. Condensing</span>
          </button>
        </div>

        {/* Right: Simulation Telemetry & Close */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-bold font-mono border border-cyan-400/30">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>SIMULATED PROTOTYPE FEED</span>
            </span>
            <span className="text-xs text-slate-400 font-medium">
              {readingsCount} readings logged
            </span>
          </div>

          <div className="flex items-center gap-1 ml-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button
              onClick={() => {
                setWaterMl(46.7);
                setReadingsCount(70);
              }}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="Reset"
            >
              <RotateCcw size={14} />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Close"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Simulation Title */}
      <div className="pt-4 pb-3">
        <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2.5">
          <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-400/40">
            <RefreshCw size={19} className={isPlaying ? 'animate-spin' : ''} style={{ animationDuration: '6s' }} />
          </span>
          <span>System Flow Simulation</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Interactive 60-FPS animated diagram of the closed-loop membrane distillation recovery cycle.
        </p>
      </div>

      {/* 3. Main Stage: The 5-Node Interactive Visual Flow */}
      <div className="relative w-full rounded-2xl bg-[#020b12] border border-cyan-500/20 p-4 sm:p-8 my-4 shadow-inner overflow-hidden min-h-[300px] flex items-center">
        
        {/* Canvas for 60-FPS Particle Flows (Heat, Bubbles, Steam, Condensate) */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        />

        {/* 5 Physical Nodes */}
        <div className="relative z-20 w-full grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4 items-center">
          
          {/* Node 1: SERVER */}
          <div
            onClick={() => setSelectedStep(1)}
            className={`rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between h-52 sm:h-56 ${
              selectedStep === 1
                ? 'ring-2 ring-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.4)] scale-[1.02]'
                : 'hover:border-rose-400'
            }`}
            style={{
              backgroundColor: '#1f1b29',
              border: '2px solid #e11d48'
            }}
          >
            <div className="text-center font-bold text-xs uppercase tracking-wider text-white">
              1. SERVER
            </div>

            {/* Server Blades with Green LEDs */}
            <div className="space-y-3 my-auto">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-black/50 border-b border-white/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <div className="w-full h-1 bg-white/20 rounded" />
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-black/50 border-b border-white/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <div className="w-full h-1 bg-white/20 rounded" />
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-black/50 border-b border-white/10">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <div className="w-full h-1 bg-white/20 rounded" />
              </div>
            </div>

            {/* Temperature readout */}
            <div className="text-center font-bold text-sm sm:text-base text-rose-400">
              {serverTemp} °C
            </div>
          </div>

          {/* Node 2: HEAT PIPES */}
          <div
            onClick={() => setSelectedStep(2)}
            className={`rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between h-36 sm:h-40 ${
              selectedStep === 2
                ? 'ring-2 ring-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.4)] scale-[1.02]'
                : 'hover:border-orange-400'
            }`}
            style={{
              backgroundColor: '#26150f',
              border: '2px solid #ea580c'
            }}
          >
            <div className="text-center font-bold text-xs uppercase tracking-wider text-orange-200">
              2. HEAT PIPES
            </div>

            <div className="text-center my-auto">
              <div className="font-extrabold text-sm sm:text-base text-orange-400 tracking-wider">
                HEAT FLOW
              </div>
              <div className="text-[11px] text-orange-300/80 mt-0.5 font-medium">
                100% Sealed
              </div>
            </div>
          </div>

          {/* Node 3: BOILING TANK (Centerpiece) */}
          <div
            onClick={() => setSelectedStep(3)}
            className={`rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between h-60 sm:h-64 relative overflow-hidden ${
              selectedStep === 3
                ? 'ring-3 ring-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.5)] scale-[1.03]'
                : 'hover:border-amber-400'
            }`}
            style={{
              backgroundColor: '#1b170a',
              border: '3px solid #f59e0b'
            }}
          >
            {/* Top header */}
            <div className="text-center z-20">
              <div className="font-bold text-xs uppercase tracking-wider text-amber-200">
                3. BOILING TANK
              </div>
              <div className="font-extrabold text-base text-amber-400 mt-1">
                {tankTemp} °C
              </div>
            </div>

            {/* Liquid at the bottom */}
            <div 
              className="absolute inset-x-0 bottom-0 h-28 rounded-b-xl overflow-hidden flex flex-col justify-end p-2.5 z-10"
              style={{
                background: 'linear-gradient(to top, #115e59, #0d9488)'
              }}
            >
              {/* Rising micro-bubbles indicator */}
              <div className="text-center text-[11px] font-bold text-teal-100 drop-shadow-xs">
                • Salts stay here
              </div>
            </div>
          </div>

          {/* Node 4: COOLING COIL */}
          <div
            onClick={() => setSelectedStep(4)}
            className={`rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between h-56 sm:h-60 relative overflow-hidden ${
              selectedStep === 4
                ? 'ring-2 ring-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.4)] scale-[1.02]'
                : 'hover:border-sky-400'
            }`}
            style={{
              backgroundColor: '#071826',
              border: '2px solid #0284c7'
            }}
          >
            <div className="text-center">
              <div className="font-bold text-xs uppercase tracking-wider text-sky-200">
                COOLING COIL
              </div>
              <div className="font-bold text-sm text-sky-400 mt-0.5">
                {coilTemp} °C
              </div>
            </div>

            {/* Neon Condenser Coil SVG */}
            <div className="w-full flex items-center justify-center my-auto py-2">
              <svg viewBox="0 0 100 80" className="w-24 h-20 text-sky-400 stroke-current">
                <path
                  d="M 15 12 C 15 2, 85 2, 85 12 C 85 22, 15 22, 15 32 C 15 42, 85 42, 85 52 C 85 62, 15 62, 15 72"
                  fill="none"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className={isPlaying ? 'animate-pulse' : ''}
                />
              </svg>
            </div>

            <div className="text-center text-[11px] font-semibold text-sky-300">
              Steam → Water
            </div>
          </div>

          {/* Node 5: CLEAN TANK */}
          <div
            onClick={() => setSelectedStep(5)}
            className={`rounded-2xl p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between h-52 sm:h-56 relative overflow-hidden ${
              selectedStep === 5
                ? 'ring-2 ring-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] scale-[1.02]'
                : 'hover:border-emerald-400'
            }`}
            style={{
              backgroundColor: '#061d18',
              border: '2px solid #10b981'
            }}
          >
            <div className="text-center">
              <div className="font-bold text-xs uppercase tracking-wider text-emerald-200">
                5. CLEAN TANK
              </div>
              <div className="font-extrabold text-base text-emerald-300 mt-0.5">
                {waterMl} mL
              </div>
            </div>

            {/* Distillate Water Reservoir */}
            <div 
              className="absolute inset-x-0 bottom-0 h-24 rounded-b-xl flex flex-col justify-end p-2.5"
              style={{
                background: 'linear-gradient(to top, #065f46, #059669)'
              }}
            >
              <div className="text-center text-[11px] font-bold text-emerald-100">
                Pure Distillate
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* 4. Bottom Synchronized Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {/* Left: Detailed Step Explanation */}
        <div className="md:col-span-2 bg-[#061822] border border-white/10 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white">
              {currentStepData.title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed">
              {currentStepData.desc}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-4 text-[11px] font-semibold text-slate-400">
            <span>Click on any node in the diagram above to inspect its real-time thermal phase.</span>
          </div>
        </div>

        {/* Right: Real-time Metric Readout */}
        <div className="bg-[#061822] border border-white/10 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {currentStepData.metricTitle}
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-white mt-2">
              {currentStepData.metricValue}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-medium text-emerald-300 bg-emerald-950/60 px-3 py-2 rounded-xl mt-4 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Closed-loop efficiency: 99.4%</span>
          </div>
        </div>
      </div>

    </div>
  );
}
