import { Vector2D } from './Vector2D';
import { TABLE_CONFIG } from './constants';

export type BallType = 'cue' | 'solid' | 'stripe' | '8ball';

export const BALL_COLORS: Record<number, string> = {
  0: '#f8fafc',  // White Cue Ball
  1: '#eab308',  // Yellow
  2: '#2563eb',  // Blue
  3: '#dc2626',  // Red
  4: '#9333ea',  // Purple
  5: '#ea580c',  // Orange
  6: '#16a34a',  // Green
  7: '#881337',  // Maroon
  8: '#18181b',  // Black 8-Ball
  9: '#eab308',  // Yellow stripe
  10: '#2563eb', // Blue stripe
  11: '#dc2626', // Red stripe
  12: '#9333ea', // Purple stripe
  13: '#ea580c', // Orange stripe
  14: '#16a34a', // Green stripe
  15: '#881337', // Maroon stripe
};

export class Ball {
  id: number;
  number: number;
  type: BallType;
  pos: Vector2D;
  vel: Vector2D;
  radius: number;
  mass: number;
  color: string;
  isPocketed: boolean = false;
  pocketScale: number = 1.0;
  targetPocketPos: Vector2D | null = null;

  constructor(number: number, x = 0, y = 0) {
    this.id = number;
    this.number = number;
    this.pos = new Vector2D(x, y);
    this.vel = new Vector2D(0, 0);
    this.radius = TABLE_CONFIG.BALL_RADIUS;
    this.mass = TABLE_CONFIG.BALL_MASS;

    if (number === 0) {
      this.type = 'cue';
    } else if (number === 8) {
      this.type = '8ball';
    } else if (number >= 1 && number <= 7) {
      this.type = 'solid';
    } else {
      this.type = 'stripe';
    }

    this.color = BALL_COLORS[number] || '#ffffff';
  }

  isMoving(): boolean {
    return !this.isPocketed && this.vel.magSq() > TABLE_CONFIG.VELOCITY_EPSILON * TABLE_CONFIG.VELOCITY_EPSILON;
  }

  pocket(pocketPos: Vector2D): void {
    this.isPocketed = true;
    this.targetPocketPos = pocketPos.copy();
    this.vel.set(0, 0);
  }

  reset(x: number, y: number): void {
    this.pos.set(x, y);
    this.vel.set(0, 0);
    this.isPocketed = false;
    this.pocketScale = 1.0;
    this.targetPocketPos = null;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.isPocketed && this.pocketScale <= 0.05) return;

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);

    if (this.isPocketed) {
      ctx.scale(this.pocketScale, this.pocketScale);
    }

    const r = this.radius;

    // Ball soft drop shadow
    if (!this.isPocketed) {
      ctx.beginPath();
      ctx.arc(2, 2.5, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fill();
    }

    // Base circle
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);

    if (this.type === 'cue') {
      // Cue ball with radial gloss
      const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.7, '#f1f5f9');
      grad.addColorStop(1, '#cbd5e1');
      ctx.fillStyle = grad;
      ctx.fill();

      // Red aiming dot on cue ball
      ctx.beginPath();
      ctx.arc(0, 0, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
    } else if (this.type === '8ball') {
      // 8-Ball
      const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
      grad.addColorStop(0, '#3f3f46');
      grad.addColorStop(0.5, '#18181b');
      grad.addColorStop(1, '#09090b');
      ctx.fillStyle = grad;
      ctx.fill();

      // White center disc with number 8
      this.drawNumberCircle(ctx, r);
    } else if (this.type === 'solid') {
      // Solid ball
      const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.2, this.color);
      grad.addColorStop(1, this.darken(this.color, 0.4));
      ctx.fillStyle = grad;
      ctx.fill();

      // White center disc with number
      this.drawNumberCircle(ctx, r);
    } else {
      // Striped ball
      // Base white sphere
      const baseGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
      baseGrad.addColorStop(0, '#ffffff');
      baseGrad.addColorStop(0.8, '#f1f5f9');
      baseGrad.addColorStop(1, '#cbd5e1');
      ctx.fillStyle = baseGrad;
      ctx.fill();

      // Colored middle stripe (clipped)
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.clip();

      ctx.beginPath();
      ctx.rect(-r, -r * 0.55, r * 2, r * 1.1);
      ctx.fillStyle = this.color;
      ctx.fill();
      ctx.restore();

      // Overlay glossy reflection
      const glossGrad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
      glossGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
      glossGrad.addColorStop(0.5, 'rgba(255,255,255,0)');
      glossGrad.addColorStop(1, 'rgba(0,0,0,0.3)');
      ctx.fillStyle = glossGrad;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();

      // Number circle
      this.drawNumberCircle(ctx, r);
    }

    ctx.restore();
  }

  private drawNumberCircle(ctx: CanvasRenderingContext2D, r: number): void {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#f8fafc';
    ctx.fill();

    ctx.fillStyle = '#0f172a';
    ctx.font = `bold ${Math.round(r * 0.55)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${this.number}`, 0, 0.5);
  }

  private darken(hex: string, factor: number): string {
    // Quick helper to darken hex color for sphere gradient shading
    const num = parseInt(hex.replace('#', ''), 16);
    let r = (num >> 16) * (1 - factor);
    let g = ((num >> 8) & 0x00ff) * (1 - factor);
    let b = (num & 0x0000ff) * (1 - factor);
    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  }
}
