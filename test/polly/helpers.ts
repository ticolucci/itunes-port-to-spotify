import { Polly } from '@pollyjs/core'
import fs from 'fs'
import path from 'path'

/**
 * Check if a recording exists for a given test
 */
export function recordingExists(testName: string, recordingType: 'unit' | 'integration' | 'shared' = 'unit'): boolean {
  const recordingsDir = path.join(process.cwd(), 'test', 'recordings', recordingType)
  const recordingPath = path.join(recordingsDir, `${testName}.har`)
  return fs.existsSync(recordingPath)
}

/**
 * Delete a recording file
 * Useful for forcing a re-record of a specific test
 */
export function deleteRecording(testName: string, recordingType: 'unit' | 'integration' | 'shared' = 'unit'): void {
  const recordingsDir = path.join(process.cwd(), 'test', 'recordings', recordingType)
  const recordingPath = path.join(recordingsDir, `${testName}.har`)

  if (fs.existsSync(recordingPath)) {
    fs.unlinkSync(recordingPath)
    console.log(`Deleted recording: ${recordingPath}`)
  }
}

/**
 * Get all recording files in a directory
 */
export function listRecordings(recordingType: 'unit' | 'integration' | 'shared' = 'unit'): string[] {
  const recordingsDir = path.join(process.cwd(), 'test', 'recordings', recordingType)

  if (!fs.existsSync(recordingsDir)) {
    return []
  }

  return fs
    .readdirSync(recordingsDir)
    .filter(file => file.endsWith('.har'))
    .map(file => path.basename(file, '.har'))
}

/**
 * Pause a Polly instance (temporarily disable recording/replaying)
 */
export function pausePolly(polly: Polly): void {
  polly.pause()
}

/**
 * Resume a Polly instance
 */
export function resumePolly(polly: Polly): void {
  polly.play()
}

/**
 * Wait for Polly to flush all pending recordings to disk
 */
export async function flushPolly(polly: Polly): Promise<void> {
  await polly.flush()
}
