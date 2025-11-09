import Groq from "groq-sdk";
import { z } from "zod";
import type { Song } from "./schema";

// Zod schema for AI response validation
export const MetadataFixSchema = z.object({
  suggestedArtist: z.string().describe("Normalized artist name"),
  suggestedTrack: z.string().describe("Normalized track title"),
  suggestedAlbum: z.string().optional().describe("Normalized album name"),
  confidence: z
    .enum(["high", "medium", "low"])
    .describe("Confidence level of the suggestion"),
  reasoning: z
    .string()
    .describe("Brief explanation of what was fixed and why"),
  alternativeSearchQueries: z
    .array(z.string())
    .max(3)
    .describe("Alternative search queries to try on Spotify"),
});

export type MetadataFix = z.infer<typeof MetadataFixSchema>;

// In-memory cache for AI suggestions (use Redis in production)
const metadataCache = new Map<string, MetadataFix>();

// Initialize Groq client (lazy initialization)
let groqClient: Groq | null = null;

function getGroqClient(): Groq {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GROQ_API_KEY environment variable is not set. Get your API key from https://console.groq.com"
      );
    }
    groqClient = new Groq({ apiKey });
  }
  return groqClient;
}

// System prompt with clear instructions and examples
const SYSTEM_PROMPT = `You are a music metadata expert specializing in normalizing iTunes library data for Spotify API searches.

Your task is to fix common metadata issues that prevent successful Spotify matches:

Common issues to fix:
1. Extra whitespace and formatting: "The Beatles " → "The Beatles"
2. Featured artists in main artist field: "Daft Punk feat. Pharrell" → "Daft Punk"
3. Special characters that break searches: "Beyoncé" might work better as "Beyonce" (but preserve if critical)
4. Typos and inconsistent formatting
5. Live/remix/version indicators misplaced
6. Ampersands vs "and": "Simon & Garfunkel" vs "Simon and Garfunkel"
7. Abbreviations vs full names: "RHCP" vs "Red Hot Chili Peppers"
8. Empty fields that could be inferred from other metadata

Guidelines:
- Preserve artist intent (don't change "The Beatles" to "Beatles")
- For featured artists, put main artist in suggestedArtist, include alternative queries with features
- Provide 1-3 alternative search queries that include variations
- High confidence: simple cleanup (whitespace, obvious typos)
- Medium confidence: character normalization, featured artist extraction
- Low confidence: ambiguous cases or complex formatting issues

Examples:

Input: artist="The Beatles ", track=" Hey Jude  ", album="  Past Masters "
Output: {
  "suggestedArtist": "The Beatles",
  "suggestedTrack": "Hey Jude",
  "suggestedAlbum": "Past Masters",
  "confidence": "high",
  "reasoning": "Removed extra whitespace",
  "alternativeSearchQueries": ["The Beatles Hey Jude", "Hey Jude Beatles"]
}

Input: artist="Daft Punk feat. Pharrell Williams", track="Get Lucky", album="Random Access Memories"
Output: {
  "suggestedArtist": "Daft Punk",
  "suggestedTrack": "Get Lucky",
  "suggestedAlbum": "Random Access Memories",
  "confidence": "medium",
  "reasoning": "Extracted main artist, removed featured artist from artist field",
  "alternativeSearchQueries": ["Daft Punk Get Lucky", "Get Lucky Pharrell", "Daft Punk Get Lucky Pharrell"]
}

Input: artist="", track="Hey Jude", album=""
Output: {
  "suggestedArtist": "The Beatles",
  "suggestedTrack": "Hey Jude",
  "suggestedAlbum": "Past Masters",
  "confidence": "low",
  "reasoning": "Common track with missing artist and album; inferred from known data",
  "alternativeSearchQueries": ["The Beatles Hey Jude", "Hey Jude Beatles"]
}

Always return valid JSON matching the schema.`;

/**
 * Fix metadata using Groq AI with caching and error handling
 *
 * @param song - The song object with potentially problematic metadata
 * @returns MetadataFix suggestion or null if API fails
 */
export async function fixMetadataWithAI(
  song: Song
): Promise<MetadataFix | null> {
  try {
    // Generate cache key from song metadata
    const cacheKey = `${song.artist || ""}:${song.title || ""}:${song.album || ""}`;

    // Check cache first
    if (metadataCache.has(cacheKey)) {
      console.log(`[AI Cache Hit] ${cacheKey}`);
      return metadataCache.get(cacheKey)!;
    }

    // Prepare user prompt
    const userPrompt = `Fix this music metadata for Spotify search:

Artist: ${song.artist || "(empty)"}
Track: ${song.title || "(empty)"}
Album: ${song.album || "(empty)"}
Album Artist: ${song.album_artist || "(not specified)"}

Analyze the metadata and suggest corrections. Return JSON only, no markdown.`;

    const client = getGroqClient();

    // Call Groq API with JSON mode
    const completion = await client.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      model: "llama-3.3-70b-versatile", // Fast and high quality
      temperature: 0.3, // Lower temperature for more consistent outputs
      max_tokens: 500,
      response_format: { type: "json_object" }, // JSON mode
    });

    const responseText = completion.choices[0]?.message?.content;

    if (!responseText) {
      console.error("[AI] Empty response from Groq");
      return null;
    }

    // Parse and validate with Zod
    const rawOutput = JSON.parse(responseText);
    const validated = MetadataFixSchema.parse(rawOutput);

    // Cache successful result
    metadataCache.set(cacheKey, validated);

    console.log(
      `[AI Success] ${song.artist} - ${song.title} (confidence: ${validated.confidence})`
    );

    return validated;
  } catch (error) {
    // Comprehensive error handling
    if (error instanceof z.ZodError) {
      console.error("[AI Schema Validation Error]", error.issues);
      console.error("Raw response caused validation error");
    } else if (error instanceof SyntaxError) {
      console.error("[AI JSON Parse Error]", error.message);
    } else if (error instanceof Error) {
      console.error("[AI Error]", error.message);
    } else {
      console.error("[AI Unknown Error]", error);
    }

    // Graceful degradation - return null, caller handles fallback
    return null;
  }
}

/**
 * Clear the metadata cache (useful for testing or memory management)
 */
export function clearMetadataCache(): void {
  metadataCache.clear();
  console.log("[AI Cache] Cleared");
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: metadataCache.size,
    keys: Array.from(metadataCache.keys()),
  };
}
