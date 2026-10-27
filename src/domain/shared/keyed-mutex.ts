/**
 * Tiny in-process lock keyed by a string (e.g. an auction id).
 *
 * The app is single-process, so we don't need distributed locks. But Node can
 * still interleave two async requests (two bids on the same auction at the same
 * millisecond). This makes operations on the SAME auction run one after the
 * other, while different auctions still run in parallel.
 */
export class KeyedMutex {
  private readonly tails = new Map<string, Promise<void>>();

  async runExclusive<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();

    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => current);
    this.tails.set(key, tail);

    await previous;
    try {
      return await task();
    } finally {
      release();
      if (this.tails.get(key) === tail) {
        this.tails.delete(key);
      }
    }
  }
}
