/**
 * Logging setup for the application
 * Centralizes logging configuration inspired by Python script's listener_configurer
 */

import path from 'path';
import { initializeLogQueue, getLogQueue, QueuedLogger } from './queued-logger';

/**
 * Initialize application logging
 */
export function setupLogging(): void {
  const logsDir = path.join(process.cwd(), 'logs');
  const logFilePath = path.join(logsDir, 'app.log');

  // Initialize the global log queue
  initializeLogQueue(logFilePath);
  
  console.log('[Logging] Queue-based logging initialized');
  console.log(`[Logging] Log file: ${logFilePath}`);
  console.log('[Logging] Logs from all concurrent operations will be queued and written sequentially');
}

/**
 * Get the application logger
 */
export function getApplicationLogger(): QueuedLogger {
  return new QueuedLogger('Application');
}

/**
 * Get a logger for a specific module
 */
export function getModuleLogger(moduleName: string): QueuedLogger {
  return new QueuedLogger(moduleName);
}

/**
 * Centralized error handler using queued logging
 */
export function setupErrorHandlers(): void {
  const logger = getModuleLogger('ErrorHandler');

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error(`Uncaught Exception: ${error.message}`);
    logger.error(`Stack: ${error.stack}`);
  });

  // Handle unhandled rejections
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    logger.error(`Unhandled Rejection: ${message}`);
  });
}

/**
 * Wait for all queued logs to be processed
 */
export async function flushLogs(timeoutMs: number = 5000): Promise<void> {
  const queue = getLogQueue();
  const startTime = Date.now();

  while (queue.isProcessing() || queue.getQueueSize() > 0) {
    if (Date.now() - startTime > timeoutMs) {
      console.warn('[Logging] Flush timeout - some logs may not have been written');
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}
