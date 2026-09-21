ALTER TABLE `calibration_snapshots` DROP INDEX `slot_uniq`;--> statement-breakpoint
ALTER TABLE `calibration_snapshots` ADD `band` varchar(8) DEFAULT '40m' NOT NULL;--> statement-breakpoint
ALTER TABLE `calibration_snapshots` ADD CONSTRAINT `slot_uniq` UNIQUE(`snapDate`,`hourUtc`,`band`,`zoneId`);