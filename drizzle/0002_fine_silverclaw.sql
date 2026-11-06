CREATE TABLE `kyc_cases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`customer_name` text NOT NULL,
	`customer_email` text NOT NULL,
	`country` text NOT NULL,
	`risk_score` integer NOT NULL,
	`documents` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`assignee_id` text,
	`assignee_name` text,
	`decision_reason` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
