require 'spec_helper'

RSpec.describe 'Acceptance: Project', :acceptance do
  # Acceptance tests exercise end-to-end flows across the project. They are
  # skipped by default. Set the environment variable RUN_ACCEPTANCE=1 to run
  # them locally, or enable them in CI with proper HTTP stubs / secrets.

  before(:all) do
    unless ENV['RUN_ACCEPTANCE'] == '1'
      skip 'Acceptance tests are skipped by default. Set RUN_ACCEPTANCE=1 to enable.'
    end
  end

  it 'processes songs from the DB in batches (in-memory smoke test)' do
    # This exercises the SongRecord batch processor against a small in-memory DB.
  db = SQLite3::Database.new(':memory:')
  db.results_as_hash = true
    db.execute <<-SQL
      CREATE TABLE songs (
        id INTEGER PRIMARY KEY,
        title TEXT,
        artist TEXT,
        album TEXT,
        album_artist TEXT,
        filename TEXT
      )
    SQL

    rows = [
      [17791, "Bem-Vinda","5 Elementos Ao Vivo","Jeito Moleque","Jeito Moleque","F46/NLKA.mp3"],
      [18443, "Of The Girl","Binaural","Pearl Jam","","F48/HDVI.mp3"],
      [16633, "两人骑自行车","山楂树之恋 原声大碟","群星","","F43/IHQY.mp3"]
    ]

    rows.each do |r|
      db.execute('INSERT INTO songs (id, title, artist, album, album_artist, filename) VALUES (?, ?, ?, ?, ?, ?)', r)
    end

    # Project code expects a global $db (used in tests and library helpers)
    $db = db

    seen = []
    SongRecord.process_in_db_batches(batch_size: 2) do |song|
      seen << song.title
    end

    expect(seen.size).to eq(rows.size)
  end

   it 'runs a full end-to-end flow including Spotify token + search (requires secrets)' do
    # Ensure required secrets are present
    unless ENV['CLIENT_ID'] && ENV['CLIENT_SECRET']
      skip 'CLIENT_ID/CLIENT_SECRET not present in environment; cannot run live acceptance.'
    end

    client = SpotifyClient.setup
    expect(client).to be_a(SpotifyClient)

    # Use a small sample song to test search
    sample = { title: 'Of The Girl', artist: 'Pearl Jam', album: 'Binaural', album_artist: '', filename: 'F48/HDVI.mp3' }
    resp = client.search(sample)

    # Basic shape assertions
    expect(resp).to respond_to(:code)
    expect(resp.code).to eq(200)
    parsed = resp.parsed_response
    expect(parsed).to be_a(Hash)
    expect(parsed).to have_key('tracks')
    expect(parsed['tracks']).to have_key('items')
    expect(parsed['tracks']['items']).to be_an(Array)
    expect(parsed['tracks']['items'].length).to be >= 0
  end
end
