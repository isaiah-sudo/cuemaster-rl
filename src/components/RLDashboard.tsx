import React, { useRef, useEffect, useState } from 'react';
import { GameManager, type TrainingScenario } from '../game/GameManager';
import { Play, Pause, RotateCcw, Download, Upload, Zap, Activity, Target } from 'lucide-react';

interface RLDashboardProps {
  game: GameManager;
}

export const RLDashboard: React.FC<RLDashboardProps> = ({ game }) => {
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Subscribe to game updates so telemetry and chart update in real time
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = game.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsub;
  }, [game]);

  const metrics = game.agent.metrics;
  const { trainingSpeed, isTrainingPaused, trainingScenario, lastShotReward } = game.state;

  // Render live reward graph on canvas
  useEffect(() => {
    const canvas = chartCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background grid
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1;
    for (let y = 20; y < h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const rewards = metrics.recentRewards;
    if (rewards.length === 0) {
      ctx.fillStyle = '#71717a';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Training in progress... Collecting first shot', w / 2, h / 2);
      return;
    }

    const minR = Math.min(-50, ...rewards);
    const maxR = Math.max(150, ...rewards);
    const range = Math.max(1, maxR - minR);

    // Draw zero-line
    const zeroY = h - ((0 - minR) / range) * (h - 20) - 10;
    ctx.strokeStyle = '#52525b';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(w, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (rewards.length === 1) {
      const y = h - ((rewards[0] - minR) / range) * (h - 20) - 10;
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(w / 2, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(`${rewards[0]}`, w / 2, y - 8);
      return;
    }

    // Draw reward line
    ctx.beginPath();
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;

    for (let i = 0; i < rewards.length; i++) {
      const x = (i / (rewards.length - 1)) * (w - 14) + 7;
      const y = h - ((rewards[i] - minR) / range) * (h - 20) - 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill gradient under curve
    ctx.lineTo(w - 7, h);
    ctx.lineTo(7, h);
    ctx.closePath();
    const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
    fillGrad.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
    fillGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Draw dots for the latest 5 rewards
    const startDot = Math.max(0, rewards.length - 5);
    for (let i = startDot; i < rewards.length; i++) {
      const x = (i / (rewards.length - 1)) * (w - 14) + 7;
      const y = h - ((rewards[i] - minR) / range) * (h - 20) - 10;
      ctx.beginPath();
      ctx.arc(x, y, i === rewards.length - 1 ? 4 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = i === rewards.length - 1 ? '#34d399' : '#10b981';
      ctx.fill();
    }
  }, [metrics.recentRewards, metrics.episode]);

  const handleSaveBrain = () => {
    const json = game.agent.qNetwork.toJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pool_rl_brain_ep${metrics.episode}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadBrain = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        game.agent.qNetwork.fromJSON(text);
        game.agent.targetNetwork = game.agent.qNetwork.clone();
        alert('RL Neural Network brain loaded successfully!');
      } catch {
        alert('Invalid brain model file.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-5xl p-4 bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-xl backdrop-blur-md">
      {/* 1. Metrics & Live Stats */}
      <div className="flex flex-col gap-3 p-4 bg-zinc-950/60 rounded-xl border border-zinc-800/60">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Activity className="w-4 h-4" /> Agent Telemetry
          </span>
          <span className="text-xs font-mono text-zinc-500">DQN Agent v2.4</span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="p-2.5 bg-zinc-900 rounded-lg border border-zinc-800">
            <div className="text-[10px] text-zinc-400 uppercase font-semibold">Episodes</div>
            <div className="text-xl font-bold font-mono text-zinc-100">{metrics.episode}</div>
          </div>
          <div className="p-2.5 bg-zinc-900 rounded-lg border border-zinc-800">
            <div className="text-[10px] text-zinc-400 uppercase font-semibold">Total Pots</div>
            <div className="text-xl font-bold font-mono text-emerald-400">{metrics.totalPots}</div>
          </div>
          <div className="p-2.5 bg-zinc-900 rounded-lg border border-zinc-800">
            <div className="text-[10px] text-zinc-400 uppercase font-semibold">Avg Reward</div>
            <div className={`text-xl font-bold font-mono ${metrics.averageReward >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
              {metrics.averageReward > 0 ? `+${metrics.averageReward}` : metrics.averageReward}
            </div>
          </div>
          <div className="p-2.5 bg-zinc-900 rounded-lg border border-zinc-800">
            <div className="text-[10px] text-zinc-400 uppercase font-semibold">Loss (MSE)</div>
            <div className="text-xl font-bold font-mono text-amber-400">{metrics.loss.toFixed(2)}</div>
          </div>
        </div>

        {/* Epsilon exploration */}
        <div className="flex flex-col gap-1 mt-1">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>Exploration (ε-Greedy):</span>
            <span className="font-mono text-emerald-400">{Math.round(game.agent.epsilon * 100)}%</span>
          </div>
          <input
            type="range"
            min={0.02}
            max={0.9}
            step={0.01}
            value={game.agent.epsilon}
            onChange={(e) => {
              game.agent.epsilon = parseFloat(e.target.value);
            }}
            className="w-full accent-emerald-500 cursor-pointer h-1.5 bg-zinc-800 rounded"
          />
        </div>

        {lastShotReward !== null && (
          <div className="text-xs text-center text-zinc-400 py-1 bg-zinc-900/60 rounded border border-zinc-800/80">
            Last Shot Reward:{' '}
            <span className={`font-bold font-mono ${lastShotReward >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {lastShotReward > 0 ? `+${lastShotReward}` : lastShotReward}
            </span>
          </div>
        )}
      </div>

      {/* 2. Live Reward Curve Chart */}
      <div className="flex flex-col gap-2 p-4 bg-zinc-950/60 rounded-xl border border-zinc-800/60">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
            <Zap className="w-4 h-4" /> Reward Curve (Last 50 Episodes)
          </span>
          <span className="text-[10px] text-zinc-400">Rolling TD Target</span>
        </div>

        <div className="relative flex-1 w-full min-h-[140px] flex items-center justify-center">
          <canvas
            ref={chartCanvasRef}
            width={320}
            height={140}
            className="w-full h-full rounded border border-zinc-800 bg-zinc-900/50"
          />
        </div>

        <div className="flex justify-between text-[11px] text-zinc-400 px-1">
          <span>Min: -50 (Foul/Scratch)</span>
          <span className="text-emerald-400 font-semibold">Max: +150 (Pot + Leave)</span>
        </div>
      </div>

      {/* 3. Training Controls & Scenarios */}
      <div className="flex flex-col gap-3 p-4 bg-zinc-950/60 rounded-xl border border-zinc-800/60">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
            <Target className="w-4 h-4" /> Simulation Lab Controls
          </span>
        </div>

        {/* Training Scenarios */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-zinc-400 uppercase">Training Curriculum:</label>
          <div className="grid grid-cols-3 gap-1">
            {(
              [
                ['potting_drill', '🎯 1-Ball Pot'],
                ['multi_ball', '🎱 4-Ball Drill'],
                ['full_game', '🏆 Full Rack'],
              ] as [TrainingScenario, string][]
            ).map(([scenario, label]) => (
              <button
                key={scenario}
                onClick={() => game.setTrainingScenario(scenario)}
                className={`py-1.5 px-1 text-[11px] font-bold rounded border transition ${
                  trainingScenario === scenario
                    ? 'bg-indigo-600/30 border-indigo-500 text-indigo-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Speed Controls */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-zinc-400 uppercase">Simulation Speed:</label>
          <div className="grid grid-cols-5 gap-1">
            {[1, 2, 5, 20, 100].map((s) => (
              <button
                key={s}
                onClick={() => game.setTrainingSpeed(s)}
                className={`py-1 text-xs font-bold rounded border transition ${
                  trainingSpeed === s
                    ? 'bg-emerald-600/30 border-emerald-500 text-emerald-300'
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                {s === 100 ? '⚡ Turbo' : `${s}x`}
              </button>
            ))}
          </div>
        </div>

        {/* Simulation Actions */}
        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={() => game.toggleTrainingPause()}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-bold border transition ${
              isTrainingPaused
                ? 'bg-amber-600/20 border-amber-500 text-amber-300 hover:bg-amber-600/30'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            {isTrainingPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {isTrainingPaused ? 'Resume' : 'Pause'}
          </button>

          <button
            onClick={() => game.setupTrainingScenario()}
            className="flex items-center justify-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-900 border border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition"
            title="Reset Rack"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>

        {/* Save/Load Neural Weights */}
        <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/80">
          <button
            onClick={handleSaveBrain}
            className="flex-1 flex items-center justify-center gap-1 py-1 text-[11px] bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded border border-zinc-800 transition"
          >
            <Download className="w-3 h-3" /> Save Brain
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-1 py-1 text-[11px] bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded border border-zinc-800 transition"
          >
            <Upload className="w-3 h-3" /> Load Brain
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleLoadBrain} className="hidden" />
        </div>
      </div>
    </div>
  );
};
