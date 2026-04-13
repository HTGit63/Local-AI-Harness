import { ApprovalRequestPayload, ReviewResponse } from './types';
export interface WorkflowEventEmitter {
    emitEvent(event: any): void;
}
export type ApprovalHandle = Promise<ReviewResponse> & {
    id: string;
    updatePreview: (preview: string) => void;
};
export declare class ApprovalQueueManager {
    private queue;
    private emitter;
    constructor(emitter: WorkflowEventEmitter);
    requestApproval(request: Omit<ApprovalRequestPayload, 'id'>): ApprovalHandle;
    getPendingQueue(): ApprovalRequestPayload[];
    resolveApproval(id: string, response: ReviewResponse): boolean;
}
