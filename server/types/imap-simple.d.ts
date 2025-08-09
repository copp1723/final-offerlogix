declare module 'imap-simple' {
  export interface ImapSimple {
    search(criteria: any[], fetchOptions?: any): Promise<any[]>;
  // Library supports both single UID and array plus callback; we add promise-friendly overload
  addFlags(source: number | number[], flag: string | string[], callback: (err: Error | null) => void): void;
  moveMessage(source: number | number[], boxName: string): Promise<void>;
    getBoxes(callback: (err: Error | null, boxes: any) => void): void;
    openBox(name: string): Promise<any>;
    closeBox(callback: (err: Error | null) => void): void;
    end(): void;
    destroy(): void;
    imap?: {
      on(event: string, callback: (...args: any[]) => void): void;
    };
  }

  export interface ConnectOptions {
    imap: {
      user: string;
      password: string;
      host: string;
      port: number;
      tls?: boolean;
      authTimeout?: number;
      connTimeout?: number;
      tlsOptions?: any;
    };
  }

  export function connect(options: ConnectOptions): Promise<ImapSimple>;
  
  export const simpleParser: any;
}