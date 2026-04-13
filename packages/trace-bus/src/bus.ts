import { EventEmitter } from 'events';
import { TraceEvent } from './types';

export class TraceBus extends EventEmitter {
  emitEvent(event: Omit<TraceEvent, 'id' | 'timestamp'>) {
    const fullEvent: TraceEvent = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        ...event
    };
    this.emit('trace', fullEvent);
    this.emit(event.type, fullEvent);
  }
}
