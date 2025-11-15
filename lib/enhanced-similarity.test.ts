import { describe, it, expect } from "vitest";
import { calculateEnhancedSimilarity } from "./enhanced-similarity";

describe("calculateEnhancedSimilarity", () => {
  it("Same entry", () => {
    expect(calculateEnhancedSimilarity(
      { artist: "Jacob Taylor", title: "Carolina", album: "The Road" },
      { artist: "Jacob Taylor", title: "Carolina", album: "The Road" }
    )).toBe(100);
  });

  it("Beatles, Hello Goodbye — small formatting diffs", () => {
    expect(calculateEnhancedSimilarity(
      {
        artist: "The Beatles",
        title: "Hello, Goodbye!",
        album: "Magical Mystery Tour",
      },
      {
        artist: "the beatles",
        title: "hello goodbye",
        album: "magical mystery tour",
      }
    )).toBe(100);
  });

  it("special characters - small formatting diffs", () => {
    expect(calculateEnhancedSimilarity(
      { artist: "AC/DC", title: "Thunderstruck", album: "The Razors Edge" },
      { artist: "AC DC", title: "Thunderstruck", album: "The Razors Edge" }
    )).toBe(100);
  });

  it("capitalization - small formatting diffs", () => {
    expect(calculateEnhancedSimilarity(
      {
        artist: "blink-182",
        title: "All the Small Things",
        album: "Enema of the State",
      },
      {
        artist: "Blink 182",
        title: "All the Small Things",
        album: "Enema of the State",
      }
    )).toBe(100);
  });

  it("Yesterday — artist & title match; album differs (normal for compilations)", () => {
    expect(calculateEnhancedSimilarity(
      { artist: "Beatles", title: "Yesterday", album: "Help!" },
      { artist: "Beatles", title: "Yesterday", album: "Greatest Hits" }
    )).toSatisfy((n: number) => n >= 90  && n <= 99);
  });

  it("Song A matches, artist slightly different (“Name” vs “Game”)", () => {
    expect(calculateEnhancedSimilarity(
      { artist: "Artist Name", title: "Song A", album: "Album A" },
      { artist: "Artist Game", title: "Song A", album: "Album B" }
    )).toSatisfy((n: number) => n >= 70 && n <= 80);
  });

  it("probably a different song", () => {
    expect(calculateEnhancedSimilarity(
      { artist: "Artist A", title: "Same Song", album: "Album" },
      { artist: "Artist A", title: "Different Song", album: "Album" }
    )).toSatisfy((n: number) => n >= 5 && n <= 15);
  });

  it("Artist different, title same — could be cover (possible cover, but NOT same)", () => {
    expect(calculateEnhancedSimilarity(
      { artist: "Artist A", title: "Same Song", album: "Album" },
      { artist: "Artist B", title: "Same Song", album: "Album" }
    )).toSatisfy((n: number) => n >= 35 && n <= 45);
  });

  it("John Lennon – Imagine (album differs) ➡️ (same recording, common compilation)", () => {
    expect(calculateEnhancedSimilarity(
      { artist: "John Lennon", title: "Imagine", album: "Imagine" },
      { artist: "John Lennon", title: "Imagine", album: "Greatest Hits" }
    )).toBe(100);
  });

  it("“Song” vs “Song – Remix” ➡️ (same root song, different version)", () => {
    expect(calculateEnhancedSimilarity(
      { artist: "Artist", title: "Song", album: "Album" },
      { artist: "Artist", title: "Song - Remix", album: "Album" }
    )).toSatisfy((n: number) => n >= 80 && n <= 90);
  });

  it("Identical", () => {
    expect(calculateEnhancedSimilarity(
      { artist: "Artist", title: "Song", album: "Original Album" },
      { artist: "Artist", title: "Song", album: "Original Album" }
    )).toBe(100);
  });

  it("Original album vs Best O", () => {
    expect(calculateEnhancedSimilarity(
      { artist: "Artist", title: "Song", album: "Original Album" },
      { artist: "Artist", title: "Song", album: "Best Of" }
    )).toSatisfy((n: number) => n >= 90 && n <= 100);
  });

  it("Help! vs Help! Remastered 2009 ➡️ (same track, different edition)", () => {
    expect(calculateEnhancedSimilarity(
      { artist: "Beatles", title: "Yesterday", album: "Help!" },
      {
        artist: "Beatles",
        title: "Yesterday",
        album: "Help! - Remastered 2009",
      }
    )).toSatisfy((n: number) => n >= 90 && n <= 100);
  });

  it("Missing artist vs real artist — title and album match ➡️ (very likely same)", () => {
    expect(calculateEnhancedSimilarity(
      { artist: "null", title: "Test", album: "Album" },
      { artist: "Artist", title: "Test", album: "Album" }
    )).toSatisfy((n: number) => n >= 80 && n <= 90);
  });

  it("Both missing artist, title + album match", () => {
    expect(calculateEnhancedSimilarity(
      { artist: "null", title: "Test", album: "Album" },
      { artist: "null", title: "Test", album: "Album" }
    )).toSatisfy((n: number) => n >= 90 && n <= 95);
  });

  it("Missing title vs real title → big risk", () => {
    expect(calculateEnhancedSimilarity(
      { artist: "Artist", title: "null", album: "Album" },
      { artist: "Artist", title: "Test", album: "Album" }
    )).toSatisfy((n: number) => n >= 20 && n <= 30);
  });

  it("Missing album vs real album → not a big issue", () => {
    expect(calculateEnhancedSimilarity(
      { artist: "Artist", title: "Song", album: "null" },
      { artist: "Artist", title: "Song", album: "Album" }
    )).toSatisfy((n: number) => n >= 90 && n <= 100);
  });

  it("Original Artist vs Cover Artist ➡️ (same song, but not same record)", () => {
    expect(calculateEnhancedSimilarity(
      { artist: "Original Artist", title: "Popular Song", album: "Album" },
      { artist: "Cover Artist", title: "Popular Song", album: "Tribute Album" }
    )).toSatisfy((n: number) => n >= 25 && n <= 35);
  });

  it("Get Lucky vs Get Lucky (feat Pharrell) ➡️ (same track; feature metadata)", () => {
    expect(calculateEnhancedSimilarity(
      {
        artist: "Daft Punk",
        title: "Get Lucky",
        album: "Random Access Memories",
      },
      {
        artist: "Daft Punk (feat Pharrell Williams)",
        title: "Get Lucky",
        album: "Random Access Memories",
      }
    )).toSatisfy((n: number) => n >= 90 && n <= 100);
  });

  it("only artist extremely weak", () => {
    expect(calculateEnhancedSimilarity(
      { artist: "Artist", title: "X", album: "Y" },
      { artist: "Artist", title: "A", album: "B" }
    )).toSatisfy((n: number) => n >= 0 && n <= 10);
  });

  it("Artist + title match; album differ", () => {
    expect(calculateEnhancedSimilarity(
      { artist: "Artist", title: "Title", album: "A" },
      { artist: "Artist", title: "Title", album: "B" }
    )).toSatisfy((n: number) => n >= 90 && n <= 100);
  });

  it("Only album matches ➡️ (almost certainly diff)", () => {
    expect(calculateEnhancedSimilarity(
      { artist: "X", title: "Y", album: "Album" },
      { artist: "A", title: "B", album: "Album" }
    )).toSatisfy((n: number) => n >= 0 && n <= 5);
  });
});
