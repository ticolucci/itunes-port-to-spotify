require 'rspec'
require 'pry-byebug'

# Load all project library files so specs can reference project classes without
# having to require each file individually. We sort the list for deterministic
# load order.
Dir[File.expand_path('../../lib/**/*.rb', __FILE__)].sort.each { |f| require f }

RSpec.configure do |config|
  config.example_status_persistence_file_path = '.rspec_status'
  config.disable_monkey_patching!
  config.expect_with :rspec do |c|
    c.syntax = :expect
  end
end
