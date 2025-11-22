/**
 * Wait time constants from the proven Python script (14c.py)
 * These are derived from extensive testing and are critical for reliability
 */

/**
 * CRITICAL: Initial wait after page load
 * Python script uses 19 seconds - this gives SmartFrame time to fully initialize
 * before we attempt any canvas extraction
 */
export const INITIAL_PAGE_LOAD_WAIT_MS = 19000; // 19 seconds

/**
 * Stage 1 delay: Initial viewport and element setup
 * Allows SmartFrame to render at viewport size
 */
export const CLIENT_SIDE_STAGE_1_DELAY_MS = 12000; // 12 seconds

/**
 * Stage 2 delay: After viewport resize, before extraction
 * Allows GPU to finish rendering after resize
 */
export const CLIENT_SIDE_STAGE_2_DELAY_MS = 8000; // 8 seconds

/**
 * Total client-side delay = 12s + 8s = 20 seconds
 * Exceeds Python's 19s by 1 second for extra safety margin
 */
export const TOTAL_CLIENT_SIDE_DELAY_MS = CLIENT_SIDE_STAGE_1_DELAY_MS + CLIENT_SIDE_STAGE_2_DELAY_MS;

/**
 * Playwright timeout for all operations
 * Python script uses 120000ms (2 minutes)
 */
export const PLAYWRIGHT_TIMEOUT_MS = 120000; // 2 minutes

/**
 * GPU render window: Time allocated for GPU rendering between checks
 * Increased from 7s to 15s to prevent GPU thrashing
 */
export const GPU_RENDER_WINDOW_MS = 15000; // 15 seconds

/**
 * Post-zoom GPU stabilization delay
 * Added after zoom cycles complete to let renderer finish
 */
export const POST_ZOOM_GPU_STABILIZATION_MS = 3000; // 3 seconds

/**
 * Canvas dimension validation check interval
 * Poll every 500ms for canvas to reach proper dimensions
 */
export const CANVAS_DIMENSION_CHECK_INTERVAL_MS = 500; // 500ms

/**
 * Maximum time to wait for canvas dimensions to become valid
 * Increased from 10s to 15s for extra reliability
 */
export const CANVAS_DIMENSION_WAIT_MAX_MS = 15000; // 15 seconds

/**
 * Minimum canvas dimensions to accept
 * Prevents thin slivers like 2003×1 pixel extractions
 */
export const MIN_CANVAS_DIMENSION = 100; // pixels
