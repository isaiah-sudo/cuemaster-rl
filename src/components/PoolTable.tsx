import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameManager } from '../game/GameManager';
import { TABLE_CONFIG } from '../physics/constants';
import { Vector2D } from '../physics/Vector2D';
import { Ball } from '../physics/Ball';
import { Lock, Unlock, Flame, Crosshair, Keyboard, ChevronLeft, ChevronRight } from 'lucide-react';

interface PoolTableProps {
  game: GameManager;
}

export const PoolTable: React.FC<PoolTableProps> = ({ game }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [aimAngle, setAimAngle] = useState<number>(0);
  const [shotPower, setShotPower] = useState<number>(14);
  const [isAimLocked, setIsAimLocked] = useState<boolean>(false);

  // Sync state on change
  const [, setTickState] = useState({});

  useEffect(() => {
    const unsub = game.subscribe((state) => {
      if (state.isSimulating) {
        setIsAimLocked(false);
      }
      setTickState({});
    });
    return unsub;
  }, [game]);

  const isPlayerCanShoot =
    (game.state.mode === 'match' && game.state.turn === 'player' && !game.state.isSimulating && !game.state.winner) ||
    (game.state.mode === 'training' && game.state.isTrainingPaused && !game.state.isSimulating);

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

    // Draw Aim Uncertainty Cone for the chosen shot
    if (current) {
      const uncertainty = game.agent.getAimUncertainty(
        game.state.mode === 'match' ? game.state.matchDifficulty : undefined
      );

      ctx.save();
      const spread = uncertainty.angleStd;
      const coneDist = 220;
      const baseAngle = current.cueAngle;

      // Draw cone wedge from cue ball
      ctx.beginPath();
      ctx.moveTo(cue.pos.x, cue.pos.y);
      ctx.arc(cue.pos.x, cue.pos.y, coneDist, baseAngle - spread, baseAngle + spread);
      ctx.closePath();

      // Style cone based on rank level
      if (uncertainty.rankLevel <= 2) {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.55)';
        ctx.setLineDash([4, 4]);
      } else if (uncertainty.rankLevel === 3) {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.14)';
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.65)';
        ctx.setLineDash([3, 3]);
      } else {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.16)';
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.75)';
        ctx.setLineDash([]);
      }
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();

      // Variance indicator badge below cue ball
      const spreadDeg = ((spread * 180) / Math.PI).toFixed(1);
      ctx.fillStyle = uncertainty.rankLevel <= 2 ? '#f87171' : uncertainty.rankLevel === 3 ? '#fbbf24' : '#34d399';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(
        `Aim Variance: ±${spreadDeg}° (${uncertainty.rankTitle})`,
        cue.pos.x,
        cue.pos.y + 24
      );

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
    ctx.strokeStyle = isAimLocked ? '#f59e0b' : 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = isAimLocked ? 2.5 : 1.5;
    ctx.setLineDash(isAimLocked ? [] : [5, 5]);
    ctx.stroke();

    // 2. Ghost cue ball at impact point
    if (closestBall) {
      ctx.beginPath();
      ctx.arc(impactPoint.x, impactPoint.y, cue.radius, 0, Math.PI * 2);
      ctx.strokeStyle = isAimLocked ? '#fbbf24' : 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = isAimLocked ? 2.2 : 1.8;
      ctx.setLineDash([3, 3]);
      ctx.stroke();

      // Normal line: direction target ball will travel
      const normal = closestBall.pos.sub(impactPoint).normalize();
      const targetTrajectory = closestBall.pos.add(normal.mult(120));
      ctx.beginPath();
      ctx.moveTo(closestBall.pos.x, closestBall.pos.y);
      ctx.lineTo(targetTrajectory.x, targetTrajectory.y);
      ctx.strokeStyle = '#38bdf8'; // Sky blue for target path
      ctx.lineWidth = 2.2;
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

    // 3. Floating Locked badge directly on canvas
    if (isAimLocked) {
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🔒 AIM LOCKED', impactPoint.x, impactPoint.y - 18);
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
    if (game.state.mode === 'training' && !game.state.isTrainingPaused) {
      drawAITrainingThoughtRays(ctx);
    } else if (isPlayerCanShoot) {
      drawPlayerAimAssist(ctx);
    }

    // 6. Draw Balls
    for (const ball of game.table.balls) {
      ball.draw(ctx);
    }

    // 7. Draw Cue Stick
    if (isPlayerCanShoot) {
      drawCueStick(ctx);
    }
  };

  const drawSceneRef = useRef(drawScene);
  useEffect(() => {
    drawSceneRef.current = drawScene;
  });

  // Main animation / render loop
  useEffect(() => {
    let animId: number;

    const render = () => {
      game.tick();

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          drawSceneRef.current(ctx);
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [game]);

  const firePlayerShot = useCallback(() => {
    if (!isPlayerCanShoot) return;
    setIsAimLocked(false);
    game.executePlayerShot(aimAngle, shotPower);
  }, [isPlayerCanShoot, game, aimAngle, shotPower]);

  // Mouse / Touch handlers for aiming & locking
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPlayerCanShoot) return;

    if (e.button === 2) {
      // Right-click: unlock shot
      e.preventDefault();
      setIsAimLocked(false);
      return;
    }

    if (e.button === 0) {
      // Left-click: update angle to clicked point and lock in shot!
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = ((e.clientX - rect.left) / rect.width) * TABLE_CONFIG.TOTAL_WIDTH;
      const y = ((e.clientY - rect.top) / rect.height) * TABLE_CONFIG.TOTAL_HEIGHT;
      const mousePos = new Vector2D(x, y);

      const cue = game.table.getCueBall();
      const dir = mousePos.sub(cue.pos);
      if (dir.mag() > 1) {
        setAimAngle(dir.heading());
      }
      setIsAimLocked(true);
    }
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isPlayerCanShoot) return;
    // Right-click unlocks the shot
    setIsAimLocked(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // If locked, lock in current shot and do NOT track cursor
    if (isAimLocked) return;
    if (!isPlayerCanShoot) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * TABLE_CONFIG.TOTAL_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * TABLE_CONFIG.TOTAL_HEIGHT;
    const mousePos = new Vector2D(x, y);

    const cue = game.table.getCueBall();
    const dir = mousePos.sub(cue.pos);
    if (dir.mag() > 1) {
      setAimAngle(dir.heading());
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!isPlayerCanShoot) return;
    e.preventDefault();
    setShotPower((prev) => {
      const delta = e.deltaY < 0 ? 1.0 : -1.0;
      return Math.max(TABLE_CONFIG.MIN_SHOT_POWER, Math.min(TABLE_CONFIG.MAX_SHOT_POWER, +(prev + delta).toFixed(1)));
    });
  };

  // Keyboard Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in a text field
      if (
        (e.target instanceof HTMLInputElement && e.target.type !== 'range') ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (!isPlayerCanShoot) return;

      // 1. Strike ball hotkeys: Space, Enter, or F
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyF') {
        e.preventDefault();
        firePlayerShot();
        return;
      }

      // 2. Lock / Unlock hotkeys: L to toggle, Escape to unlock
      if (e.code === 'KeyL') {
        e.preventDefault();
        setIsAimLocked((prev) => !prev);
        return;
      }
      if (e.code === 'Escape') {
        e.preventDefault();
        setIsAimLocked(false);
        return;
      }

      // 3. Power adjustment: W / Up (+1.5), S / Down (-1.5)
      if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        e.preventDefault();
        setShotPower((prev) => Math.min(TABLE_CONFIG.MAX_SHOT_POWER, +(prev + 1.5).toFixed(1)));
        return;
      }
      if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        e.preventDefault();
        setShotPower((prev) => Math.max(TABLE_CONFIG.MIN_SHOT_POWER, +(prev - 1.5).toFixed(1)));
        return;
      }

      // 4. Power numerical presets 1-9, 0 (10% to 100%)
      if (e.code >= 'Digit1' && e.code <= 'Digit9') {
        const num = parseInt(e.key, 10);
        const fraction = num / 10;
        const powerRange = TABLE_CONFIG.MAX_SHOT_POWER - TABLE_CONFIG.MIN_SHOT_POWER;
        setShotPower(+(TABLE_CONFIG.MIN_SHOT_POWER + fraction * powerRange).toFixed(1));
        return;
      }
      if (e.code === 'Digit0') {
        setShotPower(TABLE_CONFIG.MAX_SHOT_POWER);
        return;
      }

      // 5. Fine aim adjustment: A / Left arrow counter-clockwise, D / Right arrow clockwise
      const aimStep = e.shiftKey ? 0.008 : 0.03;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        e.preventDefault();
        setAimAngle((prev) => prev - aimStep);
        return;
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        e.preventDefault();
        setAimAngle((prev) => prev + aimStep);
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlayerCanShoot, aimAngle, shotPower, firePlayerShot]);

  return (
    <div className="relative flex flex-col items-center justify-center p-3 select-none">
      <div className="relative rounded-2xl shadow-2xl p-1 bg-stone-900 border border-stone-800">
        <canvas
          ref={canvasRef}
          width={TABLE_CONFIG.TOTAL_WIDTH}
          height={TABLE_CONFIG.TOTAL_HEIGHT}
          className={`rounded-xl max-w-full h-auto block ${isAimLocked ? 'cursor-default' : 'cursor-crosshair'}`}
          onMouseDown={handleMouseDown}
          onContextMenu={handleContextMenu}
          onMouseMove={handleMouseMove}
          onWheel={handleWheel}
        />

        {/* Turn Overlay Badge (Top Left) */}
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

        {/* Shot Lock / Aim State Banner (Top Right) */}
        {isPlayerCanShoot ? (
          <div className="absolute top-4 right-6 flex items-center gap-2">
            {isAimLocked ? (
              <div className="px-3 py-1.5 rounded-full text-xs font-bold tracking-wide border shadow-lg flex items-center gap-1.5 bg-amber-500/25 border-amber-500/60 text-amber-300 backdrop-blur-md animate-pulse">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Aim Locked • Set Power & Hit Fire (Right-Click to Unlock)</span>
              </div>
            ) : (
              <div className="px-3 py-1.5 rounded-full text-xs font-medium tracking-wide border shadow-md flex items-center gap-1.5 bg-black/70 border-stone-700/70 text-stone-300 backdrop-blur-md">
                <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
                <span>Click to Lock Shot | Space to Fire</span>
              </div>
            )}
          </div>
        ) : game.state.aiThought ? (
          <div className="absolute top-4 right-6 flex items-center gap-2 max-w-sm pointer-events-none">
            <div className="px-3 py-1.5 rounded-full text-xs font-medium bg-stone-900/85 border border-stone-700/80 text-amber-200 backdrop-blur-md shadow-lg flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px] uppercase tracking-wider border border-amber-500/30 whitespace-nowrap">
                {game.state.aiRankTitle || 'AI'}
              </span>
              <span className="italic truncate">"{game.state.aiThought}"</span>
            </div>
          </div>
        ) : null}

        {/* Foul banner alert */}
        {game.state.foulMessage && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-rose-950/90 border border-rose-500/60 text-rose-200 text-xs font-bold rounded-lg shadow-xl backdrop-blur-md animate-bounce">
            ⚠️ {game.state.foulMessage}
          </div>
        )}
      </div>

      {/* Player Aim, Power & Fire Controls (Below Table) */}
      {isPlayerCanShoot && (
        <div className="mt-3 flex flex-col items-center gap-2.5 p-3.5 bg-stone-900/90 border border-stone-800 rounded-2xl backdrop-blur-md w-full max-w-4xl shadow-xl">
          {/* Main Action Strip */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 w-full">
            {/* Lock / Unlock Toggle Button */}
            <button
              onClick={() => setIsAimLocked((prev) => !prev)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border transition ${
                isAimLocked
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-md shadow-amber-950/40 hover:bg-amber-500/30'
                  : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
              }`}
              title={isAimLocked ? 'Right-click canvas or click here to unlock aim' : 'Click canvas or here to lock aim'}
            >
              {isAimLocked ? <Lock className="w-4 h-4 text-amber-400" /> : <Unlock className="w-4 h-4 text-stone-400" />}
              <span>{isAimLocked ? 'Aim Locked' : 'Aim Tracking'}</span>
              <span className="text-[10px] opacity-70 font-mono">({isAimLocked ? 'Right-Click' : 'Click'})</span>
            </button>

            {/* Power Adjustment Slider & Quick Presets */}
            <div className="flex items-center gap-2 text-xs text-stone-300 font-semibold">
              <span className="uppercase text-stone-400 font-bold">Power:</span>
              <input
                type="range"
                min={TABLE_CONFIG.MIN_SHOT_POWER}
                max={TABLE_CONFIG.MAX_SHOT_POWER}
                step={0.5}
                value={shotPower}
                onChange={(e) => setShotPower(parseFloat(e.target.value))}
                className="w-24 sm:w-32 accent-emerald-500 cursor-pointer"
              />
              <span className="text-emerald-400 font-mono w-10 text-right font-bold">
                {Math.round((shotPower / TABLE_CONFIG.MAX_SHOT_POWER) * 100)}%
              </span>

              {/* Quick Preset Buttons */}
              <div className="hidden sm:flex items-center gap-1 ml-1">
                {[
                  { label: 'Min', val: TABLE_CONFIG.MIN_SHOT_POWER },
                  { label: '50%', val: TABLE_CONFIG.MAX_SHOT_POWER * 0.5 },
                  { label: '75%', val: TABLE_CONFIG.MAX_SHOT_POWER * 0.75 },
                  { label: 'Max', val: TABLE_CONFIG.MAX_SHOT_POWER },
                ].map(({ label, val }) => (
                  <button
                    key={label}
                    onClick={() => setShotPower(+val.toFixed(1))}
                    className="px-2 py-1 text-[10px] font-bold bg-stone-800 hover:bg-stone-700 text-stone-300 rounded border border-stone-700 transition"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fine Aim Buttons */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setAimAngle((prev) => prev - 0.03)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg border border-stone-700 transition"
                title="Fine aim counter-clockwise [A]"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Fine Left [A]</span>
              </button>
              <button
                onClick={() => setAimAngle((prev) => prev + 0.03)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg border border-stone-700 transition"
                title="Fine aim clockwise [D]"
              >
                <span>Fine Right [D]</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* FIRE BUTTON */}
            <button
              onClick={firePlayerShot}
              disabled={game.state.isSimulating}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-black text-sm tracking-wide shadow-xl transition transform active:scale-95 disabled:opacity-50 ${
                isAimLocked
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white shadow-amber-950/60 ring-2 ring-amber-400/50 animate-pulse'
                  : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-950/50'
              }`}
            >
              <Flame className="w-4 h-4 text-amber-200" />
              <span>FIRE SHOT [Space]</span>
            </button>
          </div>

          {/* Hotkey Cheatsheet Bar */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-stone-400 pt-2 border-t border-stone-800/80 w-full font-medium">
            <span className="flex items-center gap-1 text-emerald-400">
              <Keyboard className="w-3.5 h-3.5" />
              <strong>Hotkeys:</strong>
            </span>
            <span><kbd className="px-1.5 py-0.5 bg-stone-800 rounded border border-stone-700 text-stone-200 font-mono text-[10px]">Left Click</kbd> Lock Shot</span>
            <span><kbd className="px-1.5 py-0.5 bg-stone-800 rounded border border-stone-700 text-stone-200 font-mono text-[10px]">Right Click / Esc</kbd> Unlock</span>
            <span><kbd className="px-1.5 py-0.5 bg-stone-800 rounded border border-stone-700 text-stone-200 font-mono text-[10px]">Space / Enter / F</kbd> Fire</span>
            <span><kbd className="px-1.5 py-0.5 bg-stone-800 rounded border border-stone-700 text-stone-200 font-mono text-[10px]">W / S or ↑ / ↓ or Scroll</kbd> Power</span>
            <span><kbd className="px-1.5 py-0.5 bg-stone-800 rounded border border-stone-700 text-stone-200 font-mono text-[10px]">A / D or ← / →</kbd> Aim</span>
            <span><kbd className="px-1.5 py-0.5 bg-stone-800 rounded border border-stone-700 text-stone-200 font-mono text-[10px]">1-9</kbd> Power Presets</span>
          </div>
        </div>
      )}
    </div>
  );
};
