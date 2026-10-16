import { Vector2D } from '../physics/Vector2D';
import { Ball } from '../physics/Ball';
import { Table, type ShotResult } from '../physics/Table';
import { TABLE_CONFIG } from '../physics/constants';
import { NeuralNetwork } from './NeuralNetwork';
import { ReplayBuffer } from './ReplayBuffer';

export interface CandidateShot {
  targetBall: Ball;
  pocketPos: Vector2D;
  pocketId: number;
  cueAngle: number;
  power: number;
  cutAngleCos: number;
  distCueToGhost: number;
  distTargetToPocket: number;
  cueClearance: number;     // 1 = clear, 0 = blocked
  pocketClearance: number;  // 1 = clear, 0 = blocked
  is8Ball: boolean;
  features: number[];
  qValue: number;
}

export interface TrainingMetrics {
  episode: number;
  totalPots: number;
  winCount: number;
  epsilon: number;
  loss: number;
  recentRewards: number[];
  averageReward: number;
  recentWinRate: number;
}

export class PoolAgent {
  qNetwork: NeuralNetwork;
  targetNetwork: NeuralNetwork;
  replayBuffer: ReplayBuffer;

  // Hyperparameters
  epsilon = 0.25;
  minEpsilon = 0.05;
  epsilonDecay = 0.998;
  gamma = 0.95; // Discount factor
  batchSize = 32;
  learningRate = 0.003;

  // Stats
  metrics: TrainingMetrics = {
    episode: 0,
    totalPots: 0,
    winCount: 0,
    epsilon: 0.25,
    loss: 0,
    recentRewards: [],
    averageReward: 0,
    recentWinRate: 0,
  };

  constructor() {
    // Input features: 14 dimensions, hidden: 32 -> 32, output: 1 (Q-value)
    const layerSizes = [14, 32, 32, 1];
    this.qNetwork = new NeuralNetwork(layerSizes, this.learningRate);
    this.targetNetwork = this.qNetwork.clone();
    this.replayBuffer = new ReplayBuffer(6000);

    // Warm-start neural network with realistic billiard intuition
    this.initializeBaselineWeights();
  }

  private initializeBaselineWeights(): void {
    // Train a quick supervised bootstrap so agent starts with high billiard intuition
    for (let i = 0; i < 200; i++) {
      const cutCos = Math.random(); // 0 to 1
      const cueClear = Math.random() > 0.3 ? 1 : 0;
      const pockClear = Math.random() > 0.3 ? 1 : 0;
      const distRatio = Math.random();

      // Theoretical success quality
      let targetQ = (cutCos * 40 + cueClear * 50 + pockClear * 50 - distRatio * 20);
      if (cueClear === 0 || pockClear === 0 || cutCos < 0.2) {
        targetQ = -30;
      }

      const dummyFeatures = [
        Math.random(), Math.random(),
        Math.random(), Math.random(),
        Math.random(), Math.random(),
        distRatio, Math.random(),
        cutCos,
        cueClear, pockClear,
        0.5, 0, 0.5
      ];

      this.qNetwork.train(dummyFeatures, [targetQ]);
    }
    this.targetNetwork = this.qNetwork.clone();
  }

  /**
   * Generates candidate shots given table and player assignment
   */
  generateCandidates(table: Table, assignedType: 'solid' | 'stripe' | 'any' | '8ball'): CandidateShot[] {
    const cue = table.getCueBall();
    if (cue.isPocketed) return [];

    const candidates: CandidateShot[] = [];
    const activeBalls = table.balls.filter((b) => !b.isPocketed && b.number !== 0);

    // Determine legal target balls
    let legalBalls: Ball[] = [];
    if (assignedType === '8ball') {
      const eight = activeBalls.find((b) => b.number === 8);
      if (eight) legalBalls = [eight];
    } else if (assignedType === 'solid') {
      legalBalls = activeBalls.filter((b) => b.type === 'solid');
      if (legalBalls.length === 0) {
        const eight = activeBalls.find((b) => b.number === 8);
        if (eight) legalBalls = [eight];
      }
    } else if (assignedType === 'stripe') {
      legalBalls = activeBalls.filter((b) => b.type === 'stripe');
      if (legalBalls.length === 0) {
        const eight = activeBalls.find((b) => b.number === 8);
        if (eight) legalBalls = [eight];
      }
    } else {
      // 'any' open table
      legalBalls = activeBalls.filter((b) => b.number !== 8);
      if (legalBalls.length === 0) {
        const eight = activeBalls.find((b) => b.number === 8);
        if (eight) legalBalls = [eight];
      }
    }

    if (legalBalls.length === 0) {
      legalBalls = activeBalls;
    }

    const diag = Math.sqrt(
      TABLE_CONFIG.FELT_WIDTH * TABLE_CONFIG.FELT_WIDTH +
      TABLE_CONFIG.FELT_HEIGHT * TABLE_CONFIG.FELT_HEIGHT
    );
    const ballDiam = TABLE_CONFIG.BALL_RADIUS * 2;

    for (const target of legalBalls) {
      for (const pocket of table.pockets) {
        const targetToPocket = pocket.pos.sub(target.pos);
        const distTargetToPocket = targetToPocket.mag();
        if (distTargetToPocket === 0) continue;

        const pocketDir = targetToPocket.normalize();

        // Ghost ball: position cue ball must be at moment of impact
        const ghostPos = target.pos.sub(pocketDir.mult(ballDiam));

        // Vector from cue to ghost ball
        const cueToGhost = ghostPos.sub(cue.pos);
        const distCueToGhost = cueToGhost.mag();
        if (distCueToGhost === 0) continue;

        const cueDir = cueToGhost.normalize();

        // Cut angle cosine: dot product of cue direction and pocket direction
        const cutAngleCos = cueDir.dot(pocketDir);

        // Discard back-cuts (> 85 degrees) as nearly impossible direct cuts
        if (cutAngleCos < 0.1) continue;

        // Check path clearance
        const cueClearance = this.checkPathClearance(cue.pos, ghostPos, activeBalls, [cue.number, target.number]);
        const pocketClearance = this.checkPathClearance(target.pos, pocket.pos, activeBalls, [cue.number, target.number]);

        // Power calculation: scaled to travel cueToGhost + targetToPocket + pocket penetration
        const totalDist = distCueToGhost + distTargetToPocket * (1.2 / Math.max(0.25, cutAngleCos));
        let power = Math.sqrt(totalDist * 0.75) * 1.35;
        power = Math.max(TABLE_CONFIG.MIN_SHOT_POWER + 2, Math.min(TABLE_CONFIG.MAX_SHOT_POWER, power));

        const cueAngle = cueDir.heading();
        const is8 = target.number === 8;

        const features = [
          cue.pos.x / TABLE_CONFIG.TOTAL_WIDTH,
          cue.pos.y / TABLE_CONFIG.TOTAL_HEIGHT,
          target.pos.x / TABLE_CONFIG.TOTAL_WIDTH,
          target.pos.y / TABLE_CONFIG.TOTAL_HEIGHT,
          pocket.pos.x / TABLE_CONFIG.TOTAL_WIDTH,
          pocket.pos.y / TABLE_CONFIG.TOTAL_HEIGHT,
          distCueToGhost / diag,
          distTargetToPocket / diag,
          cutAngleCos,
          cueClearance,
          pocketClearance,
          power / TABLE_CONFIG.MAX_SHOT_POWER,
          is8 ? 1 : 0,
          activeBalls.length / 15,
        ];

        // Evaluate Q-value with neural network
        const qValue = this.qNetwork.predict(features)[0];

        candidates.push({
          targetBall: target,
          pocketPos: pocket.pos,
          pocketId: pocket.id,
          cueAngle,
          power,
          cutAngleCos,
          distCueToGhost,
          distTargetToPocket,
          cueClearance,
          pocketClearance,
          is8Ball: is8,
          features,
          qValue,
        });
      }
    }

    // Fallback: If no direct pocket shot candidate, generate direct hit / breakout shot
    if (candidates.length === 0 && legalBalls.length > 0) {
      for (const target of legalBalls) {
        const toTarget = target.pos.sub(cue.pos);
        const dist = toTarget.mag();
        const angle = toTarget.heading();
        const features = new Array(14).fill(0.1);
        candidates.push({
          targetBall: target,
          pocketPos: table.pockets[0].pos,
          pocketId: 0,
          cueAngle: angle,
          power: 14,
          cutAngleCos: 0.5,
          distCueToGhost: dist,
          distTargetToPocket: 200,
          cueClearance: 1,
          pocketClearance: 0.5,
          is8Ball: target.number === 8,
          features,
          qValue: 0,
        });
      }
    }

    // Sort by Q-value descending
    candidates.sort((a, b) => b.qValue - a.qValue);
    return candidates;
  }

  private checkPathClearance(p1: Vector2D, p2: Vector2D, balls: Ball[], ignoreNumbers: number[]): number {
    const dir = p2.sub(p1);
    const len = dir.mag();
    if (len === 0) return 1;
    const u = dir.div(len);
    const radiusThreshold = TABLE_CONFIG.BALL_RADIUS * 1.95;

    for (const b of balls) {
      if (b.isPocketed || ignoreNumbers.includes(b.number)) continue;

      const toBall = b.pos.sub(p1);
      const proj = toBall.dot(u);

      if (proj > 0 && proj < len) {
        const perpDistSq = toBall.magSq() - proj * proj;
        if (perpDistSq < radiusThreshold * radiusThreshold) {
          return 0; // Obstacle in trajectory
        }
      }
    }
    return 1; // Clear path
  }

  /**
   * Selects an action using epsilon-greedy policy
   */
  selectAction(candidates: CandidateShot[], explore = true): CandidateShot | null {
    if (candidates.length === 0) return null;

    if (explore && Math.random() < this.epsilon) {
      // Explore: choose a random candidate with slight perturbation
      const idx = Math.floor(Math.random() * Math.min(candidates.length, 5));
      const chosen = { ...candidates[idx] };
      // Add slight noise to angle (+/- 0.04 rad) and power (+/- 1.5)
      chosen.cueAngle += (Math.random() - 0.5) * 0.07;
      chosen.power = Math.max(TABLE_CONFIG.MIN_SHOT_POWER, Math.min(TABLE_CONFIG.MAX_SHOT_POWER, chosen.power + (Math.random() - 0.5) * 2));
      return chosen;
    }

    // Exploit: pick highest Q-value candidate
    return candidates[0];
  }

  /**
   * Computes the reward for a shot result
   */
  computeReward(
    result: ShotResult,
    targetBall: Ball,
    assignedType: 'solid' | 'stripe' | 'any' | '8ball',
    initialTargetPos: Vector2D,
    targetPocketPos: Vector2D
  ): number {
    let reward = 0;

    // 1. Scratch penalty
    if (result.cuePotted) {
      reward -= 90;
      return reward;
    }

    // 2. No ball hit foul
    if (!result.firstHitBall) {
      reward -= 35;
      return reward;
    }

    // 3. Did we hit the right ball first?
    const hitNumber = result.firstHitBall.number;
    const isTargetBallHit = hitNumber === targetBall.number;
    if (isTargetBallHit) {
      reward += 15;
    }

    // 4. Potting rewards
    for (const potted of result.pottedBalls) {
      if (potted.number === 0) continue;

      if (potted.number === 8) {
        if (assignedType === '8ball' || (assignedType === 'any' && result.pottedBalls.length === 1)) {
          // Win!
          reward += 450;
        } else {
          // Premature 8-ball loss!
          reward -= 350;
        }
      } else if (
        (assignedType === 'solid' && potted.type === 'solid') ||
        (assignedType === 'stripe' && potted.type === 'stripe') ||
        assignedType === 'any'
      ) {
        // Legal pot!
        reward += 120;
      } else {
        // Opponent ball potted
        reward -= 40;
      }
    }

    // Bonus for multi-ball pot
    if (result.pottedBalls.length > 1 && !result.cuePotted) {
      reward += (result.pottedBalls.length - 1) * 60;
    }

    // 5. Shaping reward: if target ball wasn't potted, did it get closer to the pocket?
    if (!targetBall.isPocketed) {
      const initDist = initialTargetPos.dist(targetPocketPos);
      const finalDist = targetBall.pos.dist(targetPocketPos);
      if (finalDist < initDist) {
        reward += Math.round(((initDist - finalDist) / initDist) * 15);
      }
    }

    return reward;
  }

  /**
   * Trains network on replay buffer samples
   */
  trainStep(): number {
    if (this.replayBuffer.size() < this.batchSize) return 0;

    const batch = this.replayBuffer.sample(this.batchSize);
    let totalLoss = 0;

    for (const exp of batch) {
      let targetQ = exp.reward;

      if (!exp.done && exp.nextCandidateFeatures.length > 0) {
        // Double DQN target computation: max Q_target(s', a')
        let maxNextQ = -Infinity;
        for (const nextCand of exp.nextCandidateFeatures) {
          const qVal = this.targetNetwork.predict(nextCand)[0];
          if (qVal > maxNextQ) {
            maxNextQ = qVal;
          }
        }
        if (maxNextQ !== -Infinity) {
          targetQ += this.gamma * maxNextQ;
        }
      }

      // Train main Q network
      const loss = this.qNetwork.train(exp.actionFeatures, [targetQ]);
      totalLoss += loss;
    }

    // Soft update target network
    this.targetNetwork.softUpdate(this.qNetwork, 0.05);

    // Decay epsilon exploration rate
    this.epsilon = Math.max(this.minEpsilon, this.epsilon * this.epsilonDecay);

    return totalLoss / batch.length;
  }

  recordEpisode(reward: number, won: boolean, pots: number, loss: number): void {
    this.metrics.episode++;
    this.metrics.totalPots += pots;
    if (won) this.metrics.winCount++;
    this.metrics.loss = loss;
    this.metrics.epsilon = this.epsilon;

    this.metrics.recentRewards.push(reward);
    if (this.metrics.recentRewards.length > 50) {
      this.metrics.recentRewards.shift();
    }
    const sum = this.metrics.recentRewards.reduce((a, b) => a + b, 0);
    this.metrics.averageReward = Math.round((sum / this.metrics.recentRewards.length) * 10) / 10;
    this.metrics.recentWinRate = Math.round((this.metrics.winCount / Math.max(1, this.metrics.episode)) * 100);
  }

  reset(): void {
    const layerSizes = [14, 32, 32, 1];
    this.qNetwork = new NeuralNetwork(layerSizes, this.learningRate);
    this.targetNetwork = this.qNetwork.clone();
    this.replayBuffer.clear();
    this.epsilon = 0.35;
    this.initializeBaselineWeights();
    this.metrics = {
      episode: 0,
      totalPots: 0,
      winCount: 0,
      epsilon: 0.35,
      loss: 0,
      recentRewards: [],
      averageReward: 0,
      recentWinRate: 0,
    };
  }
}
