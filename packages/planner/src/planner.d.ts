export interface TraceBus {
    emitEvent(event: any): void;
}
import { PlanState } from './types';
export declare class Planner {
    private traceBus;
    private state;
    constructor(traceBus: TraceBus);
    private emitStateChange;
    setTaskSummary(summary: string): void;
    setPhase(phase: string): void;
    setActiveSkills(skills: string[]): void;
    setIntendedAction(action: string): void;
    addBlocker(blocker: string): void;
    clearBlockers(): void;
    completeTask(outcome: string): void;
    getState(): PlanState;
}
