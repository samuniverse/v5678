/**
 * File locking utility for concurrent file access
 * Prevents race conditions when multiple processes write to shared files
 * Inspired by FileLock from Python script
 */

import * as Lockfile from 'proper-lockfile';
import fs from 'fs';
import path from 'path';

export interface FileLockOptions {
  timeout?: number;
  maxRetries?: number;
  retryMinTimeout?: number;
  retryMaxTimeout?: number;
}

/**
 * Acquires a lock on a file and executes a callback
 * Automatically releases lock when callback completes
 */
export async function withFileLock<T>(
  filePath: string,
  callback: () => Promise<T>,
  options: FileLockOptions = {}
): Promise<T> {
  const lockOptions = {
    timeout: options.timeout ?? 30000, // 30 second timeout default
    maxRetries: options.maxRetries ?? 5,
    retryMinTimeout: options.retryMinTimeout ?? 100,
    retryMaxTimeout: options.retryMaxTimeout ?? 1000,
    realpath: false,
    lockfilePath: `${filePath}.lock`
  };

  let lockHandle: string | undefined;
  try {
    // Acquire lock
    lockHandle = await Lockfile.lock(filePath, lockOptions);
    
    // Execute callback while holding lock
    const result = await callback();
    
    return result;
  } catch (error) {
    console.error(`[FileLock] Failed to acquire lock for ${filePath}:`, error);
    throw error;
  } finally {
    // Release lock
    if (lockHandle) {
      try {
        await Lockfile.unlock(filePath, lockHandle);
      } catch (unlockError) {
        console.warn(`[FileLock] Failed to release lock for ${filePath}:`, unlockError);
      }
    }
  }
}

/**
 * Safely append a line to a file with file locking
 */
export async function appendLineWithLock(filePath: string, line: string): Promise<void> {
  await withFileLock(filePath, async () => {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Append line
    fs.appendFileSync(filePath, line, 'utf-8');
  });
}

/**
 * Safely read all lines from a file with file locking
 */
export async function readLinesWithLock(filePath: string): Promise<string[]> {
  return withFileLock(filePath, async () => {
    if (!fs.existsSync(filePath)) {
      return [];
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n').filter(line => line.trim().length > 0);
  });
}

/**
 * Safely check if a line exists in a file with file locking
 */
export async function lineExistsWithLock(filePath: string, searchLine: string): Promise<boolean> {
  return withFileLock(filePath, async () => {
    if (!fs.existsSync(filePath)) {
      return false;
    }
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    return lines.some(line => line.trim() === searchLine.trim());
  });
}
