# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript/Next.js project that ports an iTunes music library to Spotify. It parses iTunes library metadata into a SQLite database and uses the Spotify API to search for matching tracks.

## Development Commands

### Dependencies
```bash
# Install dependencies
npm install
```

### Next.js Development
```bash
# Run development server
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

### Linting

This project uses **ESLint** with Next.js and TypeScript configurations.

```bash
# Run linter
npm run lint
```

#### ESLint Configuration

- Config file: `eslint.config.mjs` using flat config format with FlatCompat
- Extends `next/core-web-vitals` and `next/typescript`
- Strict TypeScript rules are set to "warn" to allow incremental fixes

#### Linting Patterns and Solutions

**Test files with mock types:**
- Use file-level disable for `@typescript-eslint/no-explicit-any` in test files
- Add `/* eslint-disable @typescript-eslint/no-explicit-any */` at the top of test files
- Example: `lib/spotify.test.ts`, `app/spotify-matcher/page.test.tsx`
- Do NOT add explanatory comments - the disable is self-documenting

**Empty object return types:**
- DO NOT use `ActionResult<{}>` - it's ambiguous
- Use explicit union types: `Promise<{ success: true } | { success: false; error: string }>`
- Example: `saveSongMatch()` and `clearSongMatch()` in `lib/spotify-actions.ts`

**Config files with CommonJS syntax:**
- Use inline disable for `@typescript-eslint/no-require-imports` in config files
- Add comment directly above the `require()` statement
- Example: `tailwind.config.ts` plugins array

**External images (Spotify CDN):**
- Use inline disable for `@next/next/no-img-element` when displaying external CDN images
- Spotify images are already optimized; Next.js Image component adds no value
- Add comment: `// eslint-disable-next-line @next/next/no-img-element -- Spotify CDN images are already optimized`
- Example: `app/spotify-matcher/ReviewCard.tsx`, `app/spotify-matcher/page.tsx`

**React Hook dependencies:**
- Wrap functions in `useCallback` when they're used as dependencies
- Add `// eslint-disable-next-line react-hooks/exhaustive-deps` if intentionally omitting deps
- Example: `loadNextAlbum` in `app/spotify-matcher/page.tsx`

### Database Migrations

This project uses **Drizzle ORM** for database schema management and migrations.

#### Migration Commands
```bash
# Generate a new migration after changing lib/schema.ts
npm run db:generate

# Apply pending migrations to the database
npm run db:migrate

# Push schema changes directly to DB (dev only, skips migration files)
npm run db:push

# Pull existing database schema into TypeScript
npm run db:pull

# Launch Drizzle Studio (visual database browser)
npm run db:studio
```

#### Migration Workflow

**Making schema changes:**
1. Edit the schema definition in `lib/schema.ts`
2. Run `npm run db:generate` to create a timestamped migration SQL file
3. Review the generated SQL in `drizzle/migrations/`
4. Run `npm run db:migrate` to apply the migration
5. Commit both `lib/schema.ts` and the migration files

**Schema definition:**
- The TypeScript schema is in `lib/schema.ts`
- Drizzle auto-generates TypeScript types from the schema
- Use exported types (`Song`, `NewSong`) in Server Actions and queries

**Migration files:**
- Stored in `drizzle/migrations/` (version controlled)
- Each migration is timestamped and tracked in `__drizzle_migrations` table
- Migrations are idempotent and safe to run multiple times

**For new databases:**
- Run `npm run db:migrate` to create tables and apply all migrations

**For existing databases:**
- If adding migrations to an existing database with tables already created, manually mark migrations as applied:
  ```bash
  sqlite3 database.db "INSERT INTO __drizzle_migrations (hash, created_at) VALUES ('XXXX_migration_name', $(date +%s)000);"
  ```

#### Handling Migration Failures

**Local Development Failures:**
1. **Syntax errors in SQL**: Fix the generated SQL in `drizzle/migrations/` and re-run `npm run db:migrate`
2. **Constraint violations**: Check existing data before migration; clean up or transform data first
3. **Schema conflicts**: If schema is out of sync, use `npm run db:push` (dev only) to force-sync, then regenerate migrations

**Production/CI Failures:**
1. The GitHub Actions workflow will **fail and stop deployment** if migrations fail
2. Check the Actions log for the specific error message
3. Fix the migration and push a new commit - migrations are re-attempted on each deploy
4. If the migration partially applied, see "Rolling Back Migrations" below

**Common Failure Scenarios:**
- **"table already exists"**: Migration was partially applied previously; mark as complete or fix manually
- **"no such column"**: Migration order issue; check migration file timestamps
- **"constraint failed"**: Data doesn't satisfy new constraints; add data transformation step

#### Rolling Back Migrations

**Important:** Drizzle ORM does not have built-in rollback support. Rollbacks must be done manually.

**Strategy 1: Create a Reverse Migration (Recommended)**
1. Generate a new migration that undoes the previous changes:
   ```bash
   # Manually edit lib/schema.ts to reverse the change
   npm run db:generate
   # This creates a new "forward" migration that reverses the effect
   ```
2. Apply the reverse migration: `npm run db:migrate`

**Strategy 2: Manual Database Rollback (Emergency)**
For local development:
```bash
# 1. Create a backup first!
cp database.db database.db.backup

# 2. Connect to SQLite and manually undo changes
sqlite3 database.db

# Example: Drop a newly added column
ALTER TABLE songs DROP COLUMN new_column;

# Example: Remove the migration record so it can be re-run after fixes
DELETE FROM __drizzle_migrations WHERE hash LIKE '%problematic_migration%';

.exit
```

For Turso (production):
```bash
# Use the Turso CLI or SQL console
turso db shell <database-name>

# Run the same SQL commands as above
# Then update the __drizzle_migrations table
```

**Strategy 3: Restore from Backup**
- Turso automatically maintains point-in-time recovery
- Contact Turso support for production database restoration
- For local development, restore from your backup: `cp database.db.backup database.db`

**Rollback Best Practices:**
- Always test migrations on a branch database before merging to main
- Keep migrations small and atomic - easier to rollback individual changes
- Include data migration scripts if changing column types or constraints
- Never delete migration files after they've been applied to production

#### Testing Migrations Before Production

**Level 1: Local Testing (Required)**
```bash
# 1. Backup your local database
cp database.db database.db.backup

# 2. Run migrations locally
npm run db:migrate

# 3. Verify the schema
npm run db:studio  # Visual inspection with Drizzle Studio

# 4. Run the application and test affected features
npm run dev

# 5. Run all tests
npm test
```

**Level 2: PR Preview Testing (Automatic)**
When you open a pull request:
1. GitHub Actions creates an isolated **Turso branch database**
2. The branch database is seeded from production data
3. Migrations run automatically on the branch database
4. A preview deployment uses this branch database
5. You can test the full application with real data

This provides confidence that:
- Migration syntax is valid
- Migration works with production-like data
- Application works correctly after migration

**Level 3: Manual Branch Database Testing**
For complex migrations, manually test against a Turso branch:
```bash
# Create a branch database via Turso CLI or API
# Set environment variables to point to branch
export TURSO_DATABASE_URL="libsql://your-branch-db.turso.io"
export TURSO_AUTH_TOKEN="your-branch-token"

# Run migrations against the branch
npm run db:migrate

# Test the application
npm run dev
```

**Migration Testing Checklist:**
- [ ] Schema changes compile without TypeScript errors
- [ ] `npm run db:generate` creates expected SQL
- [ ] Migration applies successfully on local database
- [ ] Application starts without errors after migration
- [ ] All existing tests pass
- [ ] Affected features work correctly in browser
- [ ] PR preview deployment works with branch database

### Advanced Refactoring with LSMCP

This project uses **LSMCP** (Language Server Model Context Protocol) to provide advanced TypeScript refactoring capabilities through LSP integration.

#### Prerequisites

**Node.js Version:**
- LSMCP requires **Node.js >= 22.0.0** (uses built-in `node:sqlite` module)
- Project has `.nvmrc` file set to Node 22
- If using nvm, it will auto-switch when entering the project directory

**Installed Packages:**
- `@mizchi/lsmcp` - LSP bridge MCP server
- `@typescript/native-preview` - Fast TypeScript runtime (tsgo preset)

#### Configuration

LSMCP is configured in `.mcp.json` (project scope):
```json
{
  "mcpServers": {
    "lsmcp": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@mizchi/lsmcp", "-p", "tsgo"]
    }
  }
}
```

Configuration files:
- `.lsmcp/config.json` - LSMCP settings (preset: tsgo)
- `.lsmcp/cache/` - Symbol index cache (gitignored)

#### Available Refactoring Operations

LSMCP provides access to TypeScript language server refactorings via the `lsp_get_code_actions` tool:

**Extraction Refactorings:**
- Extract Function/Method - Extract selected code into a new function
- Extract Constant - Extract single expressions into constants
- Extract Variable - Extract expressions into local variables
- Extract Type - Extract type definitions

**Inline Refactorings:**
- Inline Variable - Replace variable with its value
- Inline Function/Method - Replace function calls with function body

**Transformation Refactorings:**
- Convert to Arrow Function / Convert to Function Declaration
- Convert Parameters to Destructured Object
- Move to New File
- Generate Get/Set Accessors
- Infer Function Return Type
- Add Missing Imports

#### How Claude Should Use LSMCP

**For advanced refactoring requests:**

1. **Identify refactoring opportunity** - Analyze code to determine appropriate refactoring
2. **Use `lsp_get_code_actions`** - Query available refactorings for the selected code range
3. **Select appropriate action** - Choose the refactoring that matches user's request
4. **Apply refactoring** - Execute the code action to transform the code
5. **Verify changes** - Run tests to ensure no regression

**Example workflow:**
```
User: "Extract this calculation into a separate function"

Claude:
1. Identifies the code range to refactor
2. Calls: lsp_get_code_actions(file, startLine, endLine)
3. Reviews available actions: ["Extract to function", "Extract to constant"]
4. Selects and applies: "Extract to function"
5. Runs: npm test
6. Commits changes
```

#### Other LSMCP Tools Available

**Code Navigation:**
- `lsp_find_references` - Find all usages of a symbol
- `lsp_get_definitions` - Jump to symbol definitions
- `lsp_get_hover` - Get type information and documentation
- `lsp_get_document_symbols` - List all symbols in a file
- `lsp_get_workspace_symbols` - Search symbols across project

**Diagnostics:**
- `lsp_get_diagnostics` - Get errors/warnings for a file
- `lsp_get_all_diagnostics` - Get diagnostics for entire project
- `lsp_get_completion` - Code completion suggestions
- `lsp_get_signature_help` - Function parameter hints

**Code Editing:**
- `lsp_rename_symbol` - Rename across entire codebase
- `lsp_delete_symbol` - Safe symbol deletion with reference cleanup
- `lsp_format_document` - Format code using TypeScript formatter
- `replace_range` - Replace specific text ranges
- `replace_regex` - Regex-based replacements

**Project Analysis:**
- `get_project_overview` - Project structure analysis
- `search_symbols` - Fast symbol search
- `get_symbol_details` - Comprehensive symbol information

#### Symbol Index (Optional)

LSMCP can build a symbol index for faster searches:

```bash
# Ensure Node 22 is active
nvm use 22

# Build index
npx @mizchi/lsmcp index
```

**Note:** The symbol index is optional. LSMCP works without it, just without cached symbol search optimization.

#### Troubleshooting

**LSMCP not appearing in `/mcp`:**
1. Verify Node version: `node --version` (should be v22.21.1+)
2. Check `.mcp.json` exists and is valid
3. Restart Claude Code

**Node version issues:**
- The `.nvmrc` file ensures Node 22 is used in this directory
- Run `nvm use` to manually switch to Node 22

**Performance issues:**
- Build symbol index: `npx @mizchi/lsmcp index`
- Check `.lsmcp/cache/` directory exists

#### When to Use LSMCP vs Manual Refactoring

**Use LSMCP when:**
- Extracting methods/functions from complex code
- Renaming symbols across many files
- Converting function styles (arrow vs declaration)
- Inlining variables/functions
- Moving code to new files
- Need type-safe, compiler-grade refactoring

**Use manual refactoring when:**
- Architectural changes (LSMCP doesn't understand business logic)
- Cross-cutting concerns (logging, error handling)
- Design pattern implementation
- Custom transformations not supported by TypeScript LSP

## Architecture

### Core Components

**Database Schema** (`lib/schema.ts`)
- Drizzle ORM schema definition for the songs table
- Auto-generates TypeScript types (`Song`, `NewSong`) for type-safe queries
- Fields: id, title, artist, album, album_artist, filename, spotify_id
- Database connection managed by `lib/db.ts` singleton using libsql client

**Spotify Integration** (`lib/spotify.ts`)
- Modern Spotify API client using official `@spotify/web-api-ts-sdk`
- `searchSpotifyTracks()` - Searches Spotify tracks by artist, album, and/or track name
- Uses client credentials flow with credentials from `.env.local`
- Server Actions in `lib/spotify-actions.ts`:
  - `getNextUnmatchedSong()` - Fetches first song without spotify_id
  - `getSongsByArtist()` - Gets all songs by artist, sorted by album
  - `searchSpotifyByArtistAlbum()` - Searches Spotify for tracks
  - `saveSongMatch()` - Saves spotify_id for matched song

**SpotifyMatcher Page** (`app/spotify-matcher/page.tsx`)
- Interactive UI for matching iTunes songs with Spotify tracks
- Shows current unmatched song with artist's album tracks
- Displays Spotify search results with similarity scoring
- One-click matching to save spotify_id to database

**Bootstrap Script** (`scripts/bootstrap_songs_table_from_itunes_lib.rb`)
- One-time import script that parses iTunes library JSON export (`ipod_library_with_files.txt`)
- Creates/drops songs table and populates it with metadata
- Expects newline-delimited JSON format where each song object is on separate lines

### Database Schema

**Unified Database Client:**
- Uses `@libsql/client` for all environments (local development, production, CI)
- **Local Development**: Connects to local SQLite file via `file:./database.db` URL
- **Production/CI**: Connects to Turso (cloud SQLite) via HTTPS URL
- Database selection is automatic based on environment variables

**Connection Logic** (`lib/db.ts`):
- If `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set, connects to Turso
- Otherwise, uses local SQLite file via libsql's `file:` protocol
- Singleton pattern ensures one connection per process
- Returns Drizzle ORM instance for type-safe queries

**Schema:**
- Schema defined in `lib/schema.ts`
- Fields: id (primary key), title, album, artist, album_artist, filename, spotify_id
- Index on (artist, album, album_artist)
- Migrations stored in `drizzle/migrations/`

**Environment Variables:**
- `TURSO_DATABASE_URL`: Turso database URL (e.g., `libsql://db-name.turso.io`)
- `TURSO_AUTH_TOKEN`: Turso authentication token
- See `.env.example` for setup instructions

The local database file is encrypted with git-crypt and should not be committed unencrypted.

### Security & Secrets

- **git-crypt** is used to encrypt sensitive files (`database.db`, `.env.local`, `*.key`, `*.pem`)
- See `README_git_crypt.md` for setup instructions
- `.env.local` contains SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET for Spotify API
- Never commit unencrypted secrets

## CI/CD Pipeline

**GitHub Actions Workflow** (`.github/workflows/ci-cd.yml`):

**On every push/PR:**
1. Install dependencies (`npm ci`)
2. Run linter (`npm run lint`) - must pass with 0 errors
3. Run tests (`npm test`) - currently continue-on-error while updating test mocks
4. Build application (`npm run build`) - must succeed

**On push to main branch only:**
5. Run production database migrations on Turso
   - Uses `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` from GitHub secrets
   - Automatically applies pending migrations to production database
6. Deploy to Vercel (only if migrations succeed)
   - Uses Vercel CLI to deploy to production
   - Ensures database is migrated before new code goes live

**On pull requests:**
7. Create or update Turso branch database for the PR via Platform API
   - Branch database named `itunes-spotify-pr-<number>`
   - Seeded from production database (schema + data copy)
   - Provides isolated database for preview testing
8. Run migrations on branch database
9. Deploy preview to Vercel with branch database credentials (7-day tokens)
10. Comment on PR with preview URL and database info
11. Auto-cleanup branch database when PR closes (via API)

**GitHub Secrets Required:**
- `TURSO_DATABASE_URL`: Production database URL
- `TURSO_AUTH_TOKEN`: Production database auth token
- `TURSO_API_TOKEN`: Turso Platform API token for managing branch databases
- `TURSO_ORG_NAME`: Turso organization name
- `TURSO_PRIMARY_DB_NAME`: Name of primary database to branch from
- `VERCEL_TOKEN`: Vercel API token for deployments
- `VERCEL_ORG_ID`: Vercel organization/team ID
- `VERCEL_PROJECT_ID`: Vercel project ID

**Migration Strategy:**
- Local development: Migrations run against local `database.db`
- Production: Migrations auto-run via GitHub Actions on main branch merges
- Migration script (`lib/migrate.ts`) automatically detects environment

## Deployment

**Vercel Deployment:**

This project is configured for deployment on Vercel. See `VERCEL_SETUP.md` for detailed setup instructions.

**Quick Start:**
1. Connect your GitHub repository to Vercel
2. Configure environment variables (SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, TURSO_DATABASE_URL, TURSO_AUTH_TOKEN)
3. Deploy

**Deployment Strategy:**
- **Production (main branch)**: Controlled by GitHub Actions
  - Automatic Vercel deployments are disabled for production
  - GitHub Actions runs migrations first, then deploys to Vercel
  - Ensures database schema is updated before new code goes live
- **Preview (pull requests)**: Controlled by GitHub Actions with Turso database branching
  - Each PR gets an isolated Turso database branch via Platform API
  - Branch database is seeded from production (schema + data copy)
  - Migrations run on branch database before preview deployment
  - Temporary credentials (7-day expiration) generated via API
  - Preview deployment uses branch database credentials
  - Safe testing of schema changes and features without affecting production
  - Branch database automatically deleted via API when PR closes
  - No CLI installation required - all operations use Turso Platform API

**Configuration Files:**
- `vercel.json` - Build and deployment settings
- `.vercelignore` - Excludes local database, tests, and documentation from deployment

**Environment Variables Required in Vercel:**
- `SPOTIFY_CLIENT_ID` - Spotify API credentials
- `SPOTIFY_CLIENT_SECRET` - Spotify API credentials
- `TURSO_DATABASE_URL` - Production database URL
- `TURSO_AUTH_TOKEN` - Production database auth token

## Development Workflow

### Test-Driven Development (TDD) - REQUIRED

**For ALL new features, Claude MUST follow strict TDD:**

1. **Write failing tests first** - Before any implementation code
2. **Run tests to confirm failure** - Verify test is meaningful
3. **Implement minimal code** - Just enough to make test pass
4. **Run tests to confirm pass** - Verify implementation works
5. **Suggest Refactor opportunities** - Improve code while keeping tests green
6. **Commit with tests** - Each feature includes its tests

**Exception:** User explicitly says "skip TDD" or "no tests needed" for specific work.

**Example TDD workflow:**
```bash
# 1. Write test
# 2. Run: npm test -- path/to/test.ts (should FAIL)
# 3. Implement feature
# 4. Run: npm test -- path/to/test.ts (should PASS)
# 5. Run: npm test (all tests should PASS)
# 6. Think about potential refactorings in the code base, given the added code. Suggest to the user if they want to implement any of those.
# 7. Commit with message including test coverage
```

### Refactoring Workflow - REQUIRED

**For ALL refactoring tasks, Claude MUST:**

1. **Analyze current code** - Identify refactoring opportunities
2. **Create refactoring plan** - Document proposed changes
3. **Present plan to user** - Wait for approval before proceeding
4. **Execute incrementally** - One refactoring at a time
   - **Use LSMCP tools** for type-safe refactorings (extract method, inline variable, rename symbols)
   - **Use manual refactoring** for architectural changes and business logic
5. **Test after each change** - Run `npm test` to verify no regression
6. **Commit after each refactoring** - Keep git history clean and logical

**Prefer LSMCP for:**
- Extracting methods/functions (use `lsp_get_code_actions`)
- Renaming symbols across files (use `lsp_rename_symbol`)
- Inlining variables/functions (use `lsp_get_code_actions`)
- Converting function styles (use `lsp_get_code_actions`)
- Finding all references (use `lsp_find_references`)

See "Advanced Refactoring with LSMCP" section for detailed usage instructions.

**Refactoring commit format:**
```
Refactor: <what was extracted/changed>

<Brief description of changes>

Changes:
- <Specific change 1>
- <Specific change 2>

Benefits:
- <Benefit 1>
- <Benefit 2>
```

### Code Organization Principles

**Lessons from app/spotify-matcher/page.tsx refactoring:**

1. **Extract utility functions** - Pure functions go to `lib/` with tests
2. **Extract state management** - Reducers go to `state/` subdirectory with tests
3. **Extract components** - Large JSX blocks (>30 lines) become separate components
4. **Avoid inline objects** - Use factory functions for test fixtures
5. **Single responsibility** - Files should have one clear purpose

**File size targets:**
- Page components: ~400 lines or less
- Utility modules: ~100 lines or less
- Components: ~150 lines or less
- Test files: Unlimited (comprehensive coverage preferred)

**Module structure:**
```
feature/
├── page.tsx                 # Main page (orchestrator)
├── state/
│   ├── reducer.ts          # State management
│   └── reducer.test.ts     # Reducer tests
├── components/
│   ├── ComponentA.tsx      # UI component
│   └── ComponentB.tsx      # UI component
└── hooks/
    ├── useFeature.ts       # Custom hook
    └── useFeature.test.ts  # Hook tests
```

### Test Organization

**Shared test helpers:**
- Location: `lib/test-helpers/`
- Purpose: Eliminate duplicate mock factories
- See: `TEST_REFACTORING_SUGGESTIONS.md` for consolidation plan

**Test file structure:**
```typescript
// 1. Imports
import { describe, it, expect } from 'vitest'
import { functionToTest } from './module'
import { createMockSong } from '@/lib/test-helpers/fixtures'

// 2. Test fixtures (use shared factories when possible)
// Only create local fixtures if truly unique to this test

// 3. Test suites
describe('Feature', () => {
  describe('specific behavior', () => {
    it('does something specific', () => {
      // Arrange
      const input = createMockSong({ title: 'Test' })

      // Act
      const result = functionToTest(input)

      // Assert
      expect(result).toBe(expected)
    })
  })
})
```

**Test factory guidelines:**
- Use shared factories from `lib/test-helpers/fixtures.ts`
- Only create inline objects when testing edge cases
- Override defaults using spread operator: `createMockSong({ title: 'Custom' })`
- See `TEST_REFACTORING_SUGGESTIONS.md` for detailed patterns

### Git Commit Strategy

**Incremental commits preferred:**
- One logical change per commit
- Tests should pass after each commit
- Clear, descriptive commit messages
- Include emoji when using Claude Code: 🤖

**Commit message format:**
```
<Type>: <Short description>

<Detailed description of changes>

<List of specific changes>
- Change 1
- Change 2

<Benefits or context>
- Benefit 1
- Benefit 2

All <N> tests passing

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Commit types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `refactor:` - Code restructuring (no behavior change)
- `test:` - Adding or updating tests
- `docs:` - Documentation changes
- `chore:` - Build/tooling changes

### Example Session Patterns

**Adding a new feature (TDD):**
```
1. User: "Add function to calculate match confidence"
2. Claude: "I'll use TDD. First, writing tests..."
3. Claude: Creates test file with failing tests
4. Claude: Runs tests (shows failures)
5. Claude: Implements function
6. Claude: Runs tests (shows passes)
7. Claude: Think about refactoring opportunities
8. Claude: Present the plan and ask for input
9. Claude: Commits with test coverage note
```

**Refactoring existing code:**
```
1. User: "Refactor the matcher page"
2. Claude: "I'll analyze and create a refactoring plan..."
3. Claude: Presents 5 refactoring opportunities
4. User: "Approve all"
5. Claude: Executes one at a time, testing after each
6. Claude: Commits after each successful refactoring
7. Claude: Provides summary of all changes
```

**When NOT to follow these patterns:**
- User explicitly requests different workflow
- Emergency hotfixes (but add tests after)
- Experimental/prototype code (but document as such)

## Future Work

See `Stories.md` for planned features and current priorities, including:
- Spotify query escaping for special characters
- OAuth flow for user library mutations (add matched songs to Spotify playlists)
- Rate limiting and retry logic
- Token expiration handling
- Search and delete functionality in songs browser UI
