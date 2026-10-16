import React, { useState, useEffect } from 'react';
import { GameManager } from '../game/GameManager';
import { User, Bot, RotateCcw, Award, Sparkles } from 'lucide-react';
import { BALL_COLORS } from '../physics/Ball';

interface MatchDashboardProps {
  game: GameManager;
}

export const MatchDashboard: React.FC<MatchDashboardProps> = ({ game }) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    const unsub = game.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsub;
  }, [game]);

  const { turn, playerType, aiType, winner, winReason } = game.state;

  const activeBalls = game.table.balls.filter((b) => !b.isPocketed);
  const solidsRemaining = activeBalls.filter((b) => b.type === 'solid').map((b) => b.number);
  const stripesRemaining = activeBalls.filter((b) => b.type === 'stripe').map((b) => b.number);

  return (
    <div className="flex flex-col items-center gap-4 w-full max-w-4xl p-4 bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-xl backdrop-blur-md">
      {/* 1v1 Head-to-Head Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
        {/* Player Card */}
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl border transition ${
            turn === 'player' && !winner
              ? 'bg-emerald-950/40 border-emerald-500/60 shadow-lg shadow-emerald-950/50'
              : 'bg-zinc-950/50 border-zinc-800/80 opacity-80'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-400">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-zinc-100">You (Player)</span>
                {turn === 'player' && !winner && (
                  <span className="px-2 py-0.5 text-[10px] uppercase font-bold bg-emerald-500 text-black rounded-full animate-pulse">
                    Shooting
                  </span>
                )}
              </div>
              <div className="text-xs text-zinc-400 capitalize mt-0.5">
                Target:{' '}
                <span className="font-semibold text-emerald-300">
                  {playerType === 'any' ? 'Open Table' : `${playerType}s`}
                </span>
              </div>
            </div>
          </div>

          {/* Mini balls remaining */}
          <div className="flex items-center gap-1">
            {playerType === 'solid' ? (
              solidsRemaining.map((n) => (
                <div
                  key={n}
                  className="w-4 h-4 rounded-full border border-black/40 text-[9px] font-bold text-black flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: BALL_COLORS[n] }}
                  title={`Solid #${n}`}
                >
                  {n}
                </div>
              ))
            ) : playerType === 'stripe' ? (
              stripesRemaining.map((n) => (
                <div
                  key={n}
                  className="w-4 h-4 rounded-full border border-black/40 text-[9px] font-bold text-black flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: BALL_COLORS[n] }}
                  title={`Stripe #${n}`}
                >
                  {n}
                </div>
              ))
            ) : (
              <span className="text-xs text-zinc-500 italic">Break to assign</span>
            )}
          </div>
        </div>

        {/* AI Card */}
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl border transition ${
            turn === 'ai' && !winner
              ? 'bg-indigo-950/40 border-indigo-500/60 shadow-lg shadow-indigo-950/50'
              : 'bg-zinc-950/50 border-zinc-800/80 opacity-80'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-zinc-100">Deep RL Agent</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                    game.agent.brainType === 'blank'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                  }`}
                >
                  {game.agent.brainType === 'blank'
                    ? `Blank Brain (${game.agent.metrics.episode} eps)`
                    : `Trained (Ep ${game.agent.metrics.episode})`}
                </span>
                {turn === 'ai' && !winner && (
                  <span className="px-2 py-0.5 text-[10px] uppercase font-bold bg-indigo-500 text-white rounded-full animate-pulse">
                    Evaluating...
                  </span>
                )}
              </div>
              <div className="text-xs text-zinc-400 capitalize mt-0.5">
                Target:{' '}
                <span className="font-semibold text-indigo-300">
                  {aiType === 'any' ? 'Open Table' : `${aiType}s`}
                </span>
              </div>
            </div>
          </div>

          {/* Mini balls remaining */}
          <div className="flex items-center gap-1">
            {aiType === 'solid' ? (
              solidsRemaining.map((n) => (
                <div
                  key={n}
                  className="w-4 h-4 rounded-full border border-black/40 text-[9px] font-bold text-black flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: BALL_COLORS[n] }}
                  title={`Solid #${n}`}
                >
                  {n}
                </div>
              ))
            ) : aiType === 'stripe' ? (
              stripesRemaining.map((n) => (
                <div
                  key={n}
                  className="w-4 h-4 rounded-full border border-black/40 text-[9px] font-bold text-black flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: BALL_COLORS[n] }}
                  title={`Stripe #${n}`}
                >
                  {n}
                </div>
              ))
            ) : (
              <span className="text-xs text-zinc-500 italic">Waiting...</span>
            )}
          </div>
        </div>
      </div>

      {/* Match Actions */}
      <div className="flex items-center justify-between w-full pt-2 border-t border-zinc-800">
        <div className="flex items-center gap-2">
          <button
            onClick={() => game.startMatch('player')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg border border-zinc-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restart Match (You Break)
          </button>
          <button
            onClick={() => game.startMatch('ai')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg border border-zinc-700 transition"
          >
            <Bot className="w-3.5 h-3.5" /> AI Breaks
          </button>
        </div>

        <div className="text-xs text-zinc-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Rules: 8-Ball Scratch & Pocketing Rules Apply</span>
        </div>
      </div>

      {/* Win / Game Over Modal Overlay */}
      {winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="flex flex-col items-center text-center p-6 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl max-w-sm w-full">
            <div className={`p-4 rounded-2xl mb-3 ${winner === 'player' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40'}`}>
              <Award className="w-10 h-10" />
            </div>

            <h3 className="text-2xl font-black tracking-tight text-white mb-1">
              {winner === 'player' ? 'VICTORY!' : 'AI WINS!'}
            </h3>
            <p className="text-xs text-zinc-400 mb-5">{winReason}</p>

            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={() => game.startMatch('player')}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm rounded-xl shadow-lg transition"
              >
                Play Rematch
              </button>
              <button
                onClick={() => game.setMode('training')}
                className="w-full py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs rounded-xl border border-zinc-700 transition"
              >
                Return to RL Training Lab
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
