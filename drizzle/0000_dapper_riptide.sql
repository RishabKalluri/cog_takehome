CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ts` text NOT NULL,
	`request_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_name` text NOT NULL,
	`actor_email` text NOT NULL,
	`app_slug` text NOT NULL,
	`app_version` text NOT NULL,
	`action` text NOT NULL,
	`status` text NOT NULL,
	`entity_id` text,
	`input` text,
	`before` text,
	`after` text,
	`error` text,
	`git_sha` text NOT NULL,
	`environment` text NOT NULL,
	`duration_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `deployments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_slug` text NOT NULL,
	`environment` text NOT NULL,
	`version` text NOT NULL,
	`git_sha` text NOT NULL,
	`deployed_at` text NOT NULL,
	`deployed_by` text NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `example_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`body` text NOT NULL,
	`author_id` text NOT NULL,
	`author_name` text NOT NULL,
	`created_at` text NOT NULL
);
