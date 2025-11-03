import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { TableCell, TableRow } from "@/components/ui/table";
import { Search, Trash2 } from "lucide-react";
import type { Song } from "@/lib/types";

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
  return (
    <TableRow key={song.id} data-state={isSelected ? "selected" : undefined}>
      <TableCell>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(song.id)}
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
