declare module 'email-queue' {
  export interface EmailJob {
    id: string;
    to: string;
    from: string;
    subject: string;
    text?: string;
    html?: string;
    attachments?: Array<{
      filename: string;
      content: Buffer | string;
      contentType?: string;
    }>;
    metadata?: Record<string, any>;
    priority?: 'low' | 'normal' | 'high';
    delay?: number;
    attempts?: number;
    backoff?: {
      type: 'fixed' | 'exponential';
      delay: number;
    };
  }

  export interface EmailQueueOptions {
    concurrency?: number;
    defaultJobOptions?: {
      removeOnComplete?: number;
      removeOnFail?: number;
      attempts?: number;
      backoff?: {
        type: 'fixed' | 'exponential';
        delay: number;
      };
    };
  }

  export interface QueueStats {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: number;
  }

  export class EmailQueue {
    constructor(name: string, options?: EmailQueueOptions);
    
    add(jobData: EmailJob): Promise<void>;
    addBulk(jobs: EmailJob[]): Promise<void>;
    
    process(processor: (job: EmailJob) => Promise<void>): void;
    
    getStats(): Promise<QueueStats>;
    
    pause(): Promise<void>;
    resume(): Promise<void>;
    
    clean(grace: number, type: 'completed' | 'failed'): Promise<void>;
    
    close(): Promise<void>;
  }

  export default EmailQueue;
}