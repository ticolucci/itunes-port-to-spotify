require 'sqlite3'
require 'json'

$db = SQLite3::Database.open("database.db")
$db.results_as_hash = true

$db.execute <<~SQL
  DROP TABLE  IF EXISTS songs;
SQL

$db.execute <<~SQL
  CREATE TABLE songs(
    id INTEGER NOT NULL PRIMARY KEY,
    title TEXT,
    album TEXT,
    artist TEXT,
    album_artist TEXT,
    filename TEXT
  );

  CREATE INDEX idx_songs_album_artist ON songs (artist, album, album_artist);
SQL

def db_insert song
  insert_sql = <<~SQL
    INSERT INTO songs(title, album, artist, album_artist, filename) VALUES (?, ?, ?, ?, ?);
  SQL
  song_args = [song['title'], song['album'], song['artist'], song['album_artist'], song['filename']]
  $db.execute(insert_sql, song_args) unless song_args.compact.empty?
end

lines = File.readlines "ipod_library_with_files.txt"

last_json = ""
lines.each.with_index do |l, i|
  percentage = i.to_f/lines.count
  p percentage
  puts ">#{'#'*(percentage*40)}#{' '*((1-percentage)*40)}|"
  last_json << l
  if l == "}\n"
    song_json = JSON.parse(last_json)
    song = {}
    if song_json['format']
      song.merge! song_json['format']['tags'] if song_json['format']['tags']
      song['filename'] = song_json['format']['filename'] 
    end
    db_insert(song)
    last_json = ""
  end
  # break if i > 100
end

