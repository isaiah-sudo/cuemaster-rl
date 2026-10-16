import React, { useState, useEffect, useMemo } from 'react';
import { GameManager, type GameMode } from './game/GameManager';
import { PoolTable } from './components/PoolTable';
import { RLDashboard } from './components/RLDashboard';
import { MatchDashboard } from './components/MatchDashboard';
import { soundManager } from './audio/SoundEffects';
import { Volume2, VolumeX, Cpu, Swords, Sparkles, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';

export const App: React.FC = () => {
  // Instantiate singleton GameManager
  const game = useMemo(() => new GameManager(), []);
  const [mode, setMode] = useState<GameMode>(game.state.mode);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [showHowItWorks, setShowHowItWorks] = useState<boolean>(false);

  useEffect(() => {
    const unsub = game.subscribe((s) => {
      setMode(s.mode);
    });
    return unsub;
  }, [game]);

  const toggleSound = () => {
    const next = !soundEnabled;
    soundManager.enabled = next;
    setSoundEnabled(next);
  };

  const handleSwitchMode = (newMode: GameMode) => {
    setMode(newMode);
    game.setMode(newMode);
  };

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 flex flex-col items-center">
      {/* Top Header Bar */}
      <header className="w-full max-w-6xl px-4 py-3 flex flex-wrap items-center justify-between border-b border-stone-800/80 bg-stone-900/60 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-950/50 text-xl font-black">
            🎱
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-white m-0">CueMaster RL</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                v2.4
              </span>
            </div>
            <p className="text-xs text-stone-400 m-0">2D Pool Reinforcement Learning Simulator & 1v1 Human Arena</p>
          </div>
        </div>

        {/* Center: Mode Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-stone-900 border border-stone-800 rounded-xl my-1">
          <button
            onClick={() => handleSwitchMode('training')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              mode === 'training'
                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>RL Simulation Lab</span>
          </button>

          <button
            onClick={() => handleSwitchMode('match')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold transition ${
              mode === 'match'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span>Play Against AI</span>
          </button>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleSound}
            className="p-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition"
            title={soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-stone-500" />}
          </button>
          <button
            onClick={() => setShowHowItWorks(!showHowItWorks)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold border border-stone-700 transition"
          >
            <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI Architecture</span>
            {showHowItWorks ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </header>

      {/* Collapsible Architecture & Rules Modal/Drawer */}
      {showHowItWorks && (
        <section className="w-full max-w-5xl my-3 p-4 bg-stone-900/95 border border-stone-800 rounded-2xl shadow-2xl backdrop-blur-md animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-stone-300">
            <div className="p-3 bg-stone-950/70 rounded-xl border border-stone-800">
              <h4 className="font-bold text-emerald-400 mb-1 flex items-center gap-1.5">
                <Cpu className="w-4 h-4" /> 1. Ghost Ball Kinematics
              </h4>
              <p className="leading-relaxed">
                For every legal target ball and pocket, the agent calculates the geometric impact point (
                <span className="text-stone-100 font-mono">G = T - 2R · û</span>), the cut angle cosine{' '}
                <span className="text-stone-100 font-mono">cos φ</span>, and performs continuous raycasts across the table to ensure paths are free from obstructing balls.
              </p>
            </div>

            <div className="p-3 bg-stone-950/70 rounded-xl border border-stone-800">
              <h4 className="font-bold text-indigo-400 mb-1 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" /> 2. Deep Q-Network (DQN)
              </h4>
              <p className="leading-relaxed">
                A 4-layer neural network with LeakyReLU activations processes 14 table and shot features (cut angle, clearance, pocket distance, power, cue leave). It predicts the expected Q-value (long-term return) to select the optimal shot using an ε-greedy policy.
              </p>
            </div>

            <div className="p-3 bg-stone-950/70 rounded-xl border border-stone-800">
              <h4 className="font-bold text-amber-400 mb-1 flex items-center gap-1.5">
                <Swords className="w-4 h-4" /> 3. Play Whenever Ready
              </h4>
              <p className="leading-relaxed">
                Watch the AI learn in real-time or boost it with <strong>100x Turbo mode</strong>. Whenever you want to test your skills, click <strong>Play Against AI</strong>. The exact neural network weights you trained will compete against you in standard 8-ball rules!
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Main Table Arena */}
      <main className="w-full flex flex-col items-center justify-center p-2">
        <PoolTable game={game} />

        {/* Dashboard beneath table */}
        <div className="w-full flex justify-center mt-2 mb-6">
          {mode === 'training' ? (
            <RLDashboard game={game} />
          ) : (
            <MatchDashboard game={game} />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
