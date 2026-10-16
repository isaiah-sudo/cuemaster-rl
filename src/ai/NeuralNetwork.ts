export interface LayerConfig {
  inputSize: number;
  outputSize: number;
}

export class NeuralNetwork {
  layers: {
    weights: number[][]; // [out][in]
    biases: number[];
    mWeights: number[][]; // Adam 1st moment
    vWeights: number[][]; // Adam 2nd moment
    mBiases: number[];
    vBiases: number[];
  }[] = [];

  learningRate = 0.001;
  beta1 = 0.9;
  beta2 = 0.999;
  epsilon = 1e-8;
  t = 0; // Adam time step

  constructor(layerSizes: number[], learningRate = 0.001) {
    this.learningRate = learningRate;
    for (let i = 0; i < layerSizes.length - 1; i++) {
      const inSize = layerSizes[i];
      const outSize = layerSizes[i + 1];

      // He/Xavier initialization
      const std = Math.sqrt(2.0 / inSize);
      const weights: number[][] = [];
      const mWeights: number[][] = [];
      const vWeights: number[][] = [];
      const biases: number[] = new Array(outSize).fill(0.01);
      const mBiases: number[] = new Array(outSize).fill(0);
      const vBiases: number[] = new Array(outSize).fill(0);

      for (let o = 0; o < outSize; o++) {
        weights[o] = [];
        mWeights[o] = [];
        vWeights[o] = [];
        for (let j = 0; j < inSize; j++) {
          weights[o][j] = (Math.random() * 2 - 1) * std;
          mWeights[o][j] = 0;
          vWeights[o][j] = 0;
        }
      }

      this.layers.push({
        weights,
        biases,
        mWeights,
        vWeights,
        mBiases,
        vBiases,
      });
    }
  }

  forward(input: number[]): { activations: number[][]; preActivations: number[][] } {
    const activations: number[][] = [input];
    const preActivations: number[][] = [];

    let current = input;
    for (let l = 0; l < this.layers.length; l++) {
      const layer = this.layers[l];
      const isLast = l === this.layers.length - 1;
      const z: number[] = [];
      const a: number[] = [];

      for (let o = 0; o < layer.weights.length; o++) {
        let sum = layer.biases[o];
        for (let i = 0; i < current.length; i++) {
          sum += layer.weights[o][i] * current[i];
        }
        z.push(sum);
        // LeakyReLU for hidden layers, Linear for output Q-value
        a.push(isLast ? sum : sum > 0 ? sum : sum * 0.05);
      }

      preActivations.push(z);
      activations.push(a);
      current = a;
    }

    return { activations, preActivations };
  }

  predict(input: number[]): number[] {
    return this.forward(input).activations[this.layers.length];
  }

  /**
   * Backpropagation and Adam weight update
   */
  train(input: number[], target: number[]): number {
    this.t++;
    const { activations, preActivations } = this.forward(input);
    const lastLayerIdx = this.layers.length - 1;
    const output = activations[this.layers.length];

    // Compute MSE loss & output error
    let loss = 0;
    let deltas: number[] = [];
    for (let o = 0; o < output.length; o++) {
      const diff = output[o] - target[o];
      loss += diff * diff;
      deltas[o] = 2 * diff; // derivative of MSE
    }
    loss /= output.length;

    // Backpropagate through layers
    for (let l = lastLayerIdx; l >= 0; l--) {
      const layer = this.layers[l];
      const prevActivation = activations[l];
      const nextDeltas: number[] = l > 0 ? new Array(prevActivation.length).fill(0) : [];

      for (let o = 0; o < layer.weights.length; o++) {
        const delta = deltas[o];

        // Update weights with Adam
        for (let i = 0; i < prevActivation.length; i++) {
          const grad = delta * prevActivation[i];

          // 1st moment
          layer.mWeights[o][i] = this.beta1 * layer.mWeights[o][i] + (1 - this.beta1) * grad;
          // 2nd moment
          layer.vWeights[o][i] = this.beta2 * layer.vWeights[o][i] + (1 - this.beta2) * grad * grad;

          // Bias-corrected estimates
          const mHat = layer.mWeights[o][i] / (1 - Math.pow(this.beta1, this.t));
          const vHat = layer.vWeights[o][i] / (1 - Math.pow(this.beta2, this.t));

          layer.weights[o][i] -= (this.learningRate * mHat) / (Math.sqrt(vHat) + this.epsilon);

          if (l > 0) {
            nextDeltas[i] += delta * layer.weights[o][i];
          }
        }

        // Update biases with Adam
        layer.mBiases[o] = this.beta1 * layer.mBiases[o] + (1 - this.beta1) * delta;
        layer.vBiases[o] = this.beta2 * layer.vBiases[o] + (1 - this.beta2) * delta * delta;
        const mBiasHat = layer.mBiases[o] / (1 - Math.pow(this.beta1, this.t));
        const vBiasHat = layer.vBiases[o] / (1 - Math.pow(this.beta2, this.t));
        layer.biases[o] -= (this.learningRate * mBiasHat) / (Math.sqrt(vBiasHat) + this.epsilon);
      }

      // Propagate delta backward through LeakyReLU derivative
      if (l > 0) {
        const prevPre = preActivations[l - 1];
        deltas = nextDeltas.map((d, i) => (prevPre[i] > 0 ? d : d * 0.05));
      }
    }

    return loss;
  }

  /**
   * Polyak soft target network update: target = (1 - tau) * target + tau * source
   */
  softUpdate(source: NeuralNetwork, tau = 0.01): void {
    for (let l = 0; l < this.layers.length; l++) {
      const srcLayer = source.layers[l];
      const dstLayer = this.layers[l];

      for (let o = 0; o < dstLayer.weights.length; o++) {
        for (let i = 0; i < dstLayer.weights[o].length; i++) {
          dstLayer.weights[o][i] = (1 - tau) * dstLayer.weights[o][i] + tau * srcLayer.weights[o][i];
        }
        dstLayer.biases[o] = (1 - tau) * dstLayer.biases[o] + tau * srcLayer.biases[o];
      }
    }
  }

  clone(): NeuralNetwork {
    const layerSizes = [this.layers[0].weights[0].length, ...this.layers.map((l) => l.weights.length)];
    const clone = new NeuralNetwork(layerSizes, this.learningRate);
    for (let l = 0; l < this.layers.length; l++) {
      for (let o = 0; o < this.layers[l].weights.length; o++) {
        clone.layers[l].weights[o] = [...this.layers[l].weights[o]];
      }
      clone.layers[l].biases = [...this.layers[l].biases];
    }
    return clone;
  }

  toJSON(): string {
    return JSON.stringify({
      layers: this.layers.map((l) => ({
        weights: l.weights,
        biases: l.biases,
      })),
      learningRate: this.learningRate,
      t: this.t,
    });
  }

  fromJSON(jsonStr: string): void {
    const data = JSON.parse(jsonStr);
    this.learningRate = data.learningRate || this.learningRate;
    this.t = data.t || 0;
    for (let l = 0; l < data.layers.length; l++) {
      this.layers[l].weights = data.layers[l].weights;
      this.layers[l].biases = data.layers[l].biases;
    }
  }
}
