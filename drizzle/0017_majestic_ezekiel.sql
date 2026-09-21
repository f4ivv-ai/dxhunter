ALTER TABLE `propagation_ft8_hourly` ADD `receiverSource` varchar(12) DEFAULT 'WORLD' NOT NULL;--> statement-breakpoint
ALTER TABLE `propagation_ft8_hourly` ADD `receiverCall` varchar(16);