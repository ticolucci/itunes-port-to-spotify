# AI-Assisted Metadata Fixing with Groq

This feature uses Groq's LLM API to automatically fix problematic metadata in your iTunes library that prevents Spotify matching.

## Setup

1. **Get a Groq API key** (free tier: 30 requests/minute)
   - Visit https://console.groq.com
   - Create an account and generate an API key

2. **Add to your `.env.local` file:**
   ```bash
   GROQ_API_KEY=your_groq_api_key_here
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

## Features

### What It Fixes

The AI automatically detects and fixes common metadata issues:

1. **Extra whitespace**: `"The Beatles "` → `"The Beatles"`
2. **Featured artists**: `"Daft Punk feat. Pharrell"` → `"Daft Punk"`
3. **Special characters**: `"Beyoncé"` → Normalized for better matching
4. **Typos and inconsistent formatting**
5. **Live/remix indicators**: Repositioned for better matching

### How It Works

1. **In the Spotify Matcher UI** (`/spotify-matcher`):
   - For songs with incomplete metadata or no Spotify match
   - Click the "AI Fix" button
   - The AI analyzes the metadata and suggests corrections
   - Review the suggestion with confidence level (high/medium/low)
   - Click "Apply Fix" to update the metadata

2. **Confidence Levels**:
   - **High**: Simple cleanup (whitespace, obvious typos)
   - **Medium**: Character normalization, featured artist extraction
   - **Low**: Ambiguous cases requiring human review

3. **Alternative Search Queries**:
   - The AI suggests 1-3 alternative queries to try on Spotify
   - These include variations like featured artists, different word orders

## Architecture

### Core Components

**`lib/ai-metadata-fixer.ts`**
- Main AI integration using Groq SDK
- Uses `llama-3.3-70b-versatile` model (fast and high quality)
- In-memory caching to avoid duplicate API calls
- Zod schema validation for type-safe responses
- JSON mode for structured outputs
- Comprehensive error handling with graceful degradation

**`lib/spotify-actions.ts`** (new actions)
- `getAISuggestionForSong(songId)` - Fetches AI suggestion for a song
- `applyAIFixToSong(songId, fix)` - Applies the suggested metadata fixes

**`app/spotify-matcher/AISuggestion.tsx`**
- Interactive UI component for AI suggestions
- Shows suggested changes with diff view
- Confidence indicators
- One-click application

### Best Practices Implemented

1. **Structured Outputs with Zod**
   - Schema-driven API responses
   - Runtime validation
   - Type safety throughout

2. **Caching**
   - In-memory cache for identical songs
   - Reduces API calls and costs
   - Cache hit logging for debugging

3. **Error Handling**
   - Graceful degradation (returns null on errors)
   - Comprehensive error logging
   - Different error types handled separately

4. **Rate Limiting**
   - Uses Groq's generous 30 req/min limit
   - Easy to add request queuing if needed

5. **Testing**
   - Mocked Groq API (no real API calls in tests)
   - In-memory database for server action tests
   - 26 passing tests with 100% coverage of new code

## Usage Example

```typescript
import { fixMetadataWithAI } from '@/lib/ai-metadata-fixer'

const song = {
  id: 1,
  title: ' Hey Jude  ',
  artist: 'The Beatles ',
  album: '  Past Masters ',
  // ...
}

const suggestion = await fixMetadataWithAI(song)

if (suggestion) {
  console.log(suggestion.suggestedArtist) // "The Beatles"
  console.log(suggestion.suggestedTrack)  // "Hey Jude"
  console.log(suggestion.confidence)      // "high"
  console.log(suggestion.reasoning)       // "Removed extra whitespace"
}
```

## API Costs

With Groq's free tier:
- **30 requests/minute**
- **14,400 requests/day**
- **~432,000 requests/month**

For a library of 10,000 songs:
- Without caching: ~333 minutes (~5.5 hours)
- With caching: Much faster for duplicate metadata

## Advanced: Customizing the System Prompt

To modify what the AI fixes, edit the `SYSTEM_PROMPT` in `lib/ai-metadata-fixer.ts`:

```typescript
const SYSTEM_PROMPT = `You are a music metadata expert...

Common issues to fix:
1. Extra whitespace
2. Featured artists
// Add your custom rules here
`
```

## Testing

Run the tests:
```bash
# All tests
npm test

# Just AI tests
npm test -- lib/ai-metadata-fixer.test.ts

# With coverage
npm run test:coverage
```

## Troubleshooting

**"AI service is unavailable"**
- Check that `GROQ_API_KEY` is set in `.env.local`
- Verify the API key is valid
- Check Groq's status page for outages

**Poor suggestions**
- Review the `SYSTEM_PROMPT` and examples
- Adjust temperature in `fixMetadataWithAI()` (currently 0.3)
- Try different Groq models

**Rate limits**
- The free tier allows 30 req/min
- Caching helps reduce API calls
- Consider upgrading to paid tier for larger libraries
