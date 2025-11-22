"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Trash2, Loader2, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Song } from "@/lib/schema";
import { fetchSongs, type SongFilters } from "@/lib/actions";
import { SongRow } from "./_components/song-row";

const PAGE_SIZE = 50;

export default function SongsPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filter state
  const [filters, setFilters] = useState<SongFilters>({});
  const [titleFilter, setTitleFilter] = useState("");
  const [artistFilter, setArtistFilter] = useState("");
  const [albumFilter, setAlbumFilter] = useState("");
  const [spotifyMatchFilter, setSpotifyMatchFilter] = useState<string>("");

  // Build filters object from individual filter states
  const buildFilters = useCallback((): SongFilters => {
    const f: SongFilters = {};
    if (titleFilter.trim()) f.title = titleFilter.trim();
    if (artistFilter.trim()) f.artist = artistFilter.trim();
    if (albumFilter.trim()) f.album = albumFilter.trim();
    if (spotifyMatchFilter === "matched") f.hasSpotifyMatch = true;
    if (spotifyMatchFilter === "unmatched") f.hasSpotifyMatch = false;
    return f;
  }, [titleFilter, artistFilter, albumFilter, spotifyMatchFilter]);

  // Apply filters (resets to page 1)
  const applyFilters = useCallback(() => {
    setFilters(buildFilters());
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [buildFilters]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setTitleFilter("");
    setArtistFilter("");
    setAlbumFilter("");
    setSpotifyMatchFilter("");
    setFilters({});
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, []);

  // Check if any filters are active
  const hasActiveFilters = titleFilter || artistFilter || albumFilter || spotifyMatchFilter;

  // Fetch songs using Server Action when page or filters change
  useEffect(() => {
    async function loadSongs() {
      try {
        setLoading(true);
        setError(null);

        const offset = (currentPage - 1) * PAGE_SIZE;

        // Call Server Action with pagination and filters
        const data = await fetchSongs({ limit: PAGE_SIZE, offset, filters });

        if (!data.success) {
          throw new Error(data.error);
        }

        setSongs(data.songs);
        setTotalCount(data.total);
      } catch (err) {
        console.error("Error loading songs:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    loadSongs();
  }, [currentPage, filters]); // Re-fetch when page or filters change

  // Pagination helpers
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(currentPage * PAGE_SIZE, totalCount);

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      setSelectedIds(new Set()); // Clear selection on page change
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      setSelectedIds(new Set()); // Clear selection on page change
    }
  };

  const toggleSelection = (id: number) => {
    const newSelection = new Set(selectedIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedIds(newSelection);
  };

  const toggleAll = () => {
    if (selectedIds.size === songs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(songs.map((s) => s.id)));
    }
  };

  const handleSearch = (song: Song) => {
    alert(`Searching DB for: ${song.title || '(No Title)'} by ${song.artist || '(No Artist)'}`);
    // TODO: Connect to Ruby SpotifyClient or reimplement in TypeScript
  };

  const handleDelete = (song: Song) => {
    alert(`Delete song: ${song.title || '(No Title)'} (ID: ${song.id})`);
    // TODO: Implement delete functionality
  };

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Loading songs from database...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="border border-destructive rounded-lg p-6 bg-destructive/10">
          <h2 className="text-xl font-semibold text-destructive mb-2">
            Error Loading Songs
          </h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">iTunes Library</h1>
        <p className="text-muted-foreground">
          Songs from your iTunes library ready to be ported to Spotify
        </p>
      </div>

      {/* Filter Controls */}
      <div className="mb-6 p-4 border rounded-lg bg-muted/30">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[150px]">
            <label htmlFor="title-filter" className="block text-sm font-medium mb-1">
              Title starts with
            </label>
            <Input
              id="title-filter"
              placeholder="e.g. Bohemian"
              value={titleFilter}
              onChange={(e) => setTitleFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label htmlFor="artist-filter" className="block text-sm font-medium mb-1">
              Artist starts with
            </label>
            <Input
              id="artist-filter"
              placeholder="e.g. Queen"
              value={artistFilter}
              onChange={(e) => setArtistFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label htmlFor="album-filter" className="block text-sm font-medium mb-1">
              Album starts with
            </label>
            <Input
              id="album-filter"
              placeholder="e.g. A Night"
              value={albumFilter}
              onChange={(e) => setAlbumFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            />
          </div>
          <div className="w-[150px]">
            <label htmlFor="spotify-filter" className="block text-sm font-medium mb-1">
              Spotify Match
            </label>
            <Select
              id="spotify-filter"
              value={spotifyMatchFilter}
              onChange={(e) => {
                setSpotifyMatchFilter(e.target.value);
              }}
            >
              <option value="">All</option>
              <option value="matched">Matched</option>
              <option value="unmatched">Unmatched</option>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button onClick={applyFilters} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              Filter
            </Button>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters} disabled={loading}>
                <X className="h-4 w-4 mr-2" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedIds.size === songs.length}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Artist</TableHead>
              <TableHead>Album</TableHead>
              <TableHead>Album Artist</TableHead>
              <TableHead>Spotify</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {songs.map((song) => (
              <SongRow
                key={song.id}
                song={song}
                isSelected={selectedIds.has(song.id)}
                onToggleSelect={toggleSelection}
                onSearch={handleSearch}
                onDelete={handleDelete}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-4 p-4 bg-muted rounded-lg flex items-center justify-between">
          <span className="text-sm font-medium">
            {selectedIds.size} song{selectedIds.size > 1 ? "s" : ""} selected
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Search className="mr-2 h-4 w-4" />
              Search Selected
            </Button>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              Remove Selected
            </Button>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      <div className="mt-6 flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Showing {totalCount > 0 ? startIndex : 0} to {endIndex} of {totalCount} songs
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToPreviousPage}
            disabled={currentPage === 1 || loading}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
          <div className="text-sm text-muted-foreground px-2">
            Page {currentPage} of {totalPages || 1}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextPage}
            disabled={currentPage >= totalPages || loading}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
