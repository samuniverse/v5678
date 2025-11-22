/**
 * Completed images tracker - tracks successfully extracted images
 * Prevents re-processing of already-completed images
 * Inspired by completed.txt from Python script
 * Uses file locking to prevent race conditions in concurrent scenarios
 */

import fs from 'fs';
import path from 'path';
import { appendLineWithLock, readLinesWithLock } from './file-locking';

class CompletedImagesTracker {
  private completedImages = new Set<string>();
  private filePath: string;
  private initialized = false;

  constructor() {
    const dir = path.join(process.cwd(), 'failed-scrapes');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.filePath = path.join(dir, 'completed.txt');
    
    if (!fs.existsSync(this.filePath)) {
      fs.writeFileSync(this.filePath, '', 'utf-8');
      console.log(`[CompletedImages] Created empty completed.txt file`);
    }
    
    this.loadCompleted();
  }

  private async loadCompleted(): Promise<void> {
    try {
      const lines = await readLinesWithLock(this.filePath);
      lines.forEach(line => {
        // Parse format: imageId\ttimestamp
        const imageId = line.split('\t')[0];
        if (imageId) {
          this.completedImages.add(imageId);
        }
      });
      console.log(`[CompletedImages] Loaded ${this.completedImages.size} completed images`);
    } catch (error) {
      console.warn('[CompletedImages] Could not load completed images:', error);
    }
    this.initialized = true;
  }

  /**
   * Check if an image has already been successfully completed
   */
  isCompleted(imageId: string): boolean {
    return this.completedImages.has(imageId);
  }

  /**
   * Mark an image as successfully completed (with file locking)
   */
  async markCompleted(imageId: string): Promise<void> {
    // Wait for initialization if needed
    while (!this.initialized) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!this.completedImages.has(imageId)) {
      this.completedImages.add(imageId);
      await this.appendToFileWithLock(imageId);
      console.log(`[CompletedImages] Marked ${imageId} as completed`);
    }
  }

  private async appendToFileWithLock(imageId: string): Promise<void> {
    try {
      const timestamp = new Date().toISOString();
      const line = `${imageId}\t${timestamp}\n`;
      await appendLineWithLock(this.filePath, line);
    } catch (error) {
      console.error('[CompletedImages] Failed to write to file:', error);
    }
  }

  /**
   * Get count of completed images
   */
  getCount(): number {
    return this.completedImages.size;
  }
}

export const completedImagesTracker = new CompletedImagesTracker();
