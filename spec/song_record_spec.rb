require_relative '../lib/song_record'
require 'sqlite3'

RSpec.describe SongRecord do
  let(:db_row) do
    {
      'id' => 1,
      'title' => 'Song A',
      'album' => 'Album A',
      'artist' => 'Artist Name',
      'album_artist' => 'Album Artist',
      'filename' => 'song_a.mp3'
    }
  end

  it 'initializes from a DB row hash and exposes attributes' do
    song = SongRecord.new(db_row)

    expect(song.id).to eq(1)
    expect(song.title).to eq('Song A')
    expect(song.artist).to eq('Artist Name')
    expect(song.album).to eq('Album A')
    expect(song.album_artist).to eq('Album Artist')
    expect(song.filename).to eq('song_a.mp3')
  end

  it 'accepts symbol-keyed hashes as well as string-keyed' do
    attrs = { id: 2, title: 'B', artist: 'C', album: 'D', album_artist: 'E', filename: 'song_b.mp3' }
    song = SongRecord.new(attrs)
    expect(song.id).to eq(2)
    expect(song.title).to eq('B')
    expect(song.artist).to eq('C')
    expect(song.album).to eq('D')
    expect(song.album_artist).to eq('E')
    expect(song.filename).to eq('song_b.mp3')
  end
end

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

  it 'uses an id-cursor query (WHERE id >) instead of LIMIT/OFFSET' do
    # replace $db with a double that expects a WHERE id > clause
    db_double = double('db')

    # Expect execute to be called at least once with SQL containing 'WHERE id >'
    allow(db_double).to receive(:results_as_hash=)
    expect(db_double).to receive(:execute).at_least(:once) do |sql, params|
      expect(sql.downcase).to include('where id >')
      # Return empty set to end the loop
      []
    end

    old_db = defined?($db) ? $db : nil
    begin
      $db = db_double
      # call the method; should trigger our expectation
      SongRecord.process_in_db_batches(batch_size: 50) { |_| }
    ensure
      $db = old_db
    end
  end
end
