import { signal } from '@angular/core';

/**
 * Tracks in-flight async actions by key so templates can disable buttons and
 * show progress while an operation runs. Prevents double submits from users
 * tapping a button repeatedly when there is no visible feedback.
 */
export class BusyTracker {
  private readonly keys = signal<ReadonlySet<string>>(new Set<string>());

  /** True when the given key is running, or any key when called with no argument. */
  isBusy(key?: string): boolean {
    const current = this.keys();
    return key === undefined ? current.size > 0 : current.has(key);
  }

  /**
   * Runs `action` while marking `key` as busy. Ignores the call if the same key
   * is already running, so repeated taps cannot trigger duplicate work.
   */
  async run<T>(key: string, action: () => Promise<T>): Promise<T | undefined> {
    if (this.keys().has(key)) return undefined;

    this.keys.update((set) => {
      const next = new Set(set);
      next.add(key);
      return next;
    });

    try {
      return await action();
    } finally {
      this.keys.update((set) => {
        const next = new Set(set);
        next.delete(key);
        return next;
      });
    }
  }
}
