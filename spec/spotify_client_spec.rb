require_relative '../lib/spotify_client'

RSpec.describe SpotifyClient do
  describe '.setup' do
    it 'returns a SpotifyClient instance' do
      client = SpotifyClient.setup
      expect(client).to be_a(SpotifyClient)
    end
  end
end
