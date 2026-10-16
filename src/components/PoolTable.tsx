import React, { useRef, useEffect, useState } from 'react';
import { GameManager } from '../game/GameManager';
import { TABLE_CONFIG } from '../physics/constants';
import { Vector2D } from '../physics/Vector2D';
import { Ball } from '../physics/Ball';

interface PoolTableProps {
  game: GameManager;
}

export const PoolTable: React.FC<PoolTableProps> = ({ game }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [aimAngle, setAimAngle] = useState<number>(0);
  const [shotPower, setShotPower] = useState<number>(14);
  const [isDraggingAim, setIsDraggingAim] = useState<boolean>(false);
  const [isPullingCue, setIsPullingCue] = useState<boolean>(false);
  const [dragStartPos, setDragStartPos] = useState<Vector2D | null>(null);

  // Sync state on change
  const [, setTickState] = useState({});

  useEffect(() => {
    const unsub = game.subscribe(() => {
      setTickState({});
    });
    return unsub;
  }, [game]);

  // Main animation / render loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      game.tick();

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          drawScene(ctx);
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [game, aimAngle, shotPower, isPullingCue]);

  const drawScene = (ctx: CanvasRenderingContext2D) => {
    const { TOTAL_WIDTH, TOTAL_HEIGHT, FELT_X, FELT_Y, FELT_WIDTH, FELT_HEIGHT } = TABLE_CONFIG;

    ctx.clearRect(0, 0, TOTAL_WIDTH, TOTAL_HEIGHT);

    // 1. Wooden Outer Rails
    const woodGrad = ctx.createLinearGradient(0, 0, TOTAL_WIDTH, TOTAL_HEIGHT);
    woodGrad.addColorStop(0, '#2e190d');
    woodGrad.addColorStop(0.5, '#452614');
    woodGrad.addColorStop(1, '#2e190d');
    ctx.fillStyle = woodGrad;
    ctx.beginPath();
    ctx.roundRect(0, 0, TOTAL_WIDTH, TOTAL_HEIGHT, 16);
    ctx.fill();

    // Wood border bevel highlight
    ctx.strokeStyle = '#5a341d';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(2, 2, TOTAL_WIDTH - 4, TOTAL_HEIGHT - 4, 14);
    ctx.stroke();

    // Inlaid Mother-of-Pearl Sights / Diamonds along rails
    drawDiamonds(ctx);

    // 2. Billiard Green Felt Table Surface
    const feltGrad = ctx.createRadialGradient(
      FELT_X + FELT_WIDTH / 2,
      FELT_Y + FELT_HEIGHT / 2,
      50,
      FELT_X + FELT_WIDTH / 2,
      FELT_Y + FELT_HEIGHT / 2,
      FELT_WIDTH * 0.7
    );
    feltGrad.addColorStop(0, '#107a4b');
    feltGrad.addColorStop(0.7, '#0c623b');
    feltGrad.addColorStop(1, '#094d2e');

    ctx.fillStyle = feltGrad;
    ctx.fillRect(FELT_X, FELT_Y, FELT_WIDTH, FELT_HEIGHT);

    // Subtle table markings
    drawTableMarkings(ctx);

    // 3. Cushion Rubber Lips
    drawCushions(ctx);

    // 4. Metallic Pockets
    drawPockets(ctx);

    // 5. Draw Visualizer Rays (AI candidate shots or Player Aim Guide)
    if (game.state.mode === 'training') {
      drawAITrainingThoughtRays(ctx);
    } else if (game.state.turn === 'player' && !game.state.isSimulating && !game.state.winner) {
      drawPlayerAimAssist(ctx);
    }

    // 6. Draw Balls
    for (const ball of game.table.balls) {
      ball.draw(ctx);
    }

    // 7. Draw Cue Stick
    if (game.state.mode === 'match' && game.state.turn === 'player' && !game.state.isSimulating && !game.state.winner) {
      drawCueStick(ctx);
    }
  };

  const drawDiamonds = (ctx: CanvasRenderingContext2D) => {
    const { FELT_X, FELT_Y, FELT_WIDTH, FELT_HEIGHT, RAIL_WIDTH } = TABLE_CONFIG;
    ctx.fillStyle = '#fef08a';

    const drawDiamond = (x: number, y: number) => {
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    };

    // Horizontal rail sights (3 per quadrant)
    for (let i = 1; i <= 3; i++) {
      const x1 = FELT_X + (FELT_WIDTH / 8) * i;
      const x2 = FELT_X + FELT_WIDTH / 2 + (FELT_WIDTH / 8) * i;
      drawDiamond(x1, FELT_Y - RAIL_WIDTH / 2);
      drawDiamond(x2, FELT_Y - RAIL_WIDTH / 2);
      drawDiamond(x1, FELT_Y + FELT_HEIGHT + RAIL_WIDTH / 2);
      drawDiamond(x2, FELT_Y + FELT_HEIGHT + RAIL_WIDTH / 2);
    }

    // Vertical rail sights (3 per side)
    for (let i = 1; i <= 3; i++) {
      const y = FELT_Y + (FELT_HEIGHT / 4) * i;
      drawDiamond(FELT_X - RAIL_WIDTH / 2, y);
      drawDiamond(FELT_X + FELT_WIDTH + RAIL_WIDTH / 2, y);
    }
  };

  const drawTableMarkings = (ctx: CanvasRenderingContext2D) => {
    const { FELT_X, FELT_Y, FELT_WIDTH, FELT_HEIGHT } = TABLE_CONFIG;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;

    // Head String (Break Line)
    const headX = FELT_X + FELT_WIDTH * 0.25;
    ctx.beginPath();
    ctx.moveTo(headX, FELT_Y);
    ctx.lineTo(headX, FELT_Y + FELT_HEIGHT);
    ctx.stroke();

    // Head Spot
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(headX, FELT_Y + FELT_HEIGHT / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Foot Spot (Rack apex)
    const footX = FELT_X + FELT_WIDTH * 0.72;
    ctx.beginPath();
    ctx.arc(footX, FELT_Y + FELT_HEIGHT / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();
  };

  const drawCushions = (ctx: CanvasRenderingContext2D) => {
    ctx.save();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#064e3b';
    for (const c of game.table.cushions) {
      ctx.beginPath();
      ctx.moveTo(c.p1.x, c.p1.y);
      ctx.lineTo(c.p2.x, c.p2.y);
      ctx.stroke();
    }
    ctx.restore();
  };

  const drawPockets = (ctx: CanvasRenderingContext2D) => {
    for (const p of game.table.pockets) {
      // Brass / leather rim
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.radius + 2, 0, Math.PI * 2);
      ctx.fillStyle = '#1c1917';
      ctx.fill();

      // Deep dark pocket well
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.radius - 2, 0, Math.PI * 2);
      ctx.fillStyle = '#09090b';
      ctx.fill();

      // Inner shadow
      const rimGrad = ctx.createRadialGradient(p.pos.x, p.pos.y, p.radius * 0.4, p.pos.x, p.pos.y, p.radius);
      rimGrad.addColorStop(0, 'rgba(0,0,0,0.9)');
      rimGrad.addColorStop(1, 'rgba(40,40,40,0.4)');
      ctx.fillStyle = rimGrad;
      ctx.fill();
    }
  };

  const drawAITrainingThoughtRays = (ctx: CanvasRenderingContext2D) => {
    const cue = game.table.getCueBall();
    if (cue.isPocketed) return;

    const candidates = game.state.allCandidates;
    const current = game.state.currentCandidate;

    // Draw candidate evaluation rays
    for (const cand of candidates.slice(0, 10)) {
      const isSelected = current && current.targetBall.id === cand.targetBall.id && current.pocketId === cand.pocketId;

      ctx.save();
      // Cue to target line
      ctx.beginPath();
      ctx.moveTo(cue.pos.x, cue.pos.y);
      ctx.lineTo(cand.targetBall.pos.x, cand.targetBall.pos.y);

      if (isSelected) {
        ctx.strokeStyle = '#10b981'; // Emerald green for chosen shot
        ctx.lineWidth = 2.5;
        ctx.setLineDash([]);
      } else {
        const qScore = cand.qValue;
        if (qScore > 60) {
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.45)';
        } else if (qScore > 20) {
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
        } else {
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.2)';
        }
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 4]);
      }
      ctx.stroke();

      // Target to pocket line
      ctx.beginPath();
      ctx.moveTo(cand.targetBall.pos.x, cand.targetBall.pos.y);
      ctx.lineTo(cand.pocketPos.x, cand.pocketPos.y);
      if (isSelected) {
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([]);
      } else {
        ctx.lineWidth = 1;
      }
      ctx.stroke();

      // Q-value badge on target ball
      if (isSelected) {
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Q: ${Math.round(cand.qValue)}`, cand.targetBall.pos.x, cand.targetBall.pos.y - 18);
      }

      ctx.restore();
    }
  };

  const drawPlayerAimAssist = (ctx: CanvasRenderingContext2D) => {
    const cue = game.table.getCueBall();
    if (cue.isPocketed) return;

    const aimDir = Vector2D.fromAngle(aimAngle, 1);
    const activeBalls = game.table.balls.filter((b) => !b.isPocketed && b.number !== 0);

    // Find first ball in line of sight
    let closestBall: Ball | null = null;
    let minT = 800; // max ray length

    for (const b of activeBalls) {
      const toBall = b.pos.sub(cue.pos);
      const proj = toBall.dot(aimDir);

      if (proj > 0) {
        const perpDistSq = toBall.magSq() - proj * proj;
        const radiusSum = cue.radius + b.radius;

        if (perpDistSq < radiusSum * radiusSum) {
          const delta = Math.sqrt(radiusSum * radiusSum - perpDistSq);
          const t = proj - delta;
          if (t > 0 && t < minT) {
            minT = t;
            closestBall = b;
          }
        }
      }
    }

    ctx.save();

    // 1. Projected aim line from cue ball
    const impactPoint = cue.pos.add(aimDir.mult(minT));
    ctx.beginPath();
    ctx.moveTo(cue.pos.x, cue.pos.y);
    ctx.lineTo(impactPoint.x, impactPoint.y);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);
    ctx.stroke();

    // 2. Ghost cue ball at impact point
    if (closestBall) {
      ctx.beginPath();
      ctx.arc(impactPoint.x, impactPoint.y, cue.radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([3, 3]);
      ctx.stroke();

      // Normal line: direction target ball will travel
      const normal = closestBall.pos.sub(impactPoint).normalize();
      const targetTrajectory = closestBall.pos.add(normal.mult(120));
      ctx.beginPath();
      ctx.moveTo(closestBall.pos.x, closestBall.pos.y);
      ctx.lineTo(targetTrajectory.x, targetTrajectory.y);
      ctx.strokeStyle = '#38bdf8'; // Sky blue for target path
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.stroke();

      // Tangent line: cue ball deflection
      const tangent = new Vector2D(-normal.y, normal.x);
      const dotTangent = aimDir.dot(tangent);
      const cueDeflection = impactPoint.add(tangent.mult(dotTangent * 60));
      ctx.beginPath();
      ctx.moveTo(impactPoint.x, impactPoint.y);
      ctx.lineTo(cueDeflection.x, cueDeflection.y);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([2, 4]);
      ctx.stroke();
    }

    ctx.restore();
  };

  const drawCueStick = (ctx: CanvasRenderingContext2D) => {
    const cue = game.table.getCueBall();
    if (cue.isPocketed) return;

    ctx.save();
    ctx.translate(cue.pos.x, cue.pos.y);
    ctx.rotate(aimAngle + Math.PI); // Points backward from aim angle

    const pullBack = 15 + (shotPower / TABLE_CONFIG.MAX_SHOT_POWER) * 65;
    const stickLength = 220;

    // Wood cue shaft
    const cueGrad = ctx.createLinearGradient(pullBack, -3, pullBack + stickLength, 5);
    cueGrad.addColorStop(0, '#fef3c7'); // Maple tip
    cueGrad.addColorStop(0.3, '#d97706'); // Ash
    cueGrad.addColorStop(0.8, '#451a03'); // Dark walnut butt
    cueGrad.addColorStop(1, '#1c1917');

    ctx.fillStyle = cueGrad;
    ctx.beginPath();
    ctx.moveTo(pullBack, -2.5);
    ctx.lineTo(pullBack + stickLength, -5.5);
    ctx.lineTo(pullBack + stickLength, 5.5);
    ctx.lineTo(pullBack, 2.5);
    ctx.closePath();
    ctx.fill();

    // Cue chalk tip (blue)
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(pullBack - 3, -2.5, 3, 5);

    // Ferrule (white)
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(pullBack, -2.5, 8, 5);

    ctx.restore();
  };

  // Mouse / Touch handlers for aiming & shooting
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (game.state.turn !== 'player' || game.state.isSimulating || game.state.winner) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * TABLE_CONFIG.TOTAL_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * TABLE_CONFIG.TOTAL_HEIGHT;
    const mousePos = new Vector2D(x, y);

    const cue = game.table.getCueBall();

    // If cue is clicked or pulled back, start power pull
    const distToCue = mousePos.dist(cue.pos);
    if (distToCue < 40) {
      setIsPullingCue(true);
      setDragStartPos(mousePos);
    } else {
      setIsDraggingAim(true);
      updateAimFromMouse(mousePos);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * TABLE_CONFIG.TOTAL_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * TABLE_CONFIG.TOTAL_HEIGHT;
    const mousePos = new Vector2D(x, y);

    if (isPullingCue && dragStartPos) {
      const cue = game.table.getCueBall();
      const pullDist = mousePos.dist(cue.pos);
      const power = Math.max(
        TABLE_CONFIG.MIN_SHOT_POWER,
        Math.min(TABLE_CONFIG.MAX_SHOT_POWER, (pullDist / 100) * TABLE_CONFIG.MAX_SHOT_POWER)
      );
      setShotPower(power);
    } else if (isDraggingAim || (!game.state.isSimulating && game.state.turn === 'player')) {
      updateAimFromMouse(mousePos);
    }
  };

  const handleMouseUp = () => {
    if (isPullingCue) {
      setIsPullingCue(false);
      setDragStartPos(null);
      // Fire shot!
      game.executePlayerShot(aimAngle, shotPower);
    }
    setIsDraggingAim(false);
  };

  const updateAimFromMouse = (mousePos: Vector2D) => {
    const cue = game.table.getCueBall();
    const dir = mousePos.sub(cue.pos);
    setAimAngle(dir.heading());
  };

  return (
    <div className="relative flex flex-col items-center justify-center p-3 select-none">
      <div className="relative rounded-2xl shadow-2xl p-1 bg-stone-900 border border-stone-800">
        <canvas
          ref={canvasRef}
          width={TABLE_CONFIG.TOTAL_WIDTH}
          height={TABLE_CONFIG.TOTAL_HEIGHT}
          className="rounded-xl cursor-crosshair max-w-full h-auto block"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setIsDraggingAim(false);
            setIsPullingCue(false);
          }}
        />

        {/* Turn Overlay Badge */}
        <div className="absolute top-4 left-6 flex items-center gap-2">
          {game.state.mode === 'match' ? (
            <div
              className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase border shadow-md flex items-center gap-1.5 backdrop-blur-md ${
                game.state.turn === 'player'
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                  : 'bg-indigo-500/20 border-indigo-500/50 text-indigo-400'
              }`}
            >
              <span className={`w-2 h-2 rounded-full animate-pulse ${game.state.turn === 'player' ? 'bg-emerald-400' : 'bg-indigo-400'}`} />
              {game.state.turn === 'player' ? 'Your Turn' : 'AI Turn'}
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase border shadow-md flex items-center gap-1.5 bg-purple-500/20 border-purple-500/50 text-purple-300 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
              RL Simulation Active
            </div>
          )}

          {/* Status Message */}
          <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-black/60 text-stone-200 border border-stone-700/60 backdrop-blur-md">
            {game.state.statusMessage}
          </div>
        </div>

        {/* Foul banner alert */}
        {game.state.foulMessage && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-rose-950/90 border border-rose-500/60 text-rose-200 text-xs font-bold rounded-lg shadow-xl backdrop-blur-md animate-bounce">
            ⚠️ {game.state.foulMessage}
          </div>
        )}
      </div>

      {/* Quick Player Aim & Power Controls (Below Table) */}
      {game.state.mode === 'match' && game.state.turn === 'player' && !game.state.winner && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-4 p-3 bg-stone-900/80 border border-stone-800 rounded-xl backdrop-blur-md w-full max-w-3xl">
          <div className="flex items-center gap-2 text-xs text-stone-400 font-semibold uppercase">
            <span>Power:</span>
            <input
              type="range"
              min={TABLE_CONFIG.MIN_SHOT_POWER}
              max={TABLE_CONFIG.MAX_SHOT_POWER}
              step={0.5}
              value={shotPower}
              onChange={(e) => setShotPower(parseFloat(e.target.value))}
              className="w-32 accent-emerald-500 cursor-pointer"
            />
            <span className="text-emerald-400 font-mono w-10 text-right">
              {Math.round((shotPower / TABLE_CONFIG.MAX_SHOT_POWER) * 100)}%
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAimAngle((prev) => prev - 0.03)}
              className="px-2.5 py-1 text-xs bg-stone-800 hover:bg-stone-700 text-stone-300 rounded border border-stone-700 transition"
              title="Fine aim counter-clockwise"
            >
              ↺ Fine Left
            </button>
            <button
              onClick={() => setAimAngle((prev) => prev + 0.03)}
              className="px-2.5 py-1 text-xs bg-stone-800 hover:bg-stone-700 text-stone-300 rounded border border-stone-700 transition"
              title="Fine aim clockwise"
            >
              Fine Right ↻
            </button>
          </div>

          <button
            onClick={() => game.executePlayerShot(aimAngle, shotPower)}
            disabled={game.state.isSimulating}
            className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm rounded-lg shadow-lg shadow-emerald-900/30 transition transform active:scale-95 disabled:opacity-50"
          >
            🎱 Strike Cue Ball
          </button>
        </div>
      )}
    </div>
  );
};
