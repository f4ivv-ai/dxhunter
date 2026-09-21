CREATE TABLE `calibration_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapDate` varchar(10) NOT NULL,
	`hourUtc` int NOT NULL,
	`zoneId` varchar(24) NOT NULL,
	`zoneLabel` varchar(64),
	`predictedScore` int NOT NULL,
	`actualSpots` int NOT NULL DEFAULT 0,
	`actualScore` int NOT NULL DEFAULT 0,
	`error` int NOT NULL DEFAULT 0,
	`kp` double,
	`sfi` int,
	`aIndex` int,
	`note` text,
	`source` enum('auto','manual') NOT NULL DEFAULT 'auto',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `calibration_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `slot_uniq` UNIQUE(`snapDate`,`hourUtc`,`zoneId`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
