/**
 * Queue-based logging system for concurrent operations
 * Prevents log interleaving from multiple async sources
 * Inspired by Python script's listener_configurer + worker_configurer
 */

import fs from 'fs';
import path from 'path';

export interface LogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: Date;
  source?: string;
}

/**
 * Central Log Queue - Sequential Processing
 * 
 * PROBLEM SOLVED:
 * When multiple async workers log concurrently, output interleaves:
 *   [Worker 1] Starting extract
 *   [Worker 2] Starting extract
 *   [Worker 1] Canvas found
 *   [Worker 3] Starting extract
 *   [Worker 2] Canvas timeout
 *   ... (messy, hard to debug)
 * 
 * SOLUTION:
 * Central queue processes all logs sequentially, one at a time
 * Result: Clean, ordered output that's easy to follow
 * 
 * INSPIRED BY: Python's listener_configurer + worker_configurer pattern
 */
export class LogQueue {
  private queue: LogEntry[] = [];
  private processing = false;
  private logFile: string = '';
  private consoleOutput = true;
  private useFileLogging = false;

  constructor(logFilePath?: string) {
    // Initialize with optional file path for persistent logging
    if (logFilePath) {
      this.useFileLogging = true;
      this.logFile = logFilePath;
      this.ensureLogDirectory();
    }
  }

  private ensureLogDirectory(): void {
    if (this.logFile) {
      const dir = path.dirname(this.logFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Enqueue a log entry
   */
  enqueue(entry: LogEntry): void {
    this.queue.push(entry);
    this.processQueue();
  }

  /**
   * Process queued logs sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const entry = this.queue.shift();
      if (entry) {
        await this.writeLog(entry);
      }
    }

    this.processing = false;
  }

  /**
   * Write a single log entry
   */
  private async writeLog(entry: LogEntry): Promise<void> {
    const timestamp = entry.timestamp.toISOString();
    const source = entry.source ? ` [${entry.source}]` : '';
    const formatted = `${timestamp}${source} [${entry.level.toUpperCase()}] ${entry.message}`;

    // Write to console
    if (this.consoleOutput) {
      const logFn = console[entry.level] || console.log;
      logFn(formatted);
    }

    // Write to file
    if (this.useFileLogging && this.logFile) {
      try {
        await fs.promises.appendFile(this.logFile, formatted + '\n', 'utf-8');
      } catch (error) {
        console.error('[LogQueue] Failed to write to log file:', error);
      }
    }
  }

  /**
   * Enable/disable console output
   */
  setConsoleOutput(enabled: boolean): void {
    this.consoleOutput = enabled;
  }

  /**
   * Get queue size (for monitoring)
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Check if currently processing
   */
  isProcessing(): boolean {
    return this.processing;
  }
}

/**
 * Global queue-based logger instance
 */
let globalLogQueue: LogQueue | null = null;

/**
 * Initialize the global log queue
 */
export function initializeLogQueue(logFilePath?: string): LogQueue {
  if (!globalLogQueue) {
    globalLogQueue = new LogQueue(logFilePath);
  }
  return globalLogQueue;
}

/**
 * Get the global log queue
 */
export function getLogQueue(): LogQueue {
  if (!globalLogQueue) {
    globalLogQueue = new LogQueue();
  }
  return globalLogQueue;
}

/**
 * Queued logger adapter - works like console but uses the queue
 */
export class QueuedLogger {
  constructor(private source?: string) {}

  info(message: string): void {
    const queue = getLogQueue();
    queue.enqueue({
      level: 'info',
      message,
      timestamp: new Date(),
      source: this.source
    });
  }

  warn(message: string): void {
    const queue = getLogQueue();
    queue.enqueue({
      level: 'warn',
      message,
      timestamp: new Date(),
      source: this.source
    });
  }

  error(message: string): void {
    const queue = getLogQueue();
    queue.enqueue({
      level: 'error',
      message,
      timestamp: new Date(),
      source: this.source
    });
  }

  debug(message: string): void {
    const queue = getLogQueue();
    queue.enqueue({
      level: 'debug',
      message,
      timestamp: new Date(),
      source: this.source
    });
  }

  log(message: string): void {
    this.info(message);
  }
}

/**
 * Create a logger for a specific source/module
 */
export function createLogger(source: string): QueuedLogger {
  return new QueuedLogger(source);
}
