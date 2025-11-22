/**
 * Dependency checker - ensures all required external tools are available
 * Inspired by check_requirements() from Python script
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

/**
 * Check if exiftool is available
 */
export async function checkExiftoolAvailable(): Promise<boolean> {
  try {
    await execPromise('exiftool -ver');
    console.log('✓ ExifTool is available');
    return true;
  } catch (error) {
    console.error('✗ ExifTool is NOT available or not in system PATH');
    console.error('  Please download from: https://exiftool.org/');
    return false;
  }
}

/**
 * Check all critical dependencies
 */
export async function checkAllDependencies(): Promise<boolean> {
  console.log('\n--- Checking Dependencies ---');
  
  const exiftoolOk = await checkExiftoolAvailable();
  
  if (!exiftoolOk) {
    console.error('\n❌ CRITICAL: Missing required dependencies');
    console.error('ExifTool must be installed to embed metadata into images');
    return false;
  }
  
  console.log('\n✓ All dependencies are available\n');
  return true;
}

/**
 * Verify dependencies at startup
 */
export async function verifyDependenciesOrExit(): Promise<void> {
  const ok = await checkAllDependencies();
  if (!ok) {
    process.exit(1);
  }
}
