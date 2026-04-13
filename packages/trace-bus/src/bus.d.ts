import { EventEmitter } from 'events';
import { TraceEvent } from './types';
export declare class TraceBus extends EventEmitter {
    emitEvent(event: Omit<TraceEvent, 'id' | 'timestamp'>): void;
}
