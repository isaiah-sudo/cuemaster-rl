import { Vector2D } from './Vector2D';
import { Ball } from './Ball';
import { TABLE_CONFIG, getPockets, getCushions, type Pocket, type CushionSegment } from './constants';

export interface ShotResult {
  pottedBalls: Ball[];
  cuePotted: boolean;
  firstHitBall: Ball | null;
  cushionHitsAfterContact: number;
  totalBallCollisions: number;
  stepsSimulated: number;
}

export type SoundEvent = 
  | { type: 'ball-hit'; strength: number }
  | { type: 'cushion-hit'; strength: number }
  | { type: 'pocket'; ballNumber: number };

export class Table {
  balls: Ball[] = [];
  pockets: Pocket[];
  cushions: CushionSegment[];
  soundEvents: SoundEvent[] = [];

  constructor() {
    this.pockets = getPockets();
    this.cushions = getCushions();
    this.setupStandardRack();
  }

  getCueBall(): Ball {
    let cue = this.balls.find((b) => b.number === 0);
    if (!cue) {
      cue = new Ball(0, TABLE_CONFIG.FELT_X + TABLE_CONFIG.FELT_WIDTH * 0.25, TABLE_CONFIG.FELT_Y + TABLE_CONFIG.FELT_HEIGHT / 2);
      this.balls.unshift(cue);
    }
    return cue;
  }

  setupStandardRack(): void {
    this.balls = [];
    const cueX = TABLE_CONFIG.FELT_X + TABLE_CONFIG.FELT_WIDTH * 0.25;
    const cueY = TABLE_CONFIG.FELT_Y + TABLE_CONFIG.FELT_HEIGHT * 0.5;

    // Cue ball
    this.balls.push(new Ball(0, cueX, cueY));

    const footX = TABLE_CONFIG.FELT_X + TABLE_CONFIG.FELT_WIDTH * 0.72;
    const footY = cueY;
    const r = TABLE_CONFIG.BALL_RADIUS;
    const spacing = r * 2.05;
    const rowOffset = spacing * Math.cos(Math.PI / 6); // sqrt(3)/2 * 2r

    // 8-ball standard layout order (15 object balls)
    // Row 1 (1): 1
    // Row 2 (2): 9, 2
    // Row 3 (3): 3, 8, 10
    // Row 4 (4): 11, 4, 12, 5
    // Row 5 (5): 6, 13, 7, 14, 15
    const ballOrder = [
      1,
      9, 2,
      3, 8, 10,
      11, 4, 12, 5,
      6, 13, 7, 14, 15,
    ];

    let idx = 0;
    for (let row = 0; row < 5; row++) {
      const rx = footX + row * rowOffset;
      const startY = footY - (row * spacing) / 2;
      for (let col = 0; col <= row; col++) {
        const ry = startY + col * spacing;
        const ballNum = ballOrder[idx++];
        this.balls.push(new Ball(ballNum, rx, ry));
      }
    }
  }

  setupDrillScenario(numBalls = 1): void {
    this.balls = [];
    const cueX = TABLE_CONFIG.FELT_X + TABLE_CONFIG.FELT_WIDTH * 0.25 + (Math.random() - 0.5) * 80;
    const cueY = TABLE_CONFIG.FELT_Y + TABLE_CONFIG.FELT_HEIGHT * 0.5 + (Math.random() - 0.5) * 120;
    this.balls.push(new Ball(0, cueX, cueY));

    // Place random target balls within felt
    const availableNumbers = [1, 2, 3, 4, 5, 9, 10, 11, 8];
    for (let i = 0; i < numBalls; i++) {
      const num = availableNumbers[i % availableNumbers.length];
      const targetX = TABLE_CONFIG.FELT_X + TABLE_CONFIG.FELT_WIDTH * 0.55 + Math.random() * (TABLE_CONFIG.FELT_WIDTH * 0.35);
      const targetY = TABLE_CONFIG.FELT_Y + 60 + Math.random() * (TABLE_CONFIG.FELT_HEIGHT - 120);
      this.balls.push(new Ball(num, targetX, targetY));
    }
  }

  setupBeginnerPotDrill(): void {
    this.balls = [];
    // Pick corner pocket 2 (Top-Right) or pocket 5 (Bottom-Right)
    const pocket = Math.random() > 0.5 ? this.pockets[2] : this.pockets[5];
    const isTop = pocket.pos.y < TABLE_CONFIG.FELT_Y + TABLE_CONFIG.FELT_HEIGHT / 2;

    // Target ball near pocket (about 120px away)
    const targetX = pocket.pos.x - 120 - Math.random() * 40;
    const targetY = isTop ? pocket.pos.y + 60 + Math.random() * 30 : pocket.pos.y - 60 - Math.random() * 30;
    const targetBall = new Ball(1, targetX, targetY);
    this.balls.push(targetBall);

    // Cue ball positioned ~220px behind target ball
    const toPocket = pocket.pos.sub(targetBall.pos).normalize();
    const cuePos = targetBall.pos.sub(toPocket.mult(200 + Math.random() * 50));
    // Add slight offset so it's not a dead straight line (requiring small cut angle)
    cuePos.y += (Math.random() - 0.5) * 35;

    this.balls.unshift(new Ball(0, cuePos.x, cuePos.y));
  }

  setupCutShotDrill(): void {
    this.balls = [];
    // Target ball at center-right
    const targetX = TABLE_CONFIG.FELT_X + TABLE_CONFIG.FELT_WIDTH * 0.65;
    const targetY = TABLE_CONFIG.FELT_Y + TABLE_CONFIG.FELT_HEIGHT * 0.38 + (Math.random() - 0.5) * 40;
    const targetBall = new Ball(3, targetX, targetY);
    this.balls.push(targetBall);

    // Cue ball placed to create a distinct 35-45 degree cut into the top-center or corner pocket
    const cueX = targetX - 180 - Math.random() * 40;
    const cueY = targetY + 110 + Math.random() * 40;
    this.balls.unshift(new Ball(0, cueX, cueY));
  }

  isSimulating(): boolean {
    return this.balls.some((b) => b.isMoving());
  }

  applyShot(cueBall: Ball, angle: number, power: number): void {
    const clampedPower = Math.max(TABLE_CONFIG.MIN_SHOT_POWER, Math.min(TABLE_CONFIG.MAX_SHOT_POWER, power));
    cueBall.vel = Vector2D.fromAngle(angle, clampedPower);
  }

  step(subSteps = 6, emitSounds = true): ShotResult {
    const result: ShotResult = {
      pottedBalls: [],
      cuePotted: false,
      firstHitBall: null,
      cushionHitsAfterContact: 0,
      totalBallCollisions: 0,
      stepsSimulated: 1,
    };

    if (emitSounds) {
      this.soundEvents = [];
    }

    const dtFriction = Math.pow(TABLE_CONFIG.FRICTION, 1 / subSteps);

    for (let sub = 0; sub < subSteps; sub++) {
      // 1. Position update & Pocket checks
      for (const b of this.balls) {
        if (b.isPocketed) continue;

        b.pos.x += b.vel.x / subSteps;
        b.pos.y += b.vel.y / subSteps;

        // Check pockets
        for (const p of this.pockets) {
          const dSq = b.pos.distSq(p.pos);
          if (dSq < p.radius * p.radius) {
            b.pocket(p.pos);
            result.pottedBalls.push(b);
            if (b.number === 0) {
              result.cuePotted = true;
            }
            if (emitSounds) {
              this.soundEvents.push({ type: 'pocket', ballNumber: b.number });
            }
            break;
          }
        }
      }

      // 2. Ball-to-ball collisions
      for (let i = 0; i < this.balls.length; i++) {
        const b1 = this.balls[i];
        if (b1.isPocketed) continue;

        for (let j = i + 1; j < this.balls.length; j++) {
          const b2 = this.balls[j];
          if (b2.isPocketed) continue;

          const dx = b2.pos.x - b1.pos.x;
          const dy = b2.pos.y - b1.pos.y;
          const distSq = dx * dx + dy * dy;
          const minDist = b1.radius + b2.radius;

          if (distSq < minDist * minDist && distSq > 0.0001) {
            const dist = Math.sqrt(distSq);
            const nx = dx / dist;
            const ny = dy / dist;

            // Relative velocity
            const kx = b1.vel.x - b2.vel.x;
            const ky = b1.vel.y - b2.vel.y;
            const p = 2 * (nx * kx + ny * ky) / (b1.mass + b2.mass);

            if (p > 0) { // Moving toward each other
              const impulse = p * TABLE_CONFIG.BALL_RESTITUTION;
              b1.vel.x -= impulse * b2.mass * nx;
              b1.vel.y -= impulse * b2.mass * ny;
              b2.vel.x += impulse * b1.mass * nx;
              b2.vel.y += impulse * b1.mass * ny;

              // Record first contact
              if (b1.number === 0 && !result.firstHitBall) {
                result.firstHitBall = b2;
              } else if (b2.number === 0 && !result.firstHitBall) {
                result.firstHitBall = b1;
              }

              result.totalBallCollisions++;

              if (emitSounds) {
                const strength = Math.min(1.0, Math.sqrt(kx * kx + ky * ky) / TABLE_CONFIG.MAX_SHOT_POWER);
                this.soundEvents.push({ type: 'ball-hit', strength });
              }
            }

            // Positional correction to resolve penetration
            const overlap = (minDist - dist) * 0.51;
            b1.pos.x -= nx * overlap;
            b1.pos.y -= ny * overlap;
            b2.pos.x += nx * overlap;
            b2.pos.y += ny * overlap;
          }
        }
      }

      // 3. Cushion collisions
      for (const b of this.balls) {
        if (b.isPocketed) continue;

        for (const c of this.cushions) {
          const closest = this.closestPointOnSegment(b.pos, c.p1, c.p2);
          const distSq = b.pos.distSq(closest);

          if (distSq < b.radius * b.radius) {
            const dist = Math.sqrt(distSq);
            let normal = c.normal.copy();

            if (dist > 0.001) {
              const nx = (b.pos.x - closest.x) / dist;
              const ny = (b.pos.y - closest.y) / dist;
              normal.set(nx, ny);
            }

            const dot = b.vel.dot(normal);
            if (dot < 0) {
              // Reflect velocity
              b.vel.x -= (1 + TABLE_CONFIG.CUSHION_RESTITUTION) * dot * normal.x;
              b.vel.y -= (1 + TABLE_CONFIG.CUSHION_RESTITUTION) * dot * normal.y;

              if (emitSounds) {
                const strength = Math.min(1.0, Math.abs(dot) / TABLE_CONFIG.MAX_SHOT_POWER);
                this.soundEvents.push({ type: 'cushion-hit', strength });
              }

              if (result.firstHitBall && b.number === 0) {
                result.cushionHitsAfterContact++;
              }
            }

            // Positional unsticking
            const penetration = b.radius - dist;
            b.pos.x += normal.x * penetration * 1.05;
            b.pos.y += normal.y * penetration * 1.05;
          }
        }
      }

      // 4. Cloth friction & Velocity stopping
      for (const b of this.balls) {
        if (b.isPocketed) continue;

        b.vel.x *= dtFriction;
        b.vel.y *= dtFriction;

        if (b.vel.magSq() < TABLE_CONFIG.VELOCITY_EPSILON * TABLE_CONFIG.VELOCITY_EPSILON) {
          b.vel.set(0, 0);
        }
      }
    }

    // Animate pocket sinking
    for (const b of this.balls) {
      if (b.isPocketed && b.pocketScale > 0) {
        b.pocketScale = Math.max(0, b.pocketScale - 0.08);
      }
    }

    return result;
  }

  /**
   * Fast synchronous headless simulation of a shot to completion
   */
  simulateShotHeadless(cueAngle: number, power: number, maxSteps = 1200): ShotResult {
    const cue = this.getCueBall();
    this.applyShot(cue, cueAngle, power);

    const accumulatedResult: ShotResult = {
      pottedBalls: [],
      cuePotted: false,
      firstHitBall: null,
      cushionHitsAfterContact: 0,
      totalBallCollisions: 0,
      stepsSimulated: 0,
    };

    while (this.isSimulating() && accumulatedResult.stepsSimulated < maxSteps) {
      const stepRes = this.step(4, false);
      accumulatedResult.stepsSimulated++;
      if (stepRes.pottedBalls.length > 0) {
        accumulatedResult.pottedBalls.push(...stepRes.pottedBalls);
      }
      if (stepRes.cuePotted) accumulatedResult.cuePotted = true;
      if (!accumulatedResult.firstHitBall && stepRes.firstHitBall) {
        accumulatedResult.firstHitBall = stepRes.firstHitBall;
      }
      accumulatedResult.totalBallCollisions += stepRes.totalBallCollisions;
      accumulatedResult.cushionHitsAfterContact += stepRes.cushionHitsAfterContact;
    }

    // Force stop if reached maxSteps
    for (const b of this.balls) {
      b.vel.set(0, 0);
    }

    return accumulatedResult;
  }

  private closestPointOnSegment(p: Vector2D, a: Vector2D, b: Vector2D): Vector2D {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = p.x - a.x;
    const apy = p.y - a.y;
    const abLenSq = abx * abx + aby * aby;
    if (abLenSq === 0) return a.copy();

    let t = (apx * abx + apy * aby) / abLenSq;
    t = Math.max(0, Math.min(1, t));

    return new Vector2D(a.x + t * abx, a.y + t * aby);
  }

  cloneState(): { number: number; pos: Vector2D; isPocketed: boolean }[] {
    return this.balls.map((b) => ({
      number: b.number,
      pos: b.pos.copy(),
      isPocketed: b.isPocketed,
    }));
  }

  restoreState(state: { number: number; pos: Vector2D; isPocketed: boolean }[]): void {
    for (const item of state) {
      const b = this.balls.find((ball) => ball.number === item.number);
      if (b) {
        b.pos = item.pos.copy();
        b.vel.set(0, 0);
        b.isPocketed = item.isPocketed;
        b.pocketScale = item.isPocketed ? 0 : 1.0;
      }
    }
  }

  respawnCueBall(): void {
    const cue = this.getCueBall();
    cue.isPocketed = false;
    cue.pocketScale = 1.0;
    cue.vel.set(0, 0);
    // Find an open spot on the head string
    const startX = TABLE_CONFIG.FELT_X + TABLE_CONFIG.FELT_WIDTH * 0.25;
    let startY = TABLE_CONFIG.FELT_Y + TABLE_CONFIG.FELT_HEIGHT * 0.5;

    // Check collision with any existing ball
    let safe = false;
    let attempts = 0;
    while (!safe && attempts < 20) {
      safe = !this.balls.some((b) => !b.isPocketed && b.number !== 0 && b.pos.distSq(new Vector2D(startX, startY)) < 4 * b.radius * b.radius);
      if (!safe) {
        startY += (attempts % 2 === 0 ? 1 : -1) * (attempts * 15);
      }
      attempts++;
    }
    cue.pos.set(startX, startY);
  }
}
