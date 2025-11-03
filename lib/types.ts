export interface Song {
  id: number;
  title: string;
  artist: string;
  album: string;
  album_artist: string;
  filename: string;
  spotify_id?: string | null;
}
