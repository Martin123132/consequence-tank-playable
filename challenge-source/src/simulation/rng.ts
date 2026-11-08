export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
    if (this.state === 0) {
      this.state = 0x6d2b79f5;
    }
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  clone(): Rng {
    const copy = new Rng(1);
    copy.state = this.state;
    return copy;
  }

  int(min: number, maxInclusive: number): number {
    return Math.floor(this.next() * (maxInclusive - min + 1)) + min;
  }

  choice<T>(items: T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  fork(offset: number): Rng {
    return new Rng((this.state ^ (offset * 0x9e3779b9)) >>> 0);
  }
}

