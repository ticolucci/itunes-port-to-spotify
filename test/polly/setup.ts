import { Polly, PollyConfig } from '@pollyjs/core'
import NodeHttpAdapter from '@pollyjs/adapter-node-http'
import FetchAdapter from '@pollyjs/adapter-fetch'
import FSPersister from '@pollyjs/persister-fs'
import path from 'path'

// Register Polly adapters and persisters
Polly.register(NodeHttpAdapter)
Polly.register(FetchAdapter)
Polly.register(FSPersister)

export type PollyMode = 'record' | 'replay' | 'passthrough'

/**
 * Get Polly mode from environment variables
 * - CI: always use 'replay' (no real API calls)
 * - Local: use POLLY_MODE env var or default to 'replay'
 */
export function getPollyMode(): PollyMode {
  if (process.env.CI === 'true') {
    return 'replay'
  }
  const mode = process.env.POLLY_MODE as PollyMode
  return mode || 'replay'
}

/**
 * Setup Polly for unit/integration tests
 *
 * @param testName - Unique name for the test (used for recording file name)
 * @param recordingType - Type of recording (unit, integration, or shared)
 * @param options - Additional Polly configuration options
 * @returns Polly instance
 */
export function setupPolly(
  testName: string,
  recordingType: 'unit' | 'integration' | 'shared' = 'unit',
  options: Partial<PollyConfig> = {}
): Polly {
  const mode = getPollyMode()
  const recordingsDir = path.join(process.cwd(), 'test', 'recordings', recordingType)

  const config: PollyConfig = {
    adapters: ['node-http', 'fetch'], // Use both adapters to intercept all HTTP calls
    persister: 'fs',
    persisterOptions: {
      fs: {
        recordingsDir,
      },
    },
    recordIfMissing: mode === 'record',
    mode,
    matchRequestsBy: {
      // Don't match by headers (Spotify auth tokens change)
      headers: false,
      // Match by request body for POST requests
      body: false, // Don't match by body - Spotify auth is in body
      // Match by URL
      url: {
        protocol: true,
        username: false,
        password: false,
        hostname: true,
        port: true,
        pathname: true,
        query: true, // Match query parameters
        hash: false,
      },
      // Don't care about request order
      order: false,
    },
    recordFailedRequests: true,
    ...options,
  }

  return new Polly(testName, config)
}

/**
 * Configure Polly instance for Spotify API calls
 * - Sanitizes auth tokens from recordings
 * - Configures URL matching for Spotify endpoints
 */
export function configurePollyForSpotify(polly: Polly): void {
  const { server } = polly

  // Intercept Spotify API token requests to sanitize credentials
  server
    .any('https://accounts.spotify.com/api/token')
    .on('beforePersist', (_req, recording) => {
      // Remove sensitive data from request
      if (recording.request.headers) {
        recording.request.headers = recording.request.headers.filter(
          (header: { name: string }) => header.name.toLowerCase() !== 'authorization'
        )
      }
      if (recording.request.postData?.text) {
        recording.request.postData.text = 'REDACTED'
      }
    })

  // Intercept Spotify API search requests to sanitize auth
  server
    .any('https://api.spotify.com/*')
    .on('beforePersist', (_req, recording) => {
      // Remove auth token from headers
      if (recording.request.headers) {
        recording.request.headers = recording.request.headers.map((header: { name: string; value: string }) => {
          if (header.name.toLowerCase() === 'authorization') {
            return { ...header, value: 'Bearer REDACTED' }
          }
          return header
        })
      }
    })
}

/**
 * Polly context for Vitest tests
 * Usage:
 *
 * ```typescript
 * import { beforeEach, afterEach } from 'vitest'
 * import { setupPollyContext } from '@/test/polly/setup'
 *
 * describe('My Test', () => {
 *   const context = setupPollyContext('my-test', beforeEach, afterEach)
 *
 *   it('does something', async () => {
 *     // Polly is active and will record/replay HTTP calls
 *     expect(context.polly).toBeDefined()
 *   })
 * })
 * ```
 */
export function setupPollyContext(
  testName: string,
  beforeEachFn: (fn: () => void | Promise<void>) => void,
  afterEachFn: (fn: () => void | Promise<void>) => void,
  recordingType: 'unit' | 'integration' | 'shared' = 'unit',
  options: Partial<PollyConfig> = {}
) {
  let polly: Polly | null = null

  beforeEachFn(() => {
    polly = setupPolly(testName, recordingType, options)
    configurePollyForSpotify(polly)
  })

  afterEachFn(async () => {
    if (polly) {
      await polly.stop()
      polly = null
    }
  })

  return {
    get polly() {
      return polly
    },
  }
}
