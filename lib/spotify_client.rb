require 'httparty'
require 'dotenv'

Dotenv.load('.secrets') if defined?(Dotenv)

class SpotifyClient
  TOKEN_URL = 'https://accounts.spotify.com/api/token'

  attr_reader :access_token, :token_type, :expires_in

  def initialize(access_token:, token_type: nil, expires_in: nil)
    @access_token = access_token
    @token_type = token_type
    @expires_in = expires_in
  end

  # Search Spotify using a hash of song attributes. Returns the HTTParty response.
  # Expected keys: :title, :artist, :album, :album_artist, :filename
  def search(attrs = {})
    # Use Spotify field tags for better search relevance
    field_map = { title: 'track', artist: 'artist', album: 'album', album_artist: 'albumartist' }
    q_parts = []

    field_map.each do |k, tag|
      v = attrs[k] || attrs[k.to_s]
      next if v.nil? || v.to_s.strip.empty?
      q_parts << "#{tag}:#{v.to_s.strip}"
    end

    # include filename as plain text (Spotify doesn't have a filename field)
    fn = attrs[:filename] || attrs['filename']
    q_parts << fn.to_s.strip unless fn.nil? || fn.to_s.strip.empty?

    q = q_parts.join(' ')

    headers = { 'Authorization' => "Bearer #{@access_token}" }
    query = { q: q, type: 'track' }

    HTTParty.get('https://api.spotify.com/v1/search', headers: headers, query: query)
  end

  # Initialize the client by fetching an app-level access token using client credentials.
  # Reads CLIENT_ID and CLIENT_SECRET from .secrets via Dotenv.
  def self.setup
    client_id = ENV['CLIENT_ID']
    client_secret = ENV['CLIENT_SECRET']
    raise 'CLIENT_ID/CLIENT_SECRET must be set in .secrets or environment' unless client_id && client_secret

    headers = { 'Content-Type' => 'application/x-www-form-urlencoded' }
    body = { grant_type: 'client_credentials', client_id: client_id, client_secret: client_secret }

    resp = HTTParty.post(TOKEN_URL, headers: headers, body: body)
    unless resp && resp.code == 200 && resp['access_token']
      raise "Failed to fetch Spotify token: #{resp&.code} #{resp&.body}"
    end

    new(access_token: resp['access_token'], token_type: resp['token_type'], expires_in: resp['expires_in'])
  end
end
