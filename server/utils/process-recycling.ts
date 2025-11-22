/**
 * Process recycling utilities for memory leak prevention
 * Inspired by MAX_TASKS_PER_CHILD from Python script
 */

/**
 * Memory usage monitoring
 */
export class MemoryMonitor {
  private initialMemory: number = 0;
  private startTime: number = 0;

  start(): void {
    if (global.gc) {
      global.gc(); // Force garbage collection if available
    }
    const memUsage = process.memoryUsage();
    this.initialMemory = memUsage.heapUsed;
    this.startTime = Date.now();
    console.log(`[MemoryMonitor] Initial heap: ${(this.initialMemory / 1024 / 1024).toFixed(2)}MB`);
  }

  report(label: string = 'Current'): void {
    if (global.gc) {
      global.gc();
    }
    const memUsage = process.memoryUsage();
    const heapUsed = memUsage.heapUsed;
    const heapTotal = memUsage.heapTotal;
    const external = memUsage.external;
    const rss = memUsage.rss; // Resident set size
    const elapsed = Date.now() - this.startTime;
    const memGrowth = heapUsed - this.initialMemory;

    console.log(`[MemoryMonitor] ${label} (${(elapsed / 1000).toFixed(1)}s):`);
    console.log(`  Heap: ${(heapUsed / 1024 / 1024).toFixed(2)}MB / ${(heapTotal / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  RSS: ${(rss / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  External: ${(external / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Growth: ${(memGrowth / 1024 / 1024).toFixed(2)}MB`);

    // Warn if memory is growing too fast
    if (memGrowth > 200 * 1024 * 1024) { // 200MB growth
      console.warn(`⚠️  [MemoryMonitor] Significant memory growth detected (${(memGrowth / 1024 / 1024).toFixed(2)}MB)`);
    }
  }

  shouldRecycle(maxMemoryMB: number = 300): boolean {
    if (global.gc) {
      global.gc();
    }
    const memUsage = process.memoryUsage();
    const heapUsed = memUsage.heapUsed / 1024 / 1024;

    if (heapUsed > maxMemoryMB) {
      console.warn(`⚠️  [MemoryMonitor] Memory threshold exceeded: ${heapUsed.toFixed(2)}MB > ${maxMemoryMB}MB`);
      return true;
    }
    return false;
  }
}

/**
 * Process recycling manager
 * Tracks task count and determines when to recycle
 */
export class ProcessRecyclingManager {
  private tasksCompleted = 0;
  private maxTasksPerCycle = 1; // Like Python's MAX_TASKS_PER_CHILD = 1
  private memoryMonitor = new MemoryMonitor();
  private memoryThresholdMB = 300;

  constructor(maxTasksPerCycle: number = 1) {
    this.maxTasksPerCycle = maxTasksPerCycle;
    this.memoryMonitor.start();
  }

  /**
   * Record a completed task
   */
  recordTaskComplete(): void {
    this.tasksCompleted++;
  }

  /**
   * Check if recycling is needed
   */
  shouldRecycle(): boolean {
    const taskCountExceeded = this.tasksCompleted >= this.maxTasksPerCycle;
    const memoryExceeded = this.memoryMonitor.shouldRecycle(this.memoryThresholdMB);

    if (taskCountExceeded) {
      console.log(`[ProcessRecycling] Task limit reached (${this.tasksCompleted}/${this.maxTasksPerCycle})`);
    }

    return taskCountExceeded || memoryExceeded;
  }

  /**
   * Report current status
   */
  reportStatus(): void {
    console.log(`[ProcessRecycling] Tasks completed: ${this.tasksCompleted}`);
    this.memoryMonitor.report(`After ${this.tasksCompleted} tasks`);
  }

  /**
   * Reset counters for next cycle
   */
  reset(): void {
    this.tasksCompleted = 0;
    this.memoryMonitor.start();
    console.log('[ProcessRecycling] Cycle reset, ready for new process');
  }

  /**
   * Get tasks completed
   */
  getTasksCompleted(): number {
    return this.tasksCompleted;
  }
}
