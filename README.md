# iTunes to Spotify Library Porter

A TypeScript/Next.js application that helps you port your iTunes music library to Spotify by matching local tracks with their Spotify equivalents.

## Features

- **iTunes Library Import**: Parse iTunes library metadata into a SQLite database
- **Smart Spotify Matching**: Search Spotify API with intelligent similarity scoring
- **Interactive Review UI**: Manually review and confirm matches with confidence scores
- **AI-Powered Metadata Fixing**: Automatically clean problematic metadata using LLM
- **Auto-Match Mode**: Batch process songs above a confidence threshold
- **Search Caching**: 30-mins cache reduces API calls and improves performance

## Quick Start

### Prerequisites

- Node.js 22+ (see `.nvmrc`)
- Spotify API credentials ([Get them here](https://developer.spotify.com/dashboard))
- iTunes library JSON export

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/itunes-port-to-spotify.git
cd itunes-port-to-spotify

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Spotify credentials
```

### Environment Variables

Create a `.env.local` file with:

```bash
# Spotify API (required)
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret

# Google OAuth (optional, for authentication)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
AUTH_SECRET=your_nextauth_secret
ALLOWED_EMAIL=your_email@example.com

# AI Metadata Fixer (optional)
GROQ_API_KEY=your_groq_api_key

# Database (local development uses file:./database.db by default)
# TURSO_DATABASE_URL=libsql://your-db.turso.io
# TURSO_AUTH_TOKEN=your_token
```

### Development

```bash
# Run development server
npm run dev

# Run tests
npm test

# Run linter
npm run lint

# Run database migrations
npm run db:migrate
```

Visit `http://localhost:3000/spotify-matcher` to start matching songs.

## Key Concepts

### Database Schema

- Uses **Drizzle ORM** for type-safe database operations
- Local development: SQLite file (`database.db`)
- Production: Turso (cloud SQLite)
- Schema defined in `lib/schema.ts`
- Migrations in `drizzle/migrations/`

### Spotify Integration

- Modern Spotify Web API SDK (`@spotify/web-api-ts-sdk`)
- Client credentials flow for authentication
- Smart search with multiple strategies (artist+track, track-only fallback)
- Similarity scoring based on artist, title, and album matching

### Testing Strategy

- **Unit tests**: Vitest with Polly.js for HTTP recording/replay
- **Integration tests**: Real API interactions recorded for offline testing
- **E2E tests**: Playwright for browser automation
- All tests use committed recordings (no API credentials needed in CI)

### AI Features

- **Metadata fixing**: Groq LLM integration to clean problematic metadata
- Fixes whitespace, featured artists, special characters, typos
- Confidence scoring (high/medium/low)
- In-memory caching to reduce API calls

## Documentation

- **[OAuth Setup](docs/oauth.md)** - Google OAuth configuration
- **[Deployment Guide](docs/deployment.md)** - Vercel deployment and CI/CD
- **[AI Features](docs/ai-features.md)** - AI metadata fixer setup and usage
- **[Testing](docs/testing.md)** - Polly.js setup, recording workflow, test organization
- **[Architecture](docs/architecture.md)** - Core components, database schema, design patterns
- **[Stories & Tech Debt](STORIES.md)** - Planned features and refactoring opportunities

## Development Workflow

This project follows strict **Test-Driven Development** (TDD):

1. Write failing tests first
2. Implement minimal code to pass
3. Refactor while keeping tests green
4. Commit with tests

See `CLAUDE.md` for detailed development guidelines.

## Project Structure

```
app/                    # Next.js pages and components
  spotify-matcher/      # Main UI for matching songs
lib/                    # Core utilities and business logic
  schema.ts             # Database schema (Drizzle ORM)
  spotify.ts            # Spotify API client
  spotify-actions.ts    # Server actions for database operations
  ai-metadata-fixer.ts  # AI metadata fixing
drizzle/                # Database migrations
docs/                   # Documentation
test/                   # Test files
  polly/                # Polly.js setup
  fixtures/             # Test data
  recordings/           # HTTP recordings
```

## Contributing

1. Create a feature branch
2. Follow TDD workflow (tests first!)
3. Run linter: `npm run lint`
4. Run tests: `npm test`
5. Open a pull request

Pull requests automatically get:
- Isolated Turso database branch
- Preview deployment on Vercel
- Full test suite execution

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Database**: SQLite (local), Turso (production), Drizzle ORM
- **API**: Spotify Web API SDK
- **AI**: Groq (LLaMA 3.3)
- **Testing**: Vitest, Playwright, Polly.js
- **Deployment**: Vercel, GitHub Actions
- **Auth**: NextAuth.js with Google OAuth

## License

MIT

## Support

For issues or questions:
- Open an issue on GitHub
- Check documentation in `docs/` folder
- Review `STORIES.md` for known issues and planned improvements
