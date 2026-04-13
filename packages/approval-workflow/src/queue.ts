import { ApprovalRequestPayload, ReviewResponse } from './types';

// Loose interface to decouple from TraceBus implementation fully
export interface WorkflowEventEmitter {
  emitEvent(event: any): void;
}

export type ApprovalHandle = Promise<ReviewResponse> & {
  id: string;
  updatePreview: (preview: string) => void;
};

export class ApprovalQueueManager {
  private queue: Map<string, {
    payload: ApprovalRequestPayload,
    resolver: (response: ReviewResponse) => void
  }> = new Map();

  private emitter: WorkflowEventEmitter;

  constructor(emitter: WorkflowEventEmitter) {
    this.emitter = emitter;
  }

  requestApproval(
    request: Omit<ApprovalRequestPayload, 'id'>
  ): ApprovalHandle {
    const id = Math.random().toString(36).substring(2, 10);
    const payload: ApprovalRequestPayload = { ...request, id };

    // Auto-deny outside workspace attempts immediately without bothering human
    if (payload.changeType === 'outside_workspace_denial') {
      this.emitter.emitEvent({ type: 'policy_denial_logged', data: payload.target });
      return Object.assign(
        Promise.resolve({ approved: false, editInstruction: 'Action strictly prohibited by workspace policy.' }),
        {
          id,
          updatePreview: () => {},
        },
      );
    }

    const promise = new Promise<ReviewResponse>((resolve) => {
      this.queue.set(id, { payload, resolver: resolve });
      
      // Notify trace bus / UI that a new approval is pending
      this.emitter.emitEvent({ type: 'approval_enqueued', data: payload });
    });

    return Object.assign(promise, {
      id,
      updatePreview: (preview: string) => {
        const item = this.queue.get(id);
        if (!item) {
          return;
        }

        item.payload.diffPreview = preview;
        this.emitter.emitEvent({ type: 'approval_preview_updated', data: { id, preview } });
      },
    });
  }

  getPendingQueue(): ApprovalRequestPayload[] {
    return Array.from(this.queue.values()).map(q => q.payload);
  }

  resolveApproval(id: string, response: ReviewResponse) {
    const item = this.queue.get(id);
    if (!item) return false;

    item.resolver(response);
    this.queue.delete(id);

    this.emitter.emitEvent({ type: 'approval_resolved', data: { id, response } });
    return true;
  }
}
