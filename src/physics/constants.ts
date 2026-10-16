import { Vector2D } from './Vector2D';

export const TABLE_CONFIG = {
  // Felt surface dimensions
  FELT_X: 44,
  FELT_Y: 44,
  FELT_WIDTH: 900,
  FELT_HEIGHT: 450,

  // Table exterior dimensions
  TOTAL_WIDTH: 988,
  TOTAL_HEIGHT: 538,
  RAIL_WIDTH: 44,

  // Ball properties
  BALL_RADIUS: 11.5,
  BALL_MASS: 1.0,

  // Physics tuning
  FRICTION: 0.988,            // Cloth friction per step
  BALL_RESTITUTION: 0.94,     // Elasticity between balls
  CUSHION_RESTITUTION: 0.84,  // Elasticity off cushions
  VELOCITY_EPSILON: 0.05,     // Threshold below which balls stop
  MAX_SHOT_POWER: 26,         // Max initial velocity px/frame
  MIN_SHOT_POWER: 3,

  // Pocket definitions
  CORNER_POCKET_RADIUS: 24,
  SIDE_POCKET_RADIUS: 22,
  POCKET_FALL_RADIUS: 18,     // Distance at which ball drops into pocket
};

export interface Pocket {
  id: number;
  pos: Vector2D;
  radius: number;
  isSide: boolean;
}

export interface CushionSegment {
  p1: Vector2D;
  p2: Vector2D;
  normal: Vector2D;
}

export function getPockets(): Pocket[] {
  const fx = TABLE_CONFIG.FELT_X;
  const fy = TABLE_CONFIG.FELT_Y;
  const fw = TABLE_CONFIG.FELT_WIDTH;
  const fh = TABLE_CONFIG.FELT_HEIGHT;
  const cr = TABLE_CONFIG.CORNER_POCKET_RADIUS;
  const sr = TABLE_CONFIG.SIDE_POCKET_RADIUS;

  return [
    // Top-Left
    { id: 0, pos: new Vector2D(fx + 2, fy + 2), radius: cr, isSide: false },
    // Top-Center
    { id: 1, pos: new Vector2D(fx + fw / 2, fy - 2), radius: sr, isSide: true },
    // Top-Right
    { id: 2, pos: new Vector2D(fx + fw - 2, fy + 2), radius: cr, isSide: false },
    // Bottom-Left
    { id: 3, pos: new Vector2D(fx + 2, fy + fh - 2), radius: cr, isSide: false },
    // Bottom-Center
    { id: 4, pos: new Vector2D(fx + fw / 2, fy + fh + 2), radius: sr, isSide: true },
    // Bottom-Right
    { id: 5, pos: new Vector2D(fx + fw - 2, fy + fh - 2), radius: cr, isSide: false },
  ];
}

/**
 * Returns the cushion boundary segments with pocket mouth bevels
 */
export function getCushions(): CushionSegment[] {
  const fx = TABLE_CONFIG.FELT_X;
  const fy = TABLE_CONFIG.FELT_Y;
  const fw = TABLE_CONFIG.FELT_WIDTH;
  const fh = TABLE_CONFIG.FELT_HEIGHT;
  const cp = 28; // Corner pocket mouth offset
  const sp = 20; // Side pocket mouth offset
  const midX = fx + fw / 2;

  const rawSegments: { p1: [number, number]; p2: [number, number]; normal: [number, number] }[] = [
    // Top-Left rail
    { p1: [fx + cp, fy], p2: [midX - sp, fy], normal: [0, 1] },
    // Top-Right rail
    { p1: [midX + sp, fy], p2: [fx + fw - cp, fy], normal: [0, 1] },

    // Bottom-Left rail
    { p1: [fx + cp, fy + fh], p2: [midX - sp, fy + fh], normal: [0, -1] },
    // Bottom-Right rail
    { p1: [midX + sp, fy + fh], p2: [fx + fw - cp, fy + fh], normal: [0, -1] },

    // Left rail
    { p1: [fx, fy + cp], p2: [fx, fy + fh - cp], normal: [1, 0] },

    // Right rail
    { p1: [fx + fw, fy + cp], p2: [fx + fw, fy + fh - cp], normal: [-1, 0] },
  ];

  return rawSegments.map((s) => ({
    p1: new Vector2D(s.p1[0], s.p1[1]),
    p2: new Vector2D(s.p2[0], s.p2[1]),
    normal: new Vector2D(s.normal[0], s.normal[1]).normalize(),
  }));
}
