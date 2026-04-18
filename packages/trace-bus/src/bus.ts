import { EventEmitter } from 'events';
import { TraceEvent } from './types';

export class TraceBus extends EventEmitter {
  private sequence = 0;

  emitEvent(event: Omit<TraceEvent, 'id' | 'timestamp'>) {
    const timestamp = Date.now();
    const fullEvent: TraceEvent = {
        id: `evt_${timestamp}_${++this.sequence}`,
        timestamp,
        ...event
    };
    this.emit('trace', fullEvent);
    this.emit(event.type, fullEvent);
  }
}
