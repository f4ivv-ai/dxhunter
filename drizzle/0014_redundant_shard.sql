ALTER TABLE `propagation_ft8_hourly` DROP INDEX `ft8_hourly_slot_uniq`;--> statement-breakpoint
ALTER TABLE `propagation_ft8_hourly` ADD `minuteUtc` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `propagation_ft8_hourly` DROP INDEX `ft8_hourly_slot_uniq`;--> statement-breakpoint
ALTER TABLE `propagation_ft8_hourly` ADD CONSTRAINT `ft8_quarter_slot_uniq` UNIQUE(`snapDate`,`hourUtc`,`minuteUtc`,`band`,`continent`);
