import React, { useRef, useEffect, useState } from 'react';
import { GameManager, type TrainingScenario } from '../game/GameManager';
import { Play, Pause, RotateCcw, Download, Upload, Zap, Activity, Target, Brain, RefreshCw, AlertTriangle, Check, X, CheckCircle2 } from 'lucide-react';

interface RLDashboardProps {
  game: GameManager;
}

export const RLDashboard: React.FC<RLDashboardProps> = ({ game }) => {
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [customBatchInput, setCustomBatchInput] = useState<string>('100');

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

  const [loadFeedback, setLoadFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!loadFeedback) return;
    const timer = setTimeout(() => setLoadFeedback(null), 6000);
    return () => clearTimeout(timer);
  }, [loadFeedback]);

  const handleSaveBrain = () => {
    const { json, filename } = game.saveBrain();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setLoadFeedback({ type: 'success', message: `Saved model snapshot: ${filename}` });
  };

  const handleLoadBrain = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = file.name;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const result = game.loadBrain(text, fileName);
        if (result.success) {
          setLoadFeedback({ type: 'success', message: result.message });
        } else {
          setLoadFeedback({ type: 'error', message: result.message });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Invalid brain model file.';
        setLoadFeedback({ type: 'error', message: msg });
      }
    };
    reader.onerror = () => {
      setLoadFeedback({ type: 'error', message: 'Failed to read file from disk.' });
    };
    reader.readAsText(file);
    // Reset input value so user can re-upload or select same file again!
    e.target.value = '';
  };

  const handleConfirmReset = (blank: boolean) => {
    game.trainResetAI(blank);
    setShowResetModal(false);
  };

  return (
    <div className="relative grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-5xl p-4 bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-xl backdrop-blur-md">
      {/* 1. Metrics & Live Stats */}
      <div className="flex flex-col gap-3 p-4 bg-zinc-950/60 rounded-xl border border-zinc-800/60">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <Activity className="w-4 h-4" /> Agent Telemetry
          </span>
          <span className="text-xs font-mono text-zinc-500">DQN Agent v2.4</span>
        </div>

        {/* Brain Model State Pill */}
        <div className="flex items-center justify-between text-xs px-2.5 py-1.5 bg-zinc-900 rounded-lg border border-zinc-800">
          <span className="text-zinc-400 flex items-center gap-1.5">
            <Brain className="w-3.5 h-3.5 text-indigo-400" />
            AI Brain:
          </span>
          <span
            className={`font-bold font-mono px-2 py-0.5 rounded text-[10px] border ${
              game.agent.brainType === 'blank'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                : game.agent.brainType === 'loaded'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
            }`}
          >
            {game.agent.brainType === 'blank'
              ? 'Blank (Knows Nothing)'
              : game.agent.brainType === 'loaded'
              ? 'Custom Loaded'
              : 'Pretrained Baseline'}
          </span>
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
            max={0.99}
            step={0.01}
            value={game.agent.epsilon}
            onChange={(e) => {
              game.setAgentEpsilon(parseFloat(e.target.value));
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

        {/* Episode Goal / Auto-Stop Control */}
        <div className="flex flex-col gap-1.5 p-2.5 bg-zinc-900/70 rounded-xl border border-zinc-800">
          <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-300">
            <span className="flex items-center gap-1.5 text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Episode Goal (Auto-Stop):</span>
            </span>
            {game.state.episodesRemaining !== null && (
              <button
                onClick={() => game.clearEpisodeLimit()}
                className="text-[10px] text-rose-400 hover:text-rose-300 underline font-normal transition"
              >
                Cancel Goal
              </button>
            )}
          </div>

          {game.state.episodesRemaining !== null ? (
            <div className="flex flex-col gap-1.5 mt-0.5">
              <div className="flex justify-between items-center text-[11px] font-mono">
                <span className="text-zinc-300">
                  {game.state.episodeBatchTotal! - game.state.episodesRemaining} / {game.state.episodeBatchTotal} done
                </span>
                <span className="text-emerald-400 font-bold">
                  {game.state.episodesRemaining} left (Target: #{game.state.episodeTarget})
                </span>
              </div>
              <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden border border-zinc-700/60">
                <div
                  className="bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-400 h-full transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.max(
                        0,
                        ((game.state.episodeBatchTotal! - game.state.episodesRemaining) /
                          Math.max(1, game.state.episodeBatchTotal!)) *
                          100
                      )
                    )}%`,
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 mt-0.5">
              <div className="grid grid-cols-4 gap-1">
                {[25, 50, 100, 500].map((count) => (
                  <button
                    key={count}
                    onClick={() => game.setEpisodeLimit(count)}
                    className="py-1 px-1 text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded border border-zinc-700 transition"
                  >
                    +{count}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1}
                  max={50000}
                  value={customBatchInput}
                  onChange={(e) => setCustomBatchInput(e.target.value)}
                  placeholder="Custom eps..."
                  className="flex-1 px-2 py-1 text-[11px] bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-200 font-mono outline-none focus:border-emerald-500"
                />
                <button
                  onClick={() => {
                    const parsed = parseInt(customBatchInput, 10);
                    if (!isNaN(parsed) && parsed > 0) {
                      game.setEpisodeLimit(parsed);
                    }
                  }}
                  className="px-3 py-1 text-[11px] font-bold bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/50 rounded-lg transition"
                >
                  Start
                </button>
              </div>
            </div>
          )}
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
            title="Reset Rack Balls"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Rack
          </button>
        </div>

        {/* AI Model Train Reset Button */}
        <div className="flex flex-col gap-1 pt-1 border-t border-zinc-800/80">
          <button
            onClick={() => setShowResetModal(true)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-gradient-to-r from-rose-900/50 to-orange-900/50 hover:from-rose-800/60 hover:to-orange-800/60 text-rose-200 text-xs font-bold rounded-lg border border-rose-700/60 shadow-sm transition"
            title="Reset AI Model to Blank Slate"
          >
            <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
            <span>Train Reset AI Model (Blank Brain)</span>
          </button>
        </div>

        {/* Save/Load Neural Weights */}
        <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/80">
          <button
            onClick={handleSaveBrain}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg border border-zinc-800 transition"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" /> Save Brain
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[11px] font-semibold bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-lg border border-zinc-800 transition"
          >
            <Upload className="w-3.5 h-3.5 text-indigo-400" /> Load Brain
          </button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleLoadBrain} className="hidden" />
        </div>

        {/* Load/Save Feedback Toast */}
        {loadFeedback && (
          <div
            className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition ${
              loadFeedback.type === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300 shadow-sm'
                : 'bg-rose-950/80 border-rose-500/50 text-rose-300 shadow-sm'
            }`}
          >
            <div className="flex items-center gap-1.5 overflow-hidden">
              {loadFeedback.type === 'success' ? (
                <Check className="w-3.5 h-3.5 flex-shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-rose-400" />
              )}
              <span className="truncate">{loadFeedback.message}</span>
            </div>
            <button
              onClick={() => setLoadFeedback(null)}
              className="text-zinc-400 hover:text-white p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Train Reset */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="flex flex-col gap-4 p-6 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl max-w-md w-full">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Train Reset AI Model</h3>
                <p className="text-xs text-zinc-400">Initialize a fresh base brain or restore defaults</p>
              </div>
            </div>

            <div className="p-3 bg-zinc-950/80 rounded-xl border border-zinc-800 text-xs text-zinc-300 space-y-2">
              <p>
                <strong className="text-rose-400">Blank Brain (Knows Nothing):</strong> Replaces all neural weights with raw random values. Clears replay memory and starts reinforcement learning completely from scratch (Tabula Rasa).
              </p>
              <p className="text-zinc-400">
                <strong className="text-emerald-400">Pretrained Baseline:</strong> Restores the default bootstrap billiard intuition.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={() => handleConfirmReset(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 text-white font-bold text-xs rounded-xl shadow-lg transition"
              >
                <Brain className="w-4 h-4" />
                <span>Reset to Blank Brain (Knows Nothing)</span>
              </button>

              <button
                onClick={() => handleConfirmReset(false)}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs rounded-xl border border-zinc-700 transition"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Reset to Pretrained Heuristics</span>
              </button>

              <button
                onClick={() => setShowResetModal(false)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-zinc-400 hover:text-zinc-200 text-xs font-semibold transition"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
