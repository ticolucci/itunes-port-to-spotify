require_relative '../lib/song_record'

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
