import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "iTunes to Spotify Porter",
  description: "Port your iTunes library to Spotify",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">

      <body>
        <script src="https://open.spotify.com/embed/iframe-api/v1" async />
        {children}
      </body>
    </html>
  );
}
