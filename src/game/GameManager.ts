import { Table, type ShotResult } from '../physics/Table';
import { PoolAgent, type CandidateShot } from '../ai/PoolAgent';
import { Vector2D } from '../physics/Vector2D';
import { soundManager } from '../audio/SoundEffects';
import confetti from 'canvas-confetti';

export type GameMode = 'training' | 'match';
export type PlayerTurn = 'player' | 'ai';
export type BallAssignment = 'solid' | 'stripe' | 'any';
export type TrainingScenario = 'potting_drill' | 'multi_ball' | 'full_game';

export interface GameState {
  mode: GameMode;
  turn: PlayerTurn;
  playerType: BallAssignment;
  aiType: BallAssignment;
  isSimulating: boolean;
  statusMessage: string;
  foulMessage: string | null;
  winner: PlayerTurn | null;
  winReason: string | null;
  playerSolidsLeft: number;
  playerStripesLeft: number;
  trainingScenario: TrainingScenario;
  trainingSpeed: number; // 1, 2, 5, 20, 100
  isTrainingPaused: boolean;
  currentCandidate: CandidateShot | null;
  allCandidates: CandidateShot[];
  lastShotReward: number | null;
}

export class GameManager {
  table: Table;
  agent: PoolAgent;
  state: GameState;
  private listeners: ((state: GameState) => void)[] = [];
  private initialTargetPos: Vector2D | null = null;
  private currentShotResult: ShotResult = {
    pottedBalls: [],
    cuePotted: false,
    firstHitBall: null,
    cushionHitsAfterContact: 0,
    totalBallCollisions: 0,
    stepsSimulated: 0,
  };

  private accumulateShotResult(stepResult: ShotResult): void {
    if (stepResult.pottedBalls.length > 0) {
      this.currentShotResult.pottedBalls.push(...stepResult.pottedBalls);
    }
    if (stepResult.cuePotted) {
      this.currentShotResult.cuePotted = true;
    }
    if (!this.currentShotResult.firstHitBall && stepResult.firstHitBall) {
      this.currentShotResult.firstHitBall = stepResult.firstHitBall;
    }
    this.currentShotResult.totalBallCollisions += stepResult.totalBallCollisions;
    this.currentShotResult.cushionHitsAfterContact += stepResult.cushionHitsAfterContact;
    this.currentShotResult.stepsSimulated += stepResult.stepsSimulated;
  }

  private resetShotResult(): void {
    this.currentShotResult = {
      pottedBalls: [],
      cuePotted: false,
      firstHitBall: null,
      cushionHitsAfterContact: 0,
      totalBallCollisions: 0,
      stepsSimulated: 0,
    };
  }

  constructor() {
    this.table = new Table();
    this.agent = new PoolAgent();

    this.state = {
      mode: 'training',
      turn: 'player',
      playerType: 'any',
      aiType: 'any',
      isSimulating: false,
      statusMessage: 'AI Training Simulation Active',
      foulMessage: null,
      winner: null,
      winReason: null,
      playerSolidsLeft: 7,
      playerStripesLeft: 7,
      trainingScenario: 'multi_ball',
      trainingSpeed: 1,
      isTrainingPaused: false,
      currentCandidate: null,
      allCandidates: [],
      lastShotReward: null,
    };

    this.setupTrainingScenario();
  }

  subscribe(listener: (state: GameState) => void): () => void {
    this.listeners.push(listener);
    listener(this.state);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  setMode(mode: GameMode): void {
    this.state.mode = mode;
    if (mode === 'match') {
      this.startMatch('player');
    } else {
      this.setupTrainingScenario();
    }
    this.notify();
  }

  setTrainingScenario(scenario: TrainingScenario): void {
    this.state.trainingScenario = scenario;
    this.setupTrainingScenario();
    this.notify();
  }

  setTrainingSpeed(speed: number): void {
    this.state.trainingSpeed = speed;
    this.notify();
  }

  toggleTrainingPause(): void {
    this.state.isTrainingPaused = !this.state.isTrainingPaused;
    this.notify();
  }

  setupTrainingScenario(): void {
    this.state.isSimulating = false;
    this.state.currentCandidate = null;
    this.state.allCandidates = [];

    if (this.state.trainingScenario === 'potting_drill') {
      this.table.setupDrillScenario(1);
    } else if (this.state.trainingScenario === 'multi_ball') {
      this.table.setupDrillScenario(4);
    } else {
      this.table.setupStandardRack();
    }

    this.updateBallCounts();
    this.computeAICandidates('any');
    this.notify();
  }

  startMatch(startingPlayer: PlayerTurn = 'player'): void {
    this.state.mode = 'match';
    this.table.setupStandardRack();
    this.state.turn = startingPlayer;
    this.state.playerType = 'any';
    this.state.aiType = 'any';
    this.state.isSimulating = false;
    this.state.winner = null;
    this.state.winReason = null;
    this.state.foulMessage = null;
    this.state.statusMessage = startingPlayer === 'player' ? 'Your turn! Aim and break.' : 'AI breaking...';
    this.updateBallCounts();

    if (startingPlayer === 'ai') {
      this.scheduleAIShot();
    } else {
      this.computeAICandidates('any');
    }
    this.notify();
  }

  private updateBallCounts(): void {
    const active = this.table.balls.filter((b) => !b.isPocketed);
    this.state.playerSolidsLeft = active.filter((b) => b.type === 'solid').length;
    this.state.playerStripesLeft = active.filter((b) => b.type === 'stripe').length;
  }

  computeAICandidates(assignment: BallAssignment): void {
    const candidates = this.agent.generateCandidates(this.table, assignment);
    this.state.allCandidates = candidates;
    this.state.currentCandidate = candidates.length > 0 ? candidates[0] : null;
  }

  /**
   * Player fires a shot
   */
  executePlayerShot(angle: number, power: number): void {
    if (this.state.isSimulating || this.state.turn !== 'player' || this.state.winner) return;

    this.resetShotResult();
    soundManager.playCue(power);
    const cue = this.table.getCueBall();
    this.table.applyShot(cue, angle, power);
    this.state.isSimulating = true;
    this.state.foulMessage = null;
    this.state.statusMessage = 'Shot in motion...';
    this.notify();
  }

  /**
   * AI takes its turn in match mode
   */
  scheduleAIShot(): void {
    if (this.state.winner) return;

    this.state.statusMessage = 'AI evaluating table...';
    this.notify();

    setTimeout(() => {
      if (this.state.winner) return;

      const assignment = this.state.aiType;
      const candidates = this.agent.generateCandidates(this.table, assignment);
      this.state.allCandidates = candidates;

      // In match mode, use lower exploration for competent play
      const shot = this.agent.selectAction(candidates, false);
      if (!shot) {
        // Pass or fallback gentle tap
        this.resetShotResult();
        const cue = this.table.getCueBall();
        this.table.applyShot(cue, 0, 5);
        this.state.isSimulating = true;
        this.notify();
        return;
      }

      this.state.currentCandidate = shot;
      this.state.statusMessage = `AI shooting at Ball ${shot.targetBall.number} (Q: ${Math.round(shot.qValue)})`;
      this.notify();

      setTimeout(() => {
        this.resetShotResult();
        soundManager.playCue(shot.power);
        const cue = this.table.getCueBall();
        this.table.applyShot(cue, shot.cueAngle, shot.power);
        this.state.isSimulating = true;
        this.notify();
      }, 700);
    }, 600);
  }

  /**
   * Main game loop tick called on each animation frame
   */
  tick(): void {
    if (this.state.mode === 'training') {
      this.tickTraining();
    } else {
      this.tickMatch();
    }
  }

  private tickMatch(): void {
    if (!this.state.isSimulating) return;

    // Advance physics
    const stepResult = this.table.step(6, true);
    this.accumulateShotResult(stepResult);
    this.dispatchSounds();

    if (!this.table.isSimulating()) {
      // Balls have come to a complete stop! Evaluate rules with full accumulated result
      this.state.isSimulating = false;
      this.evaluateMatchTurn(this.currentShotResult);
      this.resetShotResult();
      this.updateBallCounts();
      this.notify();
    }
  }

  private tickTraining(): void {
    if (this.state.isTrainingPaused) return;

    const speed = this.state.trainingSpeed;

    if (speed >= 100) {
      // Headless turbo training: run multiple entire episodes per frame
      for (let ep = 0; ep < 12; ep++) {
        this.runSingleTrainingEpisodeHeadless();
      }
      this.notify();
      return;
    }

    // Step physics at 1x, 2x, 5x, 20x
    const stepsPerFrame = speed;
    for (let s = 0; s < stepsPerFrame; s++) {
      if (this.state.isSimulating) {
        const stepResult = this.table.step(6, speed <= 2);
        this.accumulateShotResult(stepResult);
        if (speed <= 2) {
          this.dispatchSounds();
        }

        if (!this.table.isSimulating()) {
          this.state.isSimulating = false;
          this.evaluateTrainingShot(this.currentShotResult);
          this.resetShotResult();
          this.updateBallCounts();
          break;
        }
      } else {
        // Ready for next shot
        this.initiateTrainingShot();
        break;
      }
    }
  }

  private initiateTrainingShot(): void {
    // Check if table needs reset
    const activeObjectBalls = this.table.balls.filter((b) => !b.isPocketed && b.number !== 0);
    if (activeObjectBalls.length === 0 || this.table.getCueBall().isPocketed) {
      this.setupTrainingScenario();
      return;
    }

    const candidates = this.agent.generateCandidates(this.table, 'any');
    this.state.allCandidates = candidates;

    if (candidates.length === 0) {
      this.setupTrainingScenario();
      return;
    }

    const chosenShot = this.agent.selectAction(candidates, true);
    if (!chosenShot) {
      this.setupTrainingScenario();
      return;
    }

    this.state.currentCandidate = chosenShot;
    this.initialTargetPos = chosenShot.targetBall.pos.copy();
    this.resetShotResult();

    const cue = this.table.getCueBall();

    if (this.state.trainingSpeed <= 2) {
      soundManager.playCue(chosenShot.power);
    }

    this.table.applyShot(cue, chosenShot.cueAngle, chosenShot.power);
    this.state.isSimulating = true;
    this.notify();
  }

  private evaluateTrainingShot(result: ShotResult): void {
    const candidate = this.state.currentCandidate;
    if (!candidate) return;

    const initPos = this.initialTargetPos ? this.initialTargetPos : candidate.targetBall.pos.copy();
    const reward = this.agent.computeReward(
      result,
      candidate.targetBall,
      'any',
      initPos,
      candidate.pocketPos.copy()
    );

    this.state.lastShotReward = reward;

    if (result.cuePotted) {
      this.table.respawnCueBall();
    }

    // Collect next candidates for Q-learning transition
    const nextCandidates = this.agent.generateCandidates(this.table, 'any');
    const done = this.table.balls.filter((b) => !b.isPocketed && b.number !== 0).length === 0 || result.cuePotted;

    // Store in replay buffer
    this.agent.replayBuffer.push({
      state: candidate.features,
      actionFeatures: candidate.features,
      reward,
      nextState: candidate.features,
      nextCandidateFeatures: nextCandidates.map((c) => c.features),
      done,
    });

    // Train neural network
    const loss = this.agent.trainStep();

    const won = result.pottedBalls.some((b) => b.number === 8);
    this.agent.recordEpisode(reward, won, result.pottedBalls.filter((b) => b.number !== 0).length, loss);
    this.notify();
  }

  private runSingleTrainingEpisodeHeadless(): void {
    const activeObjectBalls = this.table.balls.filter((b) => !b.isPocketed && b.number !== 0);
    if (activeObjectBalls.length === 0 || this.table.getCueBall().isPocketed) {
      this.setupTrainingScenario();
      return;
    }

    const candidates = this.agent.generateCandidates(this.table, 'any');
    if (candidates.length === 0) {
      this.setupTrainingScenario();
      return;
    }

    const shot = this.agent.selectAction(candidates, true);
    if (!shot) {
      this.setupTrainingScenario();
      return;
    }

    const initialTargetPos = shot.targetBall.pos.copy();
    const result = this.table.simulateShotHeadless(shot.cueAngle, shot.power, 600);

    const reward = this.agent.computeReward(
      result,
      shot.targetBall,
      'any',
      initialTargetPos,
      shot.pocketPos
    );

    if (result.cuePotted) {
      this.table.respawnCueBall();
    }

    const nextCandidates = this.agent.generateCandidates(this.table, 'any');
    const done = this.table.balls.filter((b) => !b.isPocketed && b.number !== 0).length === 0;

    this.agent.replayBuffer.push({
      state: shot.features,
      actionFeatures: shot.features,
      reward,
      nextState: shot.features,
      nextCandidateFeatures: nextCandidates.map((c) => c.features),
      done,
    });

    const loss = this.agent.trainStep();
    const won = result.pottedBalls.some((b) => b.number === 8);
    this.agent.recordEpisode(reward, won, result.pottedBalls.filter((b) => b.number !== 0).length, loss);
  }

  private evaluateMatchTurn(result: ShotResult): void {
    const current = this.state.turn;
    const opponent = current === 'player' ? 'ai' : 'player';
    const currentType = current === 'player' ? this.state.playerType : this.state.aiType;
    let switchTurn = true;
    let isFoul = false;

    // Check cue scratch
    if (result.cuePotted) {
      soundManager.playFoul();
      this.state.foulMessage = `Scratch! Cue ball potted. ${opponent.toUpperCase()} gets ball in hand!`;
      this.table.respawnCueBall();
      isFoul = true;
    }

    // Check premature 8-ball pot
    const potted8 = result.pottedBalls.find((b) => b.number === 8);
    if (potted8) {
      const remainingAssigned = currentType === 'solid'
        ? this.state.playerSolidsLeft
        : currentType === 'stripe'
        ? this.state.playerStripesLeft
        : 7;

      if (remainingAssigned === 0 && !result.cuePotted) {
        // Legal 8-ball pot = WINNER!
        this.triggerWin(current, `${current.toUpperCase()} legally potted the 8-ball!`);
        return;
      } else {
        // Premature or scratch 8-ball = LOSS!
        const reason = result.cuePotted
          ? `${current.toUpperCase()} scratched while potting the 8-ball.`
          : `${current.toUpperCase()} potted the 8-ball prematurely.`;
        this.triggerWin(opponent, reason);
        return;
      }
    }

    // Check first contact foul
    if (!result.firstHitBall && !isFoul) {
      soundManager.playFoul();
      this.state.foulMessage = `Foul! Cue ball failed to contact any ball.`;
      isFoul = true;
    }

    // Check ball type assignment
    const pottedObjectBalls = result.pottedBalls.filter((b) => b.number !== 0 && b.number !== 8);
    if (this.state.playerType === 'any' && pottedObjectBalls.length > 0) {
      const first = pottedObjectBalls[0];
      if (current === 'player') {
        this.state.playerType = first.type === 'solid' ? 'solid' : 'stripe';
        this.state.aiType = first.type === 'solid' ? 'stripe' : 'solid';
      } else {
        this.state.aiType = first.type === 'solid' ? 'solid' : 'stripe';
        this.state.playerType = first.type === 'solid' ? 'stripe' : 'solid';
      }
      this.state.statusMessage = `Assigned: You are ${this.state.playerType.toUpperCase()}S, AI is ${this.state.aiType.toUpperCase()}S`;
    }

    // Did player legally pot their own ball?
    const myAssignedType = current === 'player' ? this.state.playerType : this.state.aiType;
    const legallyPotted = pottedObjectBalls.some((b) => myAssignedType === 'any' || b.type === myAssignedType);

    if (legallyPotted && !isFoul) {
      switchTurn = false; // Keep turn
      this.state.statusMessage = `${current.toUpperCase()} potted a ball! Continue turn.`;
    }

    if (switchTurn) {
      this.state.turn = opponent;
      if (!isFoul) {
        this.state.statusMessage = `${opponent === 'player' ? 'Your' : "AI's"} turn!`;
      }
    }

    if (this.state.turn === 'ai') {
      this.scheduleAIShot();
    } else {
      this.computeAICandidates(this.state.playerType);
    }
  }

  private triggerWin(winner: PlayerTurn, reason: string): void {
    this.state.winner = winner;
    this.state.winReason = reason;
    this.state.statusMessage = `Game Over! ${winner.toUpperCase()} Wins!`;

    if (winner === 'player') {
      soundManager.playWin();
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } else {
      soundManager.playFoul();
    }
    this.notify();
  }

  private dispatchSounds(): void {
    for (const event of this.table.soundEvents) {
      if (event.type === 'ball-hit') {
        soundManager.playHit(event.strength);
      } else if (event.type === 'cushion-hit') {
        soundManager.playCushion(event.strength);
      } else if (event.type === 'pocket') {
        soundManager.playPocket();
      }
    }
    this.table.soundEvents = [];
  }
}
