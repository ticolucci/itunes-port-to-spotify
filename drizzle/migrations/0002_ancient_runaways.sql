CREATE TABLE `spotify_tracks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`spotify_id` text NOT NULL,
	`name` text NOT NULL,
	`artists` text NOT NULL,
	`album` text NOT NULL,
	`uri` text NOT NULL,
	`search_query` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_spotify_tracks_search_spotify` ON `spotify_tracks` (`search_query`,`spotify_id`);