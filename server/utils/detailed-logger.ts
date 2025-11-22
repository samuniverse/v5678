/**
 * Detailed Logger Utility
 * 
 * Comprehensive logging system for SmartFrame extraction with structured debugging
 * Inspired by Python scripts' logging patterns (14c.py, uni.py, smartframe_extractor.py)
 * 
 * FEATURES:
 * - Multiple log levels (DEBUG, INFO, WARN, ERROR, CRITICAL)
 * - Structured logging with timestamps and context
 * - Step-by-step extraction tracking
 * - Performance timing measurements
 * - Canvas state logging
 * - Method attempt tracking
 * - Error categorization
 */

import fs from 'fs';
import path from 'path';
import { QueuedLogger } from './queued-logger';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4
}

export interface LogContext {
  imageId?: string;
  jobId?: string;
  url?: string;
  method?: string;
  step?: string;
  attempt?: number;
  elapsed?: number;
  [key: string]: any;
}

export interface PerformanceMetrics {
  startTime: number;
  checkpoints: Map<string, number>;
  totals: Map<string, number>;
}

/**
 * Detailed Logger Class
 * Provides comprehensive logging with context and structured output
 */
export class DetailedLogger {
  private moduleName: string;
  private queuedLogger: QueuedLogger;
  private currentLogLevel: LogLevel;
  private metrics: PerformanceMetrics;
  private debugFile: string | null;

  constructor(moduleName: string, logLevel: LogLevel = LogLevel.INFO, debugFile?: string) {
    this.moduleName = moduleName;
    this.queuedLogger = new QueuedLogger(moduleName);
    this.currentLogLevel = logLevel;
    this.metrics = {
      startTime: Date.now(),
      checkpoints: new Map(),
      totals: new Map()
    };
    this.debugFile = debugFile || null;

    if (this.debugFile) {
      this.ensureDebugFileExists(this.debugFile);
    }
  }

  /**
   * Ensure debug file exists and is writable
   */
  private ensureDebugFileExists(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, `=== Detailed Debug Log Started: ${new Date().toISOString()} ===\n\n`);
    }
  }

  /**
   * Write to debug file if enabled
   */
  private writeToDebugFile(message: string): void {
    if (this.debugFile) {
      try {
        fs.appendFileSync(this.debugFile, `${message}\n`);
      } catch (error) {
        console.error(`[DetailedLogger] Failed to write to debug file: ${error}`);
      }
    }
  }

  /**
   * Safe JSON serialization that handles circular references and non-serializable values
   */
  private safeStringify(obj: any): string {
    const seen = new WeakSet();
    try {
      return JSON.stringify(obj, (key, value) => {
        // Handle null/undefined
        if (value === null || value === undefined) {
          return value;
        }

        // Handle functions
        if (typeof value === 'function') {
          return `[Function: ${value.name || 'anonymous'}]`;
        }

        // Handle circular references
        if (typeof value === 'object') {
          if (seen.has(value)) {
            return '[Circular]';
          }
          seen.add(value);
        }

        // Handle Error objects
        if (value instanceof Error) {
          return {
            name: value.name,
            message: value.message,
            stack: value.stack
          };
        }

        return value;
      });
    } catch (error) {
      // Fallback for any serialization failure
      return '[Unserializable]';
    }
  }

  /**
   * Format log message with context
   */
  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | ${this.safeStringify(context)}` : '';
    return `[${timestamp}] [${level}] [${this.moduleName}] ${message}${contextStr}`;
  }

  /**
   * Log message if level is appropriate
   */
  private log(level: LogLevel, levelName: string, message: string, context?: LogContext): void {
    if (level < this.currentLogLevel) {
      return;
    }

    const formatted = this.formatMessage(levelName, message, context);
    
    // Write to debug file for all levels
    this.writeToDebugFile(formatted);

    // Send to appropriate console/queue based on level with proper severity routing
    switch (level) {
      case LogLevel.DEBUG:
        this.queuedLogger.debug(formatted);  // Use debug method for DEBUG level
        break;
      case LogLevel.INFO:
        this.queuedLogger.info(formatted);
        break;
      case LogLevel.WARN:
        this.queuedLogger.warn(formatted);
        break;
      case LogLevel.ERROR:
        this.queuedLogger.error(formatted);
        break;
      case LogLevel.CRITICAL:
        this.queuedLogger.error(formatted);
        console.error(`🚨 CRITICAL: ${formatted}`);  // Always show critical errors
        break;
    }
  }

  /**
   * DEBUG level - Detailed step-by-step information
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, context);
  }

  /**
   * INFO level - General information
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, 'INFO', message, context);
  }

  /**
   * WARN level - Warning messages
   */
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, 'WARN', message, context);
  }

  /**
   * ERROR level - Error messages
   */
  error(message: string, context?: LogContext): void {
    this.log(LogLevel.ERROR, 'ERROR', message, context);
  }

  /**
   * CRITICAL level - Critical failures
   */
  critical(message: string, context?: LogContext): void {
    this.log(LogLevel.CRITICAL, 'CRITICAL', message, context);
  }

  /**
   * Log extraction step start
   */
  stepStart(step: string, context?: LogContext): void {
    const stepContext = { ...context, step };
    this.info(`▶ Starting step: ${step}`, stepContext);
    this.metrics.checkpoints.set(step, Date.now());
  }

  /**
   * Log extraction step completion
   */
  stepComplete(step: string, success: boolean, context?: LogContext): void {
    const startTime = this.metrics.checkpoints.get(step);
    const elapsed = startTime ? Date.now() - startTime : 0;
    
    const stepContext = { ...context, step, elapsed, success };
    const emoji = success ? '✅' : '❌';
    this.info(`${emoji} Step ${success ? 'completed' : 'failed'}: ${step} (${elapsed}ms)`, stepContext);

    // Track total time for this step type
    const currentTotal = this.metrics.totals.get(step) || 0;
    this.metrics.totals.set(step, currentTotal + elapsed);
  }

  /**
   * Log canvas state for debugging
   */
  logCanvasState(state: {
    found: boolean;
    width?: number;
    height?: number;
    selector?: string;
    shadowRoot?: boolean;
    location?: string;
  }, context?: LogContext): void {
    const canvasContext = { ...context, canvas: state };
    if (state.found) {
      this.debug(
        `Canvas found: ${state.width}x${state.height} via ${state.selector} (shadow: ${state.shadowRoot}, location: ${state.location})`,
        canvasContext
      );
    } else {
      this.warn(`Canvas not found with selector: ${state.selector}`, canvasContext);
    }
  }

  /**
   * Log method attempt
   */
  logMethodAttempt(method: string, attempt: number, total: number, context?: LogContext): void {
    const methodContext = { ...context, method, attempt, totalAttempts: total };
    this.info(`🔄 Attempting method: ${method} (${attempt}/${total})`, methodContext);
  }

  /**
   * Log method result
   */
  logMethodResult(method: string, success: boolean, error?: string, context?: LogContext): void {
    const methodContext = { ...context, method, success, error };
    if (success) {
      this.info(`✅ Method succeeded: ${method}`, methodContext);
    } else {
      this.warn(`❌ Method failed: ${method} - ${error}`, methodContext);
    }
  }

  /**
   * Log timing checkpoint
   */
  checkpoint(name: string, context?: LogContext): void {
    const elapsed = Date.now() - this.metrics.startTime;
    const checkpointContext = { ...context, checkpoint: name, totalElapsed: elapsed };
    this.debug(`⏱ Checkpoint: ${name} (total elapsed: ${elapsed}ms)`, checkpointContext);
    this.metrics.checkpoints.set(name, Date.now());
  }

  /**
   * Log wait operation
   */
  logWait(reason: string, durationMs: number, context?: LogContext): void {
    const waitContext = { ...context, waitReason: reason, durationMs };
    this.debug(`⏳ Waiting ${durationMs}ms for: ${reason}`, waitContext);
  }

  /**
   * Log dimension changes
   */
  logDimensionChange(from: { width: number; height: number }, to: { width: number; height: number }, context?: LogContext): void {
    const dimContext = { ...context, from, to };
    this.debug(`📐 Dimension change: ${from.width}x${from.height} → ${to.width}x${to.height}`, dimContext);
  }

  /**
   * Log extraction summary
   */
  logExtractionSummary(summary: {
    imageId: string;
    success: boolean;
    method?: string;
    totalTime: number;
    dataSize?: number;
    width?: number;
    height?: number;
    attempts?: number;
  }): void {
    const emoji = summary.success ? '🎉' : '💔';
    this.info(
      `${emoji} Extraction summary for ${summary.imageId}: ` +
      `${summary.success ? 'SUCCESS' : 'FAILED'} ` +
      `(method: ${summary.method || 'N/A'}, time: ${summary.totalTime}ms, ` +
      `size: ${summary.dataSize || 0} bytes, dims: ${summary.width || 0}x${summary.height || 0}, ` +
      `attempts: ${summary.attempts || 0})`,
      { summary }
    );
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): string {
    const totalElapsed = Date.now() - this.metrics.startTime;
    const lines: string[] = [
      `\n=== Performance Summary for ${this.moduleName} ===`,
      `Total elapsed time: ${totalElapsed}ms`,
      `\nStep timings:`
    ];

    for (const [step, time] of this.metrics.totals.entries()) {
      lines.push(`  ${step}: ${time}ms`);
    }

    lines.push(`\nCheckpoints:`);
    for (const [checkpoint, time] of this.metrics.checkpoints.entries()) {
      const elapsed = time - this.metrics.startTime;
      lines.push(`  ${checkpoint}: +${elapsed}ms from start`);
    }

    return lines.join('\n');
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      startTime: Date.now(),
      checkpoints: new Map(),
      totals: new Map()
    };
  }

  /**
   * Set log level dynamically
   */
  setLogLevel(level: LogLevel): void {
    this.currentLogLevel = level;
    this.info(`Log level changed to: ${LogLevel[level]}`);
  }
}

/**
 * Create a detailed logger instance
 */
export function createDetailedLogger(
  moduleName: string,
  options?: {
    logLevel?: LogLevel;
    debugFile?: string;
  }
): DetailedLogger {
  return new DetailedLogger(
    moduleName,
    options?.logLevel || LogLevel.INFO,
    options?.debugFile
  );
}

/**
 * Global logger instances for common modules
 */
export const ExtractionLogger = createDetailedLogger('Extraction', {
  logLevel: LogLevel.DEBUG,
  debugFile: path.join(process.cwd(), 'logs', 'extraction-debug.log')
});

export const CanvasLogger = createDetailedLogger('Canvas', {
  logLevel: LogLevel.DEBUG,
  debugFile: path.join(process.cwd(), 'logs', 'canvas-debug.log')
});

export const MetadataLogger = createDetailedLogger('Metadata', {
  logLevel: LogLevel.DEBUG,
  debugFile: path.join(process.cwd(), 'logs', 'metadata-debug.log')
});

export const ScraperLogger = createDetailedLogger('Scraper', {
  logLevel: LogLevel.INFO,
  debugFile: path.join(process.cwd(), 'logs', 'scraper-debug.log')
});
