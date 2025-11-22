declare module 'proper-lockfile' {
  export interface LockOptions {
    timeout?: number;
    maxRetries?: number;
    retryMinTimeout?: number;
    retryMaxTimeout?: number;
    realpath?: boolean;
    lockfilePath?: string;
  }

  export function lock(filePath: string, options?: LockOptions): Promise<string>;
  export function unlock(filePath: string, handle: string): Promise<void>;
}
