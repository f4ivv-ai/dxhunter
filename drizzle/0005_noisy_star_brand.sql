ALTER TABLE `users` ADD `subscription` enum('free','premium') DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `subscriptionExpiry` timestamp;