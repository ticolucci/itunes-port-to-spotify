export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-4xl font-bold mb-4">
        iTunes to Spotify Porter
      </h1>
      <p className="text-lg mb-8">
        Welcome to your music library migration tool!
      </p>

      <div className="space-y-4">
        <section className="border rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-2">Next Steps</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>View your iTunes library from the database</li>
            <li>Search for songs on Spotify</li>
            <li>Map and save your favorite tracks</li>
          </ul>
        </section>

        <section className="border rounded-lg p-6 bg-gray-50">
          <h2 className="text-2xl font-semibold mb-2">Backend Status</h2>
          <p className="text-gray-600">
            Your Ruby backend is ready with SpotifyClient and SongRecord.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            We'll connect this Next.js frontend to your existing Ruby code soon!
          </p>
        </section>
      </div>
    </main>
  );
}
