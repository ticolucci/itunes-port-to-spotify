CREATE TABLE `songs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text,
	`album` text,
	`artist` text,
	`album_artist` text,
	`filename` text
);
--> statement-breakpoint
CREATE INDEX `idx_songs_album_artist` ON `songs` (`artist`,`album`,`album_artist`);