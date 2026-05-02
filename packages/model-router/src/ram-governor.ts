import { HeavyModelLockState, ModelRouterTraceEmitter } from './types';

export class HeavyModelLock {
  private readonly state: HeavyModelLockState = {
    held: false,
    ownerRunId: null,
    queued: 0,
  };
  private tail: Promise<void> = Promise.resolve();

  constructor(private readonly emitTrace?: ModelRouterTraceEmitter) {}

  snapshot(): HeavyModelLockState {
    return { ...this.state };
  }

  async acquire(runId: string): Promise<() => void> {
    this.state.queued += 1;
    const previousTail = this.tail;
    let releaseTail!: () => void;
    const currentTail = new Promise<void>((resolve) => {
      releaseTail = resolve;
    });
    this.tail = previousTail.then(() => currentTail);

    await previousTail;
    this.state.queued = Math.max(0, this.state.queued - 1);
    this.state.held = true;
    this.state.ownerRunId = runId;
    this.emitTrace?.('heavy_model_lock_acquired', {
      runId,
      ownerRunId: this.state.ownerRunId,
      queued: this.state.queued,
    });

    let released = false;
    return () => {
      if (released) {
        return;
      }

      released = true;
      this.state.held = false;
      this.state.ownerRunId = null;
      this.emitTrace?.('heavy_model_lock_released', { runId });
      releaseTail();
    };
  }
}

export function selectUnloadCandidates(runningModels: Array<{ model?: string; name?: string }>, targetModel: string): string[] {
  return Array.from(new Set(
    runningModels
      .map((entry) => entry.model || entry.name)
      .filter((modelName): modelName is string => Boolean(modelName) && modelName !== targetModel),
  ));
}
