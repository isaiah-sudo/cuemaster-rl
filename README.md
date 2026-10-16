# CueMaster RL: 2D Pool Reinforcement Learning Simulator & 1v1 Arena

An interactive, browser-based **Deep Reinforcement Learning (RDL / DRL) 2D Billiards Simulation** where you can train an AI agent in real time, inspect its neural network thought processes, and jump into a match to play against it whenever you feel ready.

---

## 🌟 Key Features

### 1. Reinforcement Learning (RL) Simulation Lab
- **Deep Q-Network (DQN) with Continuous Candidate Kinematics**:
  - Computes ghost ball contact points: $\vec{G} = \vec{T} - 2R \cdot \hat{u}_{\text{pocket}}$
  - Evaluates cut angles ($\cos \phi$), pocket distances, and cue/pocket raycast clearances.
  - Predicts expected Q-values for candidate shots and chooses actions via an $\epsilon$-greedy exploration policy.
- **Experience Replay & Soft Target Updates**:
  - Replay buffer holding up to 6,000 transitions.
  - Target network with Polyak soft updates ($\tau = 0.05$) for stable learning.
- **Real-Time Visual Thought Rays**:
  - Displays color-coded AI thought vectors directly on the felt (green for high-confidence shots, amber for speculative, red for blocked).
- **Curriculum Training Scenarios**:
  - 🎯 **1-Ball Potting Drill**: Focuses on cut angles, cushion rebounds, and pocket targeting.
  - 🎱 **4-Ball Multi-Ball Drill**: Learns cue ball position play and cluster clearance.
  - 🏆 **Full 15-Ball 8-Ball Rack**: Full break and clear.
- **Simulation Speed Controls**:
  - Real-time (1x, 2x, 5x, 20x) or **100x Turbo Mode** (headless background episodes running at hundreds of shots per minute).
- **Brain Checkpoints**:
  - Export neural weights to JSON file, import previously trained brains, or reset to baseline.

### 2. 1v1 Play Against AI Mode ("Play When You Feel")
- **Seamless Instant Transition**: Switch between AI training and a live match with one click at any time.
- **Full Standard 8-Ball Rules**:
  - Break shot to open table.
  - Solids vs. Stripes assignment upon the first legal pot.
  - Turn persistence on legal pots; turn transfer on misses or fouls.
  - Scratch foul handling with ball-in-hand placement.
  - 8-ball win/loss conditions (must clear group first; early pot or scratch on 8-ball loses).
- **Smooth Aiming & Cue Stick Controls**:
  - Interactive ghost-ball targeting showing the projected object ball trajectory and cue deflection path.
  - Pull back cue stick with mouse drag or power slider.
  - Fine-aim buttons for precise angle tuning.
- **Synthesized Web Audio**:
  - Real-time procedural audio via Web Audio API: ball-to-ball clacks, rail thuds, cue strikes, leather pocket drops, and victory fanfare.

---

## 🚀 Running the Project

```bash
# Install dependencies
npm install

# Start local dev server
npm run dev
```

Open `http://127.0.0.1:5173/` in your browser.
