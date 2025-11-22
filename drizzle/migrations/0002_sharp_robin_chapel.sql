CREATE TABLE `spotify_search_cache` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`results` text NOT NULL,
	`created_at` integer NOT NULL
);
