export interface Experience {
  state: number[];
  actionFeatures: number[]; // Candidate shot features
  reward: number;
  nextState: number[];
  nextCandidateFeatures: number[][]; // Candidates available in next state
  done: boolean;
}

export class ReplayBuffer {
  capacity: number;
  buffer: Experience[] = [];
  pointer = 0;

  constructor(capacity = 5000) {
    this.capacity = capacity;
  }

  push(experience: Experience): void {
    if (this.buffer.length < this.capacity) {
      this.buffer.push(experience);
    } else {
      this.buffer[this.pointer] = experience;
      this.pointer = (this.pointer + 1) % this.capacity;
    }
  }

  sample(batchSize: number): Experience[] {
    const samples: Experience[] = [];
    const count = Math.min(batchSize, this.buffer.length);
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * this.buffer.length);
      samples.push(this.buffer[idx]);
    }
    return samples;
  }

  size(): number {
    return this.buffer.length;
  }

  clear(): void {
    this.buffer = [];
    this.pointer = 0;
  }
}
