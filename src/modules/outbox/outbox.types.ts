export enum OutboxEventStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

export enum OutboxEventType {
  APPLICATION_DECISIONED = 'APPLICATION_DECISIONED',
}

export interface ApplicationDecisionedPayload {
  applicationId: string;
  decision: string;
  score: number;
}

export interface OutboxEventData {
  eventId: string;
  eventType: OutboxEventType;
  applicationId: string;
  payload: ApplicationDecisionedPayload;
}
