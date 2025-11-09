import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import { Search, Trash2, AlertCircle } from "lucide-react";
import type { Song } from "@/lib/schema";

interface SongRowProps {
  song: Song;
  isSelected: boolean;
  onToggleSelect: (id: number) => void;
  onSearch: (song: Song) => void;
  onDelete: (song: Song) => void;
}

export function SongRow({
  song,
  isSelected,
  onToggleSelect,
  onSearch,
  onDelete,
}: SongRowProps) {
  const hasIncompleteMetadata = !song.title || !song.artist || !song.album;

  return (
    <TableRow key={song.id} data-state={isSelected ? "selected" : undefined}>
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(song.id)}
          aria-label={`Select ${song.title || 'untitled song'}`}
        />
      </TableCell>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {song.title || <span className="text-muted-foreground italic">(No Title)</span>}
          {hasIncompleteMetadata && (
            <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" aria-label="Incomplete metadata" />
          )}
        </div>
      </TableCell>
      <TableCell>
        {song.artist || <span className="text-muted-foreground italic">(No Artist)</span>}
      </TableCell>
      <TableCell>
        {song.album || <span className="text-muted-foreground italic">(No Album)</span>}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {song.album_artist || "—"}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onSearch(song)}>
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(song)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
