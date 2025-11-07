import Link from "next/link";
import { Button } from "@/components/ui/button";

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
          <h2 className="text-2xl font-semibold mb-4">Quick Start</h2>
          <Link href="/songs">
            <Button size="lg">View iTunes Song Library</Button>
          </Link>
          <p className="text-sm text-muted-foreground mt-4">
            Browse songs imported from your iTunes library in the database
          </p>
        </section>

        <section className="border rounded-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Quick Start</h2>
          <Link href="/spotify-matcher">
            <Button size="lg">Start Matching Songs</Button>
          </Link>
          <p className="text-sm text-muted-foreground mt-4">
            Match songs from your iTunes library with Spotify tracks
          </p>
        </section>
      </div>
    </main>
  );
}
