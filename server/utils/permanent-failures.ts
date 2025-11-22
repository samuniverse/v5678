/**
 * Permanent failure tracker - prevents retrying hopeless images
 * Inspired by permanently_failed.txt from Python script
 * Uses file locking to prevent race conditions in concurrent scenarios
 */

import fs from 'fs';
import path from 'path';
import { appendLineWithLock, readLinesWithLock, lineExistsWithLock } from './file-locking';

class PermanentFailureTracker {
  private failedImages = new Set<string>();
  private filePath: string;
  private initialized = false;

  constructor() {
    const dir = path.join(process.cwd(), 'failed-scrapes');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.filePath = path.join(dir, 'permanently-failed.txt');
    this.loadFailures();
  }

  private async loadFailures(): Promise<void> {
    try {
      const lines = await readLinesWithLock(this.filePath);
      lines.forEach(line => {
        // Parse format: imageId\treason\ttimestamp
        const imageId = line.split('\t')[0];
        if (imageId) {
          this.failedImages.add(imageId);
        }
      });
      console.log(`[PermanentFailures] Loaded ${this.failedImages.size} permanently failed images`);
    } catch (error) {
      console.warn('[PermanentFailures] Could not load permanently failed images:', error);
    }
    this.initialized = true;
  }

  /**
   * Check if an image has permanently failed
   */
  isPermanentlyFailed(imageId: string): boolean {
    return this.failedImages.has(imageId);
  }

  /**
   * Mark an image as permanently failed (with file locking)
   */
  async markPermanentFailed(imageId: string, reason: string): Promise<void> {
    // Wait for initialization if needed
    while (!this.initialized) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!this.failedImages.has(imageId)) {
      this.failedImages.add(imageId);
      await this.appendToFileWithLock(imageId, reason);
      console.log(`[PermanentFailures] Marked ${imageId} as permanently failed: ${reason}`);
    }
  }

  private async appendToFileWithLock(imageId: string, reason: string): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const line = `${imageId}\t${reason}\t${timestamp}\n`;
      await appendLineWithLock(this.filePath, line);
    } catch (error) {
      console.error('[PermanentFailures] Failed to write to file:', error);
    }
  }

  /**
   * Get count of permanently failed images
   */
  getCount(): number {
    return this.failedImages.size;
  }
}

export const permanentFailureTracker = new PermanentFailureTracker();
