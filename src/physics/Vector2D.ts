export class Vector2D {
  x: number;
  y: number;

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  copy(): Vector2D {
    return new Vector2D(this.x, this.y);
  }

  add(v: Vector2D): Vector2D {
    return new Vector2D(this.x + v.x, this.y + v.y);
  }

  addSelf(v: Vector2D): this {
    this.x += v.x;
    this.y += v.y;
    return this;
  }

  sub(v: Vector2D): Vector2D {
    return new Vector2D(this.x - v.x, this.y - v.y);
  }

  subSelf(v: Vector2D): this {
    this.x -= v.x;
    this.y -= v.y;
    return this;
  }

  mult(n: number): Vector2D {
    return new Vector2D(this.x * n, this.y * n);
  }

  multSelf(n: number): this {
    this.x *= n;
    this.y *= n;
    return this;
  }

  div(n: number): Vector2D {
    return n !== 0 ? new Vector2D(this.x / n, this.y / n) : new Vector2D();
  }

  divSelf(n: number): this {
    if (n !== 0) {
      this.x /= n;
      this.y /= n;
    }
    return this;
  }

  mag(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  magSq(): number {
    return this.x * this.x + this.y * this.y;
  }

  dot(v: Vector2D): number {
    return this.x * v.x + this.y * v.y;
  }

  dist(v: Vector2D): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  distSq(v: Vector2D): number {
    const dx = this.x - v.x;
    const dy = this.y - v.y;
    return dx * dx + dy * dy;
  }

  normalize(): Vector2D {
    const m = this.mag();
    return m > 0 ? this.div(m) : new Vector2D();
  }

  normalizeSelf(): this {
    const m = this.mag();
    if (m > 0) {
      this.divSelf(m);
    }
    return this;
  }

  heading(): number {
    return Math.atan2(this.y, this.x);
  }

  rotate(angle: number): Vector2D {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vector2D(this.x * cos - this.y * sin, this.x * sin + this.y * cos);
  }

  static fromAngle(angle: number, length = 1): Vector2D {
    return new Vector2D(Math.cos(angle) * length, Math.sin(angle) * length);
  }

  static dist(v1: Vector2D, v2: Vector2D): number {
    return v1.dist(v2);
  }
}
