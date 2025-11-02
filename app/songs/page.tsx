"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Trash2 } from "lucide-react";
import type { Song } from "@/lib/types";

// Sample data from spec/acceptance/project_spec.rb lines 29-33
const sampleSongs: Song[] = [
  {
    id: 17791,
    title: "Bem-Vinda",
    album: "5 Elementos Ao Vivo",
    artist: "Jeito Moleque",
    album_artist: "Jeito Moleque",
    filename: "F46/NLKA.mp3",
  },
  {
    id: 18443,
    title: "Of The Girl",
    album: "Binaural",
    artist: "Pearl Jam",
    album_artist: "",
    filename: "F48/HDVI.mp3",
  },
  {
    id: 16633,
    title: "两人骑自行车",
    album: "山楂树之恋 原声大碟",
    artist: "群星",
    album_artist: "",
    filename: "F43/IHQY.mp3",
  },
];

export default function SongsPage() {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

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
    if (selectedIds.size === sampleSongs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sampleSongs.map((s) => s.id)));
    }
  };

  const handleSearch = (song: Song) => {
    alert(`Searching Spotify for: ${song.title} by ${song.artist}`);
    // TODO: Connect to Ruby SpotifyClient or reimplement in TypeScript
  };

  const handleDelete = (song: Song) => {
    alert(`Delete song: ${song.title} (ID: ${song.id})`);
    // TODO: Implement delete functionality
  };

  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">iTunes Library</h1>
        <p className="text-muted-foreground">
          Songs from your iTunes library ready to be ported to Spotify
        </p>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectedIds.size === sampleSongs.length}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Artist</TableHead>
              <TableHead>Album</TableHead>
              <TableHead>Album Artist</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sampleSongs.map((song) => (
              <TableRow
                key={song.id}
                data-state={selectedIds.has(song.id) ? "selected" : undefined}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(song.id)}
                    onCheckedChange={() => toggleSelection(song.id)}
                    aria-label={`Select ${song.title}`}
                  />
                </TableCell>
                <TableCell className="font-medium">{song.title}</TableCell>
                <TableCell>{song.artist}</TableCell>
                <TableCell>{song.album}</TableCell>
                <TableCell className="text-muted-foreground">
                  {song.album_artist || "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSearch(song)}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(song)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
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

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="text-sm font-semibold text-blue-900 mb-1">
          🎓 Learning Note
        </h3>
        <p className="text-sm text-blue-800">
          This is a <strong>"use client"</strong> component because it uses
          React hooks (useState). The checkboxes and buttons are interactive,
          which requires client-side JavaScript. Server Components can't have
          interactivity!
        </p>
      </div>
    </div>
  );
}
