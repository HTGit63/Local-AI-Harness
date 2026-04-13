export interface TraceEvent {
    id: string;
    timestamp: number;
    type: string;
    data: unknown;
}
