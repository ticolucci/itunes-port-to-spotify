require_relative '../lib/song_record'
require 'sqlite3'

RSpec.describe 'SongRecord batch processing' do
  around(:each) do |example|
    # setup in-memory DB and assign to global $db used by code
    db = SQLite3::Database.new(':memory:')
    db.results_as_hash = true
    db.execute <<~SQL
      CREATE TABLE songs(
        id INTEGER NOT NULL PRIMARY KEY,
        title TEXT,
        album TEXT,
        artist TEXT,
        album_artist TEXT,
        filename TEXT
      );
    SQL

    # insert 250 rows
    1.upto(250) do |i|
      db.execute('INSERT INTO songs(title, album, artist, album_artist, filename) VALUES(?,?,?,?,?)',
                 ["Title #{i}", "Album #{(i%10)+1}", "Artist #{(i%5)+1}", "AlbumArtist #{(i%3)+1}", "file_#{i}.mp3"])
    end

    begin
      old_db = defined?($db) ? $db : nil
      $db = db
      example.run
    ensure
      $db = old_db
      db.close if db
    end
  end

  it 'processes every song in the DB by batches and yields SongRecord instances' do
    processed = []
    expect do
      SongRecord.process_in_db_batches(batch_size: 100) do |song|
        processed << song
        # simple sanity check on type
        expect(song).to be_a(SongRecord)
      end
    end.to_not raise_error

    expect(processed.length).to eq(250)
    expect(processed.first.id).to eq(1)
    expect(processed.last.id).to eq(250)
  end

  it 'accepts a custom batch size' do
    processed = []
    SongRecord.process_in_db_batches(batch_size: 50) do |song|
      processed << song
    end
    expect(processed.length).to eq(250)
  end
end
