CREATE TABLE `propagation_ft8_hourly` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapDate` varchar(10) NOT NULL,
	`hourUtc` int NOT NULL,
	`band` varchar(8) NOT NULL,
	`continent` varchar(4) NOT NULL,
	`spotCount` int NOT NULL DEFAULT 0,
	`avgSnr` double,
	`maxSnr` double,
	`dominantAzimuth` int,
	`sfi` int,
	`kp` double,
	`source` enum('auto','manual') NOT NULL DEFAULT 'auto',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `propagation_ft8_hourly_id` PRIMARY KEY(`id`),
	CONSTRAINT `ft8_hourly_slot_uniq` UNIQUE(`snapDate`,`hourUtc`,`band`,`continent`)
);
