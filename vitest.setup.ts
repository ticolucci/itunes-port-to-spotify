import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// Register Polly.js adapters for HTTP recording/replaying
import '@pollyjs/adapter-node-http'
import '@pollyjs/adapter-fetch'
import '@pollyjs/persister-fs'

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock Next.js navigation hooks
vi.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
    }
  },
  usePathname() {
    return '/songs'
  },
  useSearchParams() {
    return new URLSearchParams()
  },
}))
