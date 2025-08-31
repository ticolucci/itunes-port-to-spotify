class SongRecord
  attr_reader :id, :title, :artist, :album, :album_artist, :filename

  def initialize(row = {})
    @id = fetch_attr(row, :id)
    @title = fetch_attr(row, :title)
    @artist = fetch_attr(row, :artist)
    @album = fetch_attr(row, :album)
    @album_artist = fetch_attr(row, :album_artist)
    @filename = fetch_attr(row, :filename)
  end

  private

  def fetch_attr(row, key)
    return nil if row.nil?
    return nil unless row.respond_to?(:key?)
    # support both string and symbol keys
    if row.key?(key.to_s)
      return row[key.to_s]
    elsif row.key?(key)
      return row[key]
    end
    nil
  end
end

class << SongRecord
  # Iterate over all songs in the DB in batches and yield SongRecord instances.
  # If no block is given, returns an Enumerator.
  #
  # Options:
  #  - batch_size: number of rows to fetch per query (default: 100)
  def process_in_db_batches(batch_size: 100)
    return enum_for(:process_in_db_batches, batch_size: batch_size) unless block_given?

    raise ArgumentError, 'batch_size must be a positive Integer' unless batch_size.is_a?(Integer) && batch_size > 0
    raise 'database ($db) is not available' unless defined?($db) && $db

    last_id = 0
    loop do
      rows = $db.execute('SELECT * FROM songs WHERE id > ? ORDER BY id LIMIT ?', [last_id, batch_size])
      break if rows.nil? || rows.empty?

      rows.each do |row|
        yield SongRecord.new(row)
        last_id = row['id'] || row[:id] || last_id
      end

      break if rows.length < batch_size
    end

    nil
  end
end

