import { Page } from 'puppeteer';
import type { ScraperConfig } from '../types';

/**
 * PAGE PHASE STATE MACHINE
 * 
 * idle      - Page not in use, available for new jobs
 * preload   - Page loading URL, waiting for DOMContentLoaded
 * rendering - Page rendering canvas (CRITICAL: GPU time required)
 * extracting - Extracting canvas data via toDataURL
 * 
 * Transitions:
 *   idle → preload → rendering → extracting → idle
 * 
 * IMPORTANT: Only 'rendering' phase requires GPU priority
 *   Enforces maxConcurrentRenders limit to prevent GPU contention
 */
type PagePhase = 'idle' | 'preload' | 'rendering' | 'extracting';

/**
 * Page State Tracking
 * 
 * @property page - Puppeteer Page instance
 * @property busy - Whether page is currently processing a task
 * @property lastActivated - Timestamp of last bringToFront() call
 * @property phase - Current phase in state machine
 * @property renderStartTime - When this page entered 'rendering' phase
 * @property gpuTimeAllocated - Total GPU time allocated to this page (ms)
 * @property lastPhaseChange - Timestamp of last phase transition
 */
interface PageState {
  page: Page;
  busy: boolean;
  lastActivated: number;
  phase: PagePhase;
  renderStartTime: number;
  gpuTimeAllocated: number;
  lastPhaseChange: number;
}

/**
 * Acquired Page Handle
 * 
 * Returned when requesting a page from the scheduler
 * Call release() when done to mark page as available for next job
 * 
 * @property page - The Puppeteer Page instance to use
 * @property index - Index in the scheduler's page pool
 * @property release - Callback to return page to available pool
 */
interface AcquiredPage {
  page: Page;
  index: number;
  release: () => void;
}

/**
 * Page Activation Scheduler - GPU-Aware Tab Rotation System
 * 
 * PROBLEM SOLVED:
 * SmartFrame canvas rendering requires GPU acceleration. With multiple tabs open
 * in headless Puppeteer, only the "active" (frontmost) tab gets GPU priority.
 * This causes slow renders or blank canvas if tab isn't visible.
 * 
 * SOLUTION:
 * Rotate which tab is "active" periodically (every 500ms default) to give
 * each tab time for GPU rendering. Track phase transitions to ensure rendering
 * tabs get at least 7 seconds of active GPU time.
 * 
 * FEATURES:
 * - Tab state machine (idle/preload/rendering/extracting phases)
 * - GPU render window coordination (prevents GPU contention)
 * - Round-robin activation (fair distribution of GPU time)
 * - Concurrent render limit enforcement (maxConcurrentRenders)
 * - Phase-aware statistics and monitoring
 */
export class PageActivationScheduler {
  private pages: PageState[] = [];
  private activationIntervalMs: number = 500;
  private rotationTimerId: NodeJS.Timeout | null = null;
  private currentActiveIndex: number = 0;
  private activeTasks: Set<Promise<void>> = new Set();
  private shuttingDown: boolean = false;
  private cleanupStarted: Promise<void> | null = null;
  private cleanupResolver: (() => void) | null = null;
  
  private gpuRenderWindowMs: number = 7000;
  private maxConcurrentRenders: number = 2;
  private gpuTimeHistory: number[] = [];

  constructor(pages: Page[], activationIntervalMs: number = 500, config?: ScraperConfig) {
    this.pages = pages.map(page => ({
      page,
      busy: false,
      lastActivated: 0,
      phase: 'idle' as PagePhase,
      renderStartTime: 0,
      gpuTimeAllocated: 0,
      lastPhaseChange: Date.now()
    }));
    this.activationIntervalMs = activationIntervalMs;
    
    if (config?.smartframe) {
      this.gpuRenderWindowMs = config.smartframe.gpuRenderWindowMs ?? 7000;
      this.maxConcurrentRenders = config.smartframe.maxConcurrentRenders ?? 2;
    }
    
    console.log(`[PageScheduler] Created pool with ${pages.length} pages, rotation interval: ${activationIntervalMs}ms`);
    console.log(`[PageScheduler] GPU render window: ${this.gpuRenderWindowMs}ms, max concurrent renders: ${this.maxConcurrentRenders}`);
  }

  /**
   * Set page phase with state machine enforcement
   * 
   * CRITICAL VALIDATION:
   * When transitioning TO 'rendering' phase, enforces maxConcurrentRenders limit
   * Prevents GPU contention by allowing only N tabs to render simultaneously
   * 
   * Example:
   *   - maxConcurrentRenders = 2
   *   - Page 0 in rendering (1 rendering)
   *   - Page 1 in rendering (2 rendering) ← at limit
   *   - Page 2 tries to enter rendering ← BLOCKED until Page 0 or 1 exits
   * 
   * @param index - Page index in pool
   * @param phase - New phase to transition to
   */
  setPhase(index: number, phase: PagePhase): void {
    // Validate page index
    if (index < 0 || index >= this.pages.length) {
      console.error(`[PageScheduler] Invalid page index: ${index}`);
      return;
    }
    
    const pageState = this.pages[index];
    const oldPhase = pageState.phase;
    
    // CRITICAL: Enforce concurrent render limit before allowing transition to 'rendering'
    // This prevents GPU contention from too many simultaneous renders
    if (phase === 'rendering' && oldPhase !== 'rendering') {
      const currentRenderingCount = this.getRenderingCount();
      if (currentRenderingCount >= this.maxConcurrentRenders) {
        console.warn(`[PageScheduler] Page ${index} cannot enter rendering - concurrent limit (${currentRenderingCount}/${this.maxConcurrentRenders}) ✖️`);
        return; // Block the transition
      }
    }
    
    // Only log transitions if phase actually changed
    if (oldPhase !== phase) {
      pageState.phase = phase;
      pageState.lastPhaseChange = Date.now();
      
      // Track render start time for GPU window calculations
      if (phase === 'rendering') {
        pageState.renderStartTime = Date.now();
        pageState.gpuTimeAllocated = 0;
        console.log(`[PageScheduler] Page ${index} entering RENDERING phase (GPU required)`);
      }
      
      console.log(`[PageScheduler] Page ${index} phase: ${oldPhase} → ${phase}`);
    }
  }

  /**
   * Get all pages currently in a specific phase
   * @returns Array of page indices in the specified phase
   */
  getPagesByPhase(phase: PagePhase): number[] {
    return this.pages
      .map((pageState, index) => ({ pageState, index }))
      .filter(({ pageState }) => pageState.phase === phase)
      .map(({ index }) => index);
  }

  /**
   * Enforce GPU render window for pages in rendering phase
   * Ensures rendering tabs get their full GPU time allocation
   */
  async enforceGPURenderWindow(): Promise<void> {
    const renderingPages = this.getPagesByPhase('rendering');
    
    for (const index of renderingPages) {
      const pageState = this.pages[index];
      const elapsedMs = Date.now() - pageState.renderStartTime;
      
      if (elapsedMs < this.gpuRenderWindowMs) {
        const remainingMs = this.gpuRenderWindowMs - elapsedMs;
        console.log(`[PageScheduler] Page ${index} needs ${remainingMs}ms more GPU time, bringing to front`);
        await pageState.page.bringToFront();
      }
    }
  }

  /**
   * Start background rotation of tab focus
   * This keeps all tabs "hot" for GPU rendering
   */
  startRotation(): void {
    if (this.rotationTimerId) {
      console.log('[PageScheduler] Rotation already running');
      return;
    }

    this.rotationTimerId = setInterval(async () => {
      await this.rotateActivePage();
    }, this.activationIntervalMs);
    
    console.log('[PageScheduler] Background tab rotation started');
  }

  /**
   * Stop background rotation
   */
  stopRotation(): void {
    if (this.rotationTimerId) {
      clearInterval(this.rotationTimerId);
      this.rotationTimerId = null;
      console.log('[PageScheduler] Background tab rotation stopped');
    }
  }

  /**
   * Rotate to next page with GPU render window coordination
   * CRITICAL FIX: Check shuttingDown flag before mouse movement
   * Phase 2 Enhancement: Respect GPU render windows for tabs in 'rendering' phase
   */
  private async rotateActivePage(): Promise<void> {
    // Check if shutting down - stop interacting with pages
    if (this.shuttingDown) {
      return;
    }

    try {
      const currentPage = this.pages[this.currentActiveIndex];
      
      // Check if current page is in rendering phase and needs more GPU time
      if (currentPage.phase === 'rendering' && currentPage.renderStartTime > 0) {
        const elapsedMs = Date.now() - currentPage.renderStartTime;
        
        if (elapsedMs < this.gpuRenderWindowMs) {
          const remainingMs = this.gpuRenderWindowMs - elapsedMs;
          console.log(`[PageScheduler] Delaying rotation - page ${this.currentActiveIndex} in rendering phase needs ${remainingMs}ms more GPU time`);
          return;
        }
      }
      
      this.currentActiveIndex = (this.currentActiveIndex + 1) % this.pages.length;
      const pageState = this.pages[this.currentActiveIndex];
      
      // DO NOT call bringToFront() here - it causes focus thrashing
      // Only track timestamp for rotation monitoring
      pageState.lastActivated = Date.now();
      
      // Optional: Simulate subtle mouse movement to keep canvas "hot"
      // This helps prevent GPU throttling on some systems
      // Skip if shutting down
      if (!this.shuttingDown) {
        try {
          const x = 400 + Math.random() * 200;
          const y = 400 + Math.random() * 200;
          await pageState.page.mouse.move(x, y);
        } catch (error) {
          // Mouse movement is optional, ignore errors
        }
      }
    } catch (error) {
      console.error('[PageScheduler] Error during rotation:', error instanceof Error ? error.message : error);
    }
  }

  /**
   * Get next available page for work
   * Returns a task tracking object with release function
   * This will wait if all pages are busy, but returns null immediately if shutdown is in progress
   * 
   * Phase 2 Enhancement: Accepts optional phase parameter and enforces maxConcurrentRenders
   * @param timeoutMs - Maximum time to wait for a page (default: 60000ms)
   * @param phase - Optional phase to set the page to (idle/preload/rendering/extracting)
   */
  async acquirePage(timeoutMs: number = 60000, phase?: PagePhase): Promise<AcquiredPage | null> {
    const startTime = Date.now();
    
    // Create promise that resolves when cleanup starts
    const cleanupWatcher = this.cleanupStarted ? 
      this.cleanupStarted.then(() => null) : 
      new Promise<null>(() => {}); // Never resolves if no cleanup
    
    while (Date.now() - startTime < timeoutMs) {
      // Check shuttingDown flag - return null immediately if shutdown in progress
      if (this.shuttingDown) {
        console.log('[PageScheduler] Shutdown in progress, returning null from acquirePage');
        return null;
      }

      // ISSUE 2 FIX: Enforce maxConcurrentRenders for rendering phase BEFORE acquiring page
      if (phase === 'rendering') {
        const renderingCount = this.getRenderingCount();
        if (renderingCount >= this.maxConcurrentRenders) {
          console.log(`[PageScheduler] Waiting for rendering slot (${renderingCount}/${this.maxConcurrentRenders} renders active)`);
          const waitPromise = new Promise(resolve => setTimeout(resolve, 100));
          await Promise.race([waitPromise, cleanupWatcher]);
          continue;
        }
      }

      const availableIndex = this.pages.findIndex(p => !p.busy);
      
      if (availableIndex !== -1) {
        const pageState = this.pages[availableIndex];
        pageState.busy = true;
        
        // Set phase if provided
        if (phase) {
          this.setPhase(availableIndex, phase);
        }
        
        // Bring this page to front immediately to ensure it's active
        await pageState.page.bringToFront();
        pageState.lastActivated = Date.now();
        
        // Create a task promise and release function
        let taskResolver: (() => void) | null = null;
        const taskPromise = new Promise<void>((resolve) => {
          taskResolver = resolve;
        });
        
        // Add task promise to Set
        this.activeTasks.add(taskPromise);
        
        const release = () => {
          if (this.pages[availableIndex]) {
            const pageState = this.pages[availableIndex];
            
            // Track GPU time if releasing from rendering phase
            if (pageState.phase === 'rendering' && pageState.renderStartTime > 0) {
              const gpuTime = Date.now() - pageState.renderStartTime;
              pageState.gpuTimeAllocated = gpuTime;
              
              // Add to history (keep last 20 samples)
              this.gpuTimeHistory.push(gpuTime);
              if (this.gpuTimeHistory.length > 20) {
                this.gpuTimeHistory.shift();
              }
              
              console.log(`[PageScheduler] Page ${availableIndex} GPU time: ${gpuTime}ms`);
            }
            
            // Reset to idle phase
            this.setPhase(availableIndex, 'idle');
            pageState.busy = false;
          }
          
          // Remove task promise from Set when released
          this.activeTasks.delete(taskPromise);
          if (taskResolver) {
            taskResolver();
          }
          console.log(`[PageScheduler] Released page ${availableIndex}, ${this.getBusyCount()}/${this.pages.length} busy, ${this.activeTasks.size} active tasks`);
        };
        
        console.log(`[PageScheduler] Acquired page ${availableIndex}${phase ? ` (phase: ${phase})` : ''}, ${this.getBusyCount()}/${this.pages.length} busy, ${this.activeTasks.size} active tasks`);
        return { page: pageState.page, index: availableIndex, release };
      }
      
      // Wait a bit before checking again, or until cleanup starts
      const waitPromise = new Promise(resolve => setTimeout(resolve, 100));
      await Promise.race([waitPromise, cleanupWatcher]);
      
      // If cleanupWatcher resolved, check shuttingDown flag on next iteration
    }
    
    console.error('[PageScheduler] Timeout waiting for available page');
    return null;
  }

  /**
   * Get count of busy pages
   */
  private getBusyCount(): number {
    return this.pages.filter(p => p.busy).length;
  }

  /**
   * Get count of pages currently in rendering phase
   * ISSUE 2 FIX: Helper method for maxConcurrentRenders enforcement
   */
  private getRenderingCount(): number {
    return this.pages.filter(p => p.phase === 'rendering').length;
  }

  /**
   * Get pool statistics
   * Phase 2 Enhancement: Includes phase breakdown, rendering tabs, and average GPU time
   */
  getStats(): { 
    total: number; 
    busy: number; 
    available: number; 
    activeTasks: number;
    byPhase: Record<string, number>;
    renderingTabs: number[];
    averageGPUTime: number;
  } {
    const busy = this.getBusyCount();
    
    // Count tabs by phase
    const byPhase: Record<string, number> = {
      idle: 0,
      preload: 0,
      rendering: 0,
      extracting: 0
    };
    
    this.pages.forEach(pageState => {
      byPhase[pageState.phase] = (byPhase[pageState.phase] || 0) + 1;
    });
    
    // Get indices of rendering tabs
    const renderingTabs = this.getPagesByPhase('rendering');
    
    // Calculate average GPU time from history
    const averageGPUTime = this.gpuTimeHistory.length > 0
      ? this.gpuTimeHistory.reduce((sum, time) => sum + time, 0) / this.gpuTimeHistory.length
      : 0;
    
    return {
      total: this.pages.length,
      busy,
      available: this.pages.length - busy,
      activeTasks: this.activeTasks.size,
      byPhase,
      renderingTabs,
      averageGPUTime
    };
  }

  /**
   * Cleanup all pages and stop rotation
   * CRITICAL FIX: Set shuttingDown flag, wait for tasks with timeout, then force-close
   * @param closePages - Whether to close the pages (default: true). Set to false if caller will close them.
   */
  async cleanup(timeoutMs: number = 30000, closePages: boolean = true): Promise<void> {
    console.log('[PageScheduler] Cleaning up page pool...');
    
    // Set shuttingDown flag at start
    this.shuttingDown = true;
    
    // Resolve cleanupStarted promise to wake waiters
    if (!this.cleanupStarted) {
      this.cleanupStarted = new Promise((resolve) => {
        this.cleanupResolver = resolve;
      });
    }
    if (this.cleanupResolver) {
      this.cleanupResolver();
    }
    
    this.stopRotation();
    
    // Wait for all active tasks to complete with timeout
    if (this.activeTasks.size > 0) {
      console.log(`[PageScheduler] Waiting for ${this.activeTasks.size} active tasks to complete...`);
      const startTime = Date.now();
      
      // Use Promise.race to wait for tasks or timeout
      const allTasksPromise = Promise.all(Array.from(this.activeTasks));
      const timeoutPromise = new Promise<void>((resolve) => 
        setTimeout(resolve, timeoutMs)
      );
      
      await Promise.race([allTasksPromise, timeoutPromise]);
      
      const elapsedMs = Date.now() - startTime;
      
      if (this.activeTasks.size > 0) {
        console.warn(`[PageScheduler] Timeout waiting for tasks - ${this.activeTasks.size} tasks still active after ${elapsedMs}ms`);
        console.warn(`[PageScheduler] Forcing cleanup despite hanging tasks`);
      } else {
        console.log(`[PageScheduler] All active tasks completed in ${elapsedMs}ms`);
      }
    }
    
    // Close all pages if requested
    if (closePages) {
      await Promise.all(
        this.pages.map(ps => ps.page.close().catch(() => {}))
      );
    }
    
    this.pages = [];
    console.log('[PageScheduler] Cleanup complete');
  }
}
