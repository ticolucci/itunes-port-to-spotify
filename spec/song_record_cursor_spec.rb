RSpec.describe 'SongRecord cursor-based batching' do
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
