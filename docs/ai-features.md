# AI-Assisted Metadata Fixing

This feature uses Groq's LLM API to automatically fix problematic metadata in your iTunes library that prevents Spotify matching.

## Overview

The AI metadata fixer analyzes song metadata and suggests corrections for common issues that prevent successful Spotify matches. It uses the LLaMA 3.3 70B model for fast, high-quality results.

## Setup

### 1. Get a Groq API Key

Groq offers a generous free tier with 30 requests/minute.

1. Visit https://console.groq.com
2. Create an account
3. Generate an API key

### 2. Configure Environment Variable

Add to your `.env.local` file:

```bash
GROQ_API_KEY=your_groq_api_key_here
```

### 3. Start Development Server

```bash
npm run dev
```

The AI features will be automatically available in the Spotify Matcher UI.

## Features

### What It Fixes

The AI automatically detects and fixes:

1. **Extra whitespace**: `"The Beatles "` → `"The Beatles"`
2. **Featured artists**: `"Daft Punk feat. Pharrell"` → `"Daft Punk"`
3. **Special characters**: Normalizes Unicode for better matching
4. **Typos and inconsistent formatting**
5. **Live/remix indicators**: Repositions for better search results

### How to Use

1. Navigate to **Spotify Matcher UI** (`/spotify-matcher`)
2. For songs with incomplete metadata or no Spotify match:
   - Click the **"AI Fix"** button
3. Review the AI suggestion:
   - View suggested changes with diff highlighting
   - Check confidence level (high/medium/low)
   - Read the reasoning for changes
4. Click **"Apply Fix"** to update the metadata
5. The UI automatically re-searches Spotify with corrected metadata

### Confidence Levels

- **High**: Simple cleanup (whitespace, obvious typos) - safe to apply automatically
- **Medium**: Character normalization, featured artist extraction - review recommended
- **Low**: Ambiguous cases - human review required

### Alternative Search Queries

The AI suggests 1-3 alternative queries to try on Spotify, including:
- Variations with/without featured artists
- Different word orders
- Alternative spellings

## Architecture

### Core Components

**`lib/ai-metadata-fixer.ts`**
- Main AI integration using Groq SDK
- Uses `llama-3.3-70b-versatile` model
- In-memory caching to avoid duplicate API calls
- Zod schema validation for type-safe responses
- JSON mode for structured outputs
- Comprehensive error handling with graceful degradation

**`lib/spotify-actions.ts`** (Server Actions)
- `getAISuggestionForSong(songId)` - Fetches AI suggestion
- `applyAIFixToSong(songId, fix)` - Applies suggested fixes

**`app/spotify-matcher/AISuggestion.tsx`** (UI Component)
- Interactive suggestion display
- Diff view for changes
- Confidence indicators
- One-click application

### Response Schema

The AI returns structured JSON validated by Zod:

```typescript
{
  suggestedArtist: string
  suggestedTrack: string
  suggestedAlbum: string | null
  confidence: "high" | "medium" | "low"
  reasoning: string
  alternativeQueries: string[]
}
```

### Caching Strategy

In-memory cache (Map) stores AI suggestions by song ID:
- Avoids duplicate API calls for same song
- Reduces costs and latency
- Resets on server restart
- Cache hit logging for debugging

**Future enhancement**: Migrate to persistent cache (Redis, database table)

## Best Practices

### 1. Structured Outputs with Zod

Schema-driven API responses ensure:
- Runtime validation
- Type safety throughout the app
- Consistent data format

### 2. Error Handling

Graceful degradation:
- Returns `null` on errors (doesn't break UI)
- Comprehensive error logging
- Different error types handled separately

### 3. Rate Limiting

Groq free tier: 30 requests/minute
- Sufficient for interactive usage
- Easy to add request queuing if needed
- Caching helps reduce API calls

### 4. Testing

- Mocked Groq API (no real API calls in tests)
- In-memory database for server action tests
- 26 passing tests with 100% coverage

## API Usage and Costs

### Groq Free Tier

- **30 requests/minute**
- **14,400 requests/day**
- **~432,000 requests/month**

### Estimated Processing Time

For a library of 10,000 songs:
- Without caching: ~333 minutes (~5.5 hours)
- With caching: Much faster for duplicate metadata

### Cost Optimization

1. **Use caching**: Avoid repeat requests for same metadata
2. **Batch processing**: Process multiple songs when user is idle
3. **Selective fixing**: Only suggest fixes for low-confidence matches

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
  console.log(suggestion.alternativeQueries) // ["Hey Jude Beatles", ...]
}
```

## Customization

### Modify System Prompt

Edit `SYSTEM_PROMPT` in `lib/ai-metadata-fixer.ts` to customize behavior:

```typescript
const SYSTEM_PROMPT = `You are a music metadata expert...

Common issues to fix:
1. Extra whitespace
2. Featured artists
3. Special characters
4. [Add your custom rules here]
`
```

### Adjust Temperature

Change the temperature parameter in `fixMetadataWithAI()`:

```typescript
const completion = await groq.chat.completions.create({
  // ...
  temperature: 0.3  // Lower = more deterministic
})
```

### Try Different Models

Groq offers multiple models:
- `llama-3.3-70b-versatile` (current, best quality)
- `llama-3.1-8b-instant` (faster, lower quality)
- `mixtral-8x7b-32768` (larger context window)

## Testing

### Run Tests

```bash
# All tests
npm test

# Just AI tests
npm test -- lib/ai-metadata-fixer.test.ts

# With coverage
npm run test:coverage
```

### Test Coverage

- ✅ Successful metadata fixing
- ✅ API error handling
- ✅ Cache hits and misses
- ✅ Invalid response format
- ✅ Server action integration
- ✅ Missing GROQ_API_KEY handling

## Troubleshooting

### "AI service is unavailable"

**Causes:**
- `GROQ_API_KEY` not set in `.env.local`
- Invalid API key
- Groq service outage

**Solutions:**
- Verify API key in `.env.local`
- Test API key at https://console.groq.com
- Check [Groq status page](https://status.groq.com/)

### Poor Suggestions

**Causes:**
- System prompt needs refinement
- Temperature too high
- Model not suitable for task

**Solutions:**
- Review and adjust `SYSTEM_PROMPT`
- Lower temperature (currently 0.3)
- Try different Groq models

### Rate Limits

**Causes:**
- Exceeded 30 requests/minute
- Too many users on free tier

**Solutions:**
- Implement request queuing
- Use caching more aggressively
- Upgrade to Groq paid tier

### Cache Not Working

**Causes:**
- Server restarts clear in-memory cache
- Different song IDs for same metadata

**Solutions:**
- Migrate to persistent cache (Redis/database)
- Use content-based cache keys instead of song ID

## Future Enhancements

### 1. Persistent Caching

Migrate from in-memory Map to:
- Database table with TTL
- Redis cache
- IndexedDB for client-side caching

### 2. Batch Processing

Process multiple songs in single request:
- More efficient API usage
- Faster bulk operations
- Lower latency

### 3. Confidence Threshold Configuration

Allow users to set auto-apply threshold:
- High confidence → auto-apply
- Medium → suggest
- Low → skip

### 4. Learning from User Edits

Track which suggestions users accept/reject:
- Improve system prompt over time
- Fine-tune model on user preferences
- Better confidence scoring

## Related Documentation

- [Architecture Overview](architecture.md) - System design
- [Testing Guide](testing.md) - Test strategy
- [Deployment Guide](deployment.md) - Environment variables in production
