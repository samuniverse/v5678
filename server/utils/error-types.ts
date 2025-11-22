/**
 * Error classification system from the Python script
 * Distinguishes between retryable (TransientError) and non-retryable (PermanentError) failures
 */

/**
 * PermanentError - Do NOT retry. Image is hopeless.
 * Examples: Navigation timeouts after 3 attempts, Extension errors, Invalid metadata parsing
 */
export class PermanentError extends Error {
  constructor(message: string, public readonly imageId: string) {
    super(message);
    this.name = 'PermanentError';
  }
}

/**
 * TransientError - Can be retried. Temporary failure.
 * Examples: Network glitches, GPU timeouts, Canvas rendering delays
 */
export class TransientError extends Error {
  constructor(message: string, public readonly imageId: string) {
    super(message);
    this.name = 'TransientError';
  }
}

/**
 * MetadataError - ExifTool or metadata extraction failed
 */
export class MetadataError extends PermanentError {
  constructor(imageId: string, message: string) {
    super(`Metadata extraction failed: ${message}`, imageId);
    this.name = 'MetadataError';
  }
}

/**
 * CanvasRenderError - Canvas extraction failed permanently (not retryable)
 */
export class CanvasRenderError extends PermanentError {
  constructor(imageId: string, message: string) {
    super(`Canvas render failed: ${message}`, imageId);
    this.name = 'CanvasRenderError';
  }
}

/**
 * Check if error is retryable
 */
export function isRetryable(error: Error): boolean {
  return error instanceof TransientError;
}

/**
 * Check if error is permanent
 */
export function isPermanent(error: Error): boolean {
  return error instanceof PermanentError;
}
