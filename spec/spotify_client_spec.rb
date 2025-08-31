require 'spec_helper'

RSpec.describe SpotifyClient do
  describe '.setup' do
    it 'returns a SpotifyClient instance' do
      client = SpotifyClient.setup
      expect(client).to be_a(SpotifyClient)
    end

     it 'posts to the token endpoint and returns a client on success' do
      token_resp = {'access_token' => 'abc123', 'token_type' => 'Bearer', 'expires_in' => 3600}
      allow(token_resp).to receive(:code).and_return(200)

      expect(HTTParty).to receive(:post).with(SpotifyClient::TOKEN_URL, any_args).and_return(token_resp)

      client = SpotifyClient.setup
      expect(client).to be_a(SpotifyClient)
      expect(client.access_token).to eq('abc123')
    end

    it 'raises when token fetch fails' do
      bad_resp = {}
      allow(bad_resp).to receive(:code).and_return(401)
      allow(bad_resp).to receive(:body).and_return('unauthorized')

      expect(HTTParty).to receive(:post).and_return(bad_resp)
      expect { SpotifyClient.setup }.to raise_error(RuntimeError)
    end
  end

    describe '#search' do
    let(:client) { SpotifyClient.new(access_token: 'test-token') }

    it 'builds a Spotify search query from song attributes and calls the API' do
      song_query = {
        title: 'Song A',
        artist: 'Artist Name',
        album: 'Album A'
      }

      expect(HTTParty).to receive(:get) do |url, opts|
        expect(url).to eq('https://api.spotify.com/v1/search')
        # Authorization header must be present
        expect(opts[:headers]).to be_a(Hash)
        expect(opts[:headers]['Authorization']).to eq('Bearer test-token')

        # The query should contain a combined 'q' string with relevant fields
        q = opts[:query][:q]
        expect(q).to be_a(String)
        expect(q).to include('Song A')
        expect(q).to include('Artist Name')
        expect(q).to include('Album A')

        # type should include track (we search for tracks)
        expect(opts[:query][:type]).to include('track')

        # return a dummy response object compatible with current code expectations
        double(code: 200, body: { 'tracks' => { 'items' => [] } })
      end

      # Call the method under test (not implemented yet)
      client.search(song_query)
    end

    it 'tags the title with track:' do
      song_query = { title: 'Song A' }
      expect(HTTParty).to receive(:get) do |_, opts|
        expect(opts[:query][:q]).to include('track:')
        expect(opts[:query][:q]).to include('Song A')
        resp = {}
        allow(resp).to receive(:code).and_return(200)
        resp
      end
      client.search(song_query)
    end

    it 'tags the artist with artist:' do
      song_query = { artist: 'Artist Name' }
      expect(HTTParty).to receive(:get) do |_, opts|
        expect(opts[:query][:q]).to include('artist:')
        expect(opts[:query][:q]).to include('Artist Name')
        resp = {}
        allow(resp).to receive(:code).and_return(200)
        resp
      end
      client.search(song_query)
    end

    it 'tags the album with album:' do
      song_query = { album: 'Album A' }
      expect(HTTParty).to receive(:get) do |_, opts|
        expect(opts[:query][:q]).to include('album:')
        expect(opts[:query][:q]).to include('Album A')
        resp = {}
        allow(resp).to receive(:code).and_return(200)
        resp
      end
      client.search(song_query)
    end
  end
end
