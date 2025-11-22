import { Polly, PollyConfig } from '@pollyjs/core'
import NodeHttpAdapter from '@pollyjs/adapter-node-http'
import FSPersister from '@pollyjs/persister-fs'
import path from 'path'
import { beforeEach, afterEach } from 'vitest'

// Register adapters and persisters
Polly.register(NodeHttpAdapter)
Polly.register(FSPersister)

// Default configuration for Polly
const defaultConfig: PollyConfig = {
  adapters: ['node-http'],
  persister: 'fs',
  persisterOptions: {
    fs: {
      recordingsDir: path.resolve(__dirname, '../../__recordings__'),
    },
  },
  recordIfMissing: true,
  matchRequestsBy: {
    headers: false,
    body: false,
    order: false,
    url: {
      protocol: true,
      username: false,
      password: false,
      hostname: true,
      port: true,
      pathname: true,
      query: true,
      hash: false,
    },
  },
  // Expire recordings after 7 days for freshness
  expiresIn: '7d',
}

/**
 * Create a Polly context for use with Vitest tests.
 *
 * Usage:
 * ```typescript
 * import { setupPollyContext } from '@/lib/test-helpers/polly-setup'
 *
 * describe('My API tests', () => {
 *   const context = setupPollyContext('my-api-tests')
 *
 *   it('makes API calls', async () => {
 *     // API calls are automatically recorded/replayed
 *     const result = await fetch('https://api.example.com/data')
 *   })
 * })
 * ```
 */
export function setupPollyContext(
  recordingName: string,
  config: Partial<PollyConfig> = {}
) {
  const context: { polly: Polly | null } = { polly: null }

  beforeEach(() => {
    context.polly = new Polly(recordingName, {
      ...defaultConfig,
      ...config,
    })
  })

  afterEach(async () => {
    if (context.polly) {
      await context.polly.stop()
      context.polly = null
    }
  })

  return context
}

/**
 * Set Polly to recording mode - makes real API calls and saves responses.
 * Use this when you need to update recordings with fresh data.
 */
export function setPollyRecordMode(polly: Polly) {
  polly.configure({ mode: 'record' })
}

/**
 * Set Polly to replay mode - only uses saved recordings, fails on unknown requests.
 * Use this in CI to ensure tests don't make real API calls.
 */
export function setPollyReplayMode(polly: Polly) {
  polly.configure({ mode: 'replay', recordIfMissing: false })
}

/**
 * Set Polly to passthrough mode - all requests go through without recording.
 * Use this for debugging or when you want to bypass Polly entirely.
 */
export function setPollyPassthroughMode(polly: Polly) {
  polly.configure({ mode: 'passthrough' })
}

/**
 * Helper to configure request matching for specific API patterns.
 * Useful for APIs that include timestamps or other dynamic data in requests.
 */
export function configurePollyForSpotify(polly: Polly) {
  // Filter out authorization headers from matching (they change frequently)
  polly.server.any().on('beforePersist', (req, recording) => {
    // Remove sensitive headers from recordings
    const headersToRemove = ['authorization', 'x-api-key', 'cookie']
    headersToRemove.forEach((header) => {
      if (recording.request.headers) {
        delete recording.request.headers[header]
      }
      if (recording.response.headers) {
        delete recording.response.headers[header]
      }
    })
  })
}
