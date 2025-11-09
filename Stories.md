# Project Stories — itunes-port-to-spotify

This file collects short, actionable user stories and technical tasks for the project. Each story includes a brief description, acceptance criteria, and a suggested priority/size so we can pick the next work in small increments.

---


## 6) Add per-user OAuth flow and library mutation
- Description: Implement OAuth flow to add tracks directly to a user's Spotify library or create playlists on their behalf.
- Acceptance criteria:
  - `SpotifyClient` supports exchanging authorization code for user token.
  - Helper method to save a track to a user library given a track URI.
  - Documentation for obtaining client credentials and redirect setup.

## 7) Change id storage to `spotify_uri`
- Acceptance criteria:
  - DB schema updated to store `spotify_uri` for songs, do not preserve `spotify_id` (migration to drop column & create new column without backfil).

## 8) Create playlist from liked tracks
- Description: Build a helper to assemble selected/liked tracks into a Spotify playlist and optionally add them to a user's account via OAuth.
- Acceptance criteria:
  - Playlist creation API wrapper implemented.
  - Works with test mocks and manual run with real tokens.

## 9) Rate-limit handling, retry, and caching
- Description: Add request retry logic for transient failures and a simple cache (in-memory or file) for repeated searches to avoid hitting rate limits while iterating the library.
- Acceptance criteria:
  - Configurable retry/backoff for HTTP calls.
  - Cache used for repeated identical queries in a run.
  - Tests cover retry/backoff logic.

## 10) History cleanup & git-crypt hygiene
- Description: If secrets were accidentally committed, provide a documented workflow (BFG or git-filter-repo) and ensure `.secrets` is git-ignored; confirm `.gitattributes` covers sensitive files.
- Acceptance criteria:
  - `README_git_crypt.md` updated with recommended cleanup steps.
  - `.gitignore` contains `.secrets` and any private-export files.

## 13) UX improvements: better search scoring and fuzzy matching
- Description: Experiment with multiple query permutations, normalize tokens, and pick the best match using heuristics (Levenshtein, normalized artist/title match).
- Acceptance criteria:
  - A plugin point to run alternate queries and score results.
  - Tests demonstrate improved scoring for ambiguous titles.

## 14) Handle auth token expiration
- Description: Transparently refresh expired Spotify access tokens (both app-level client_credentials tokens and per-user OAuth tokens). Ensure requests automatically retry with a new token when necessary.
- Acceptance criteria:
  - `SpotifyClient` detects token expiration (based on response codes or expires_at) and can refresh tokens using stored credentials or refresh tokens.
  - Requests that fail due to expired token are retried once after refresh and succeed when possible.
  - Unit tests cover token refresh flow using mocked HTTP responses and ensure no infinite retry loops.

---

## Done

- ## Replace LIMIT/OFFSET with id-cursor batch scan
- Description: Improved `SongRecord.process_in_db_batches` to use an id-cursor (WHERE id > last_id LIMIT batch) instead of LIMIT/OFFSET to make large-table scans more efficient and stable.
- Acceptance criteria:
  - Method iterates all rows in ascending id order without skipping or repeating when the table grows concurrently.
  - Tests simulate large sets using in-memory DB and still pass.dium

- ## Add acceptance tests for `SpotifyClient` with mocked HTTP
- Description: Avoid live network calls in tests by stubbing `HTTParty` or using WebMock; assert request parameters and simulate responses.
- Acceptance criteria:
  - All specs run offline and deterministic.
  - Coverage added for token fetch and search query formation.