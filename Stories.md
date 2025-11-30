# Stories, Tech Debt & Refactoring Opportunities

This document tracks planned features, known issues, technical debt, and refactoring opportunities for the project.

## Table of Contents

1. [Active Feature Stories](#active-feature-stories)
2. [Critical Bugs](#critical-bugs)
3. [Moderate Bugs](#moderate-bugs)
4. [Tech Debt & Refactoring](#tech-debt--refactoring)
5. [Performance Improvements](#performance-improvements)
6. [Security Enhancements](#security-enhancements)
7. [Testing Improvements](#testing-improvements)
8. [Feature Ideas](#feature-ideas)
9. [Completed Stories](#completed-stories)

---

## Active Feature Stories

### 6. Add Per-User OAuth Flow and Library Mutation

**Description**: Implement OAuth flow to add tracks directly to a user's Spotify library or create playlists on their behalf.

**Acceptance Criteria**:
- `SpotifyClient` supports exchanging authorization code for user token
- Helper method to save a track to user library given a track URI
- Documentation for obtaining client credentials and redirect setup

**Priority**: High
**Size**: Large

---

### 7. Change ID Storage to `spotify_uri`

**Description**: Update database schema to store full Spotify URI instead of just ID.

**Acceptance Criteria**:
- DB schema updated to store `spotify_uri` for songs
- Do not preserve `spotify_id` (migration drops old column, creates new without backfill)
- All code references updated to use `spotify_uri`

**Priority**: Medium
**Size**: Medium

---

### 8. Create Playlist from Liked Tracks

**Description**: Build helper to assemble selected/liked tracks into a Spotify playlist and optionally add to user's account via OAuth.

**Acceptance Criteria**:
- Playlist creation API wrapper implemented
- Works with test mocks and manual run with real tokens
- Integration with user OAuth flow (depends on Story #6)

**Priority**: Medium
**Size**: Medium
**Dependencies**: Story #6

---

### 9. Rate Limiting, Retry, and Caching

**Description**: Add request retry logic for transient failures and caching for repeated searches.

**Acceptance Criteria**:
- Configurable retry/backoff for HTTP calls
- Cache used for repeated identical queries (✅ implemented for Spotify search)
- Tests cover retry/backoff logic

**Status**: Partially complete (search caching done)
**Remaining work**: Retry logic with exponential backoff
**Priority**: High
**Size**: Medium

---

### 13. UX Improvements: Better Search Scoring and Fuzzy Matching

**Description**: Experiment with multiple query permutations, normalize tokens, and pick best match using heuristics.

**Acceptance Criteria**:
- Plugin point to run alternate queries and score results
- Tests demonstrate improved scoring for ambiguous titles
- Levenshtein distance or similar fuzzy matching

**Priority**: Medium
**Size**: Large

---

### 14. Handle Auth Token Expiration

**Description**: Transparently refresh expired Spotify access tokens (both app-level client_credentials and per-user OAuth tokens).

**Acceptance Criteria**:
- `SpotifyClient` detects token expiration (response codes or expires_at)
- Requests that fail due to expired token are retried once after refresh
- Unit tests cover token refresh flow with mocked responses
- No infinite retry loops

**Priority**: High
**Size**: Medium

---

## Critical Bugs

### A. Spotify Query Special Characters Not Escaped

**File**: `lib/spotify.ts:35-45`

**Issue**: Spotify search query built with raw user input without escaping special characters. Songs with titles like `My "Love" Song` or artists like `AC/DC` could fail.

**Impact**: Users with special characters in metadata get failed searches without fallback.

**Suggested Fix**: Create `escapeSpotifyQuery()` utility:
- Escape special characters (quotes, colons, hyphens, wildcards)
- Normalize Unicode
- Handle edge cases like empty strings after escaping

**Priority**: High
**Size**: Small

---

## Moderate Bugs

### A. Cache Expiration Query Bug

**File**: `lib/spotify-cache.ts:127`

**Issue**: `clearExpiredCache()` uses `eq()` instead of `lt()` - only deletes entries created at exact timestamp.

**Fix**:
```typescript
import { lt } from 'drizzle-orm'
where(lt(spotifySearchCache.created_at, expiredBefore))
```

**Priority**: Medium
**Size**: Small

---

### B. Incomplete Metadata Checking Inconsistency

**Files**: `lib/song-matcher-utils.ts:23-25`, `lib/spotify-actions.ts:113-115`

**Issue**: Two different checks for incomplete metadata - could skip songs inconsistently.

**Fix**: Create single source of truth:
```typescript
// lib/validation.ts
export function isValidForMatching(song: Song): boolean {
  return !!song.title?.trim() && !!song.artist?.trim()
}
```

**Priority**: Medium
**Size**: Small

---

### C. Race Condition in Auto-Match

**File**: `app/spotify-matcher/page.tsx:140-187`

**Issue**: `autoMatchInProgress` is a `useRef`, but `autoMatchEnabled` dependency means effect runs on toggle. Rapid toggling could start multiple processes.

**Fix**: Convert `autoMatchInProgress` from `useRef` to `useState`, or use state machine pattern.

**Priority**: Medium
**Size**: Small

---

### D. UI Alert Instead of Toast Notifications

**Files**: Multiple (`page.tsx:292, 338, 356`)

**Issue**: Using `alert()` blocks UI and provides poor UX.

**Fix**: Implement toast notification system:
- Use Shadcn UI toast component (already using Shadcn)
- Or lightweight alternative like react-hot-toast/sonner

**Priority**: Low
**Size**: Small

---

## Tech Debt & Refactoring

### A. Extract Song Mapping Logic (DRY Violation)

**File**: `lib/spotify-actions.ts` - appears 5+ times

**Issue**: Repeated pattern mapping database rows to Song objects.

**Refactoring**:
```typescript
// lib/mappers.ts
export function mapRowToSong(row: SongRow): Song {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    album_artist: row.album_artist,
    filename: row.filename,
    spotify_id: row.spotify_id,
  }
}
```

**Priority**: Low
**Size**: Small
**Benefit**: Reduces duplication, easier to maintain

---

### B. Consolidate Similarity Calculation

**Files**: `lib/spotify-actions.ts:308-331`, `app/spotify-matcher/page.tsx:202-217`

**Issue**: Similarity calculated in two places independently.

**Fix**: Unify into single utility function in `lib/enhanced-similarity.ts`.

**Priority**: Low
**Size**: Small

---

### C. Extract Search Strategy Logic

**File**: `lib/spotify-actions.ts:339-388`

**Issue**: Complex fallback logic embedded in action. Consider SearchStrategy pattern.

**Benefits**:
- More testable
- Easier to extend with new strategies
- Configurable per user

**Priority**: Low
**Size**: Medium

---

### D. Page Component Too Large

**File**: `app/spotify-matcher/page.tsx` - 512 lines

**Target**: <400 lines per CLAUDE.md guidelines

**Opportunities to extract**:
- Debug panel → separate component
- Auto-match logic → custom hook (`useAutoMatch()`)
- Search logic → custom hook (`useSpotifySearch()`)

**Priority**: Low
**Size**: Medium

---

### E. Type Duplication

**Files**: `lib/song-matcher-utils.ts`, `ReviewCard.tsx`

**Issue**: Both define `SongWithMatch` type.

**Fix**: Create shared types file (`lib/types.ts`).

**Priority**: Low
**Size**: Small

---

## Performance Improvements

### A. N+1 Query Pattern in Auto-Match

**File**: `app/spotify-matcher/page.tsx:85-89`

**Issue**: Each song triggers separate Spotify API call. For 100 songs = 100 API calls.

**Fix**: Implement batching:
```typescript
async function batchSearch(songs: Song[], batchSize = 5) {
  const batches = chunk(songs, batchSize)
  for (const batch of batches) {
    await Promise.all(batch.map(searchForMatch))
    await delay(100) // Rate limiting
  }
}
```

**Priority**: High
**Size**: Medium

---

### B. Cache TTL Too Long

**File**: `lib/spotify-cache.ts:10`

**Issue**: 30-day TTL may be too long - Spotify updates tracks frequently.

**Fix**: Consider 7 days as default with configuration option.

**Priority**: Low
**Size**: Small

---

### C. Inefficient Pagination

**File**: `lib/actions.ts:7-52`

**Issue**: Uses LIMIT/OFFSET which becomes slow on large tables.

**Fix**: Migrate to cursor-based pagination using id field.

**Priority**: Medium
**Size**: Medium
**Note**: Already implemented in Ruby version, needs TypeScript migration.

---

### D. In-Memory AI Cache

**File**: `lib/ai-metadata-fixer.ts:25-26`

**Issue**: In-memory Map can cause memory leaks in serverless environments.

**Fix**: Migrate to persistent cache:
- Database table with TTL
- Redis cache
- Or accept and document limitation

**Priority**: Low
**Size**: Medium

---

### E. Large Discographies Loaded into Memory

**File**: `app/spotify-matcher/page.tsx:78`

**Issue**: For large libraries (10k+ songs), loading entire artist discography into state may cause performance issues.

**Fix**: Implement virtual scrolling or server-side pagination.

**Priority**: Low
**Size**: Medium

---

## Security Enhancements

### A. E2E Test Auth Bypass

**File**: `middleware.ts:5-11`

**Issue**: `VERCEL_AUTOMATION_BYPASS_SECRET` bypasses auth if secret is exposed.

**Mitigation**:
- Ensure secret only set in test environments
- Add NODE_ENV checks
- Use strong random secret
- Document risk

**Priority**: Medium
**Size**: Small

---

### B. Single Email Whitelist

**File**: `auth.ts`

**Issue**: Only one email can access app.

**Enhancement**: Support multiple users:
- Comma-separated email list
- Domain wildcards (`@company.com`)
- Role-based access

**Priority**: Low
**Size**: Medium

---

### C. No Rate Limiting on Server Actions

**Issue**: No rate limiting could lead to:
- Spotify API quota exceeded
- Database overflow
- DoS via AI metadata fix calls

**Fix**: Implement rate limiting middleware (upstash/ratelimit).

**Priority**: Medium
**Size**: Medium

---

### D. No Input Validation on Search Parameters

**File**: `lib/spotify.ts:25-45`

**Issue**: While parameters are trimmed, no length validation. Very long strings could exceed API limits.

**Fix**: Add max length validation (e.g., 200 chars per field).

**Priority**: Low
**Size**: Small

---

## Testing Improvements

### Current Strengths

- ✅ 13 test files
- ✅ Good unit test coverage
- ✅ Server action tests with mocked database
- ✅ Component tests
- ✅ Polly.js for HTTP recording

### Gaps

**A. No E2E Tests for Complete Matching Flow**

Add end-to-end tests covering:
- Load song
- Search Spotify
- Apply AI fix
- Save match
- Verify in database

**Priority**: Medium
**Size**: Large

---

**B. No Tests for Error Scenarios**

Add tests for:
- Network failures
- API errors (429, 500, timeout)
- Invalid responses
- Database connection failures

**Priority**: Medium
**Size**: Medium

---

**C. No Tests for Race Conditions**

Add tests for:
- Auto-match rapid enable/disable
- Concurrent save operations
- Cache invalidation races

**Priority**: Low
**Size**: Medium

---

**D. Limited Reducer Edge Cases**

Add tests for:
- Invalid action types
- State corruption recovery
- Concurrent actions

**Priority**: Low
**Size**: Small

---

**E. No Performance Tests**

Add benchmarks for:
- Large dataset operations (10k+ songs)
- Batch search performance
- Cache hit rates
- Database query performance

**Priority**: Low
**Size**: Large

---

## Feature Ideas

### A. Batch Matching Mode

Allow users to:
- Select multiple songs to match at once
- Set auto-match threshold globally
- Preview all matches before applying
- Bulk confirm/reject

**Priority**: Medium
**Size**: Large

---

### B. Undo/History

Keep history of matches and allow batch undo:
- "Undo last 10 matches"
- Revert to previous auto-match threshold
- See what changed and when
- Export match history

**Priority**: Low
**Size**: Large

---

### C. Duplicate Detection

Before matching, detect:
- Duplicate songs in local library
- Multiple versions of same track
- Allow merging or deduplication

**Priority**: Low
**Size**: Medium

---

### D. Smart Search Fallback

Enhanced fallback strategies:
1. Try without special characters
2. Try without featured artists
3. Try album-only search
4. Use AI to suggest corrections
5. Try different word orders

**Priority**: Medium
**Size**: Medium

---

### E. Playlist Export

After matching, allow users to:
- Create Spotify playlists from matched songs
- Export matched songs with metadata (CSV/JSON)
- Integration with Spotify OAuth (requires Story #6)

**Priority**: Medium
**Size**: Large
**Dependencies**: Story #6

---

### F. Metadata Quality Scoring

Show users:
- Quality score for metadata (0-100%)
- Suggestions to improve scores
- Batch fix recommendations
- Before/after comparison

**Priority**: Low
**Size**: Medium

---

### G. Statistics Dashboard

Display:
- Matching success rate
- Time spent matching
- Most problematic artists/genres
- Cache hit rates
- API usage metrics

**Priority**: Low
**Size**: Large

---

### H. Search Preview

Before saving a match, show:
- Full Spotify album details
- Other songs by artist
- Release date comparison
- Album art comparison
- Audio preview (30s clip)

**Priority**: Low
**Size**: Medium

---

## Completed Stories

### ✅ Replace LIMIT/OFFSET with ID-Cursor Batch Scan

**Description**: Improved batch scanning to use id-cursor instead of LIMIT/OFFSET.

**Result**: More efficient and stable large-table scans.

---

### ✅ Add Acceptance Tests for SpotifyClient with Mocked HTTP

**Description**: Avoid live network calls in tests using Polly.js.

**Result**: All specs run offline and deterministic.

---

### ✅ Spotify Search Caching

**Description**: Add database-backed cache with 30-day TTL for Spotify search results.

**Result**: Reduced API calls, faster search, better performance.

---

### ✅ Skip Non-Reviewable Songs

**Description**: Auto-skip songs without required metadata in matcher UI.

**Result**: Better UX, fewer manual skips.

---

### ✅ Update UI After AI Fix

**Description**: Automatically update UI when AI metadata fix is applied.

**Result**: Seamless UX, no manual refresh needed.

---

### ✅ Spotify Search Artist Fallback

**Description**: Two-phase search (artist+track, then track-only) with 50% similarity threshold.

**Result**: Better match rates for difficult songs.

---

## Priority Recommendations

### Phase 1: Critical Fixes (Do First)

1. **Spotify special character escaping** - Blocks real usage
2. **Cache expiration bug** - Data consistency issue
3. **Auto-match race condition** - Data integrity risk

**Estimated effort**: 1-2 days

---

### Phase 2: Performance (High Impact)

1. Batch Spotify API calls (fix N+1)
2. Migrate to cursor-based pagination
3. Switch AI cache to database

**Estimated effort**: 3-5 days

---

### Phase 3: Refactoring (Quality)

1. Extract song mapping logic (DRY)
2. Reduce page.tsx to <400 lines
3. Consolidate similarity calculations
4. Create shared types file

**Estimated effort**: 2-3 days

---

### Phase 4: Security & Testing (Stability)

1. Add rate limiting
2. Improve error handling patterns
3. Add integration tests for error scenarios
4. Document security considerations

**Estimated effort**: 3-4 days

---

### Phase 5: Features (User Value)

1. Implement from Active Feature Stories
2. Add batch matching mode
3. Add undo/history functionality
4. Create statistics dashboard

**Estimated effort**: 2-4 weeks

---

## Summary Statistics

| Category | Count | Effort |
|----------|-------|--------|
| **Active Feature Stories** | 5 | Large |
| **Critical Bugs** | 1 | Small |
| **Moderate Bugs** | 4 | Small-Medium |
| **Tech Debt** | 5 | Small-Medium |
| **Performance Issues** | 5 | Medium-Large |
| **Security Concerns** | 4 | Small-Medium |
| **Testing Gaps** | 5 | Medium-Large |
| **Feature Ideas** | 8 | Medium-Large |
| **Completed** | 6 | - |

---

*Last updated: 2025-11-30*
*Generated from SUGGESTIONS.md and Stories.md consolidation*
