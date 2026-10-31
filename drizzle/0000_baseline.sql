CREATE TABLE `calibration_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapDate` varchar(10) NOT NULL,
	`hourUtc` int NOT NULL,
	`band` varchar(8) NOT NULL DEFAULT '40m',
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
	CONSTRAINT `slot_uniq` UNIQUE(`snapDate`,`hourUtc`,`band`,`zoneId`)
);
--> statement-breakpoint
CREATE TABLE `cat_commands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payload` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cat_commands_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cat_relay_state` (
	`stateKey` varchar(32) NOT NULL,
	`payload` text NOT NULL,
	`updatedAt` timestamp(3) NOT NULL,
	CONSTRAINT `cat_relay_state_stateKey` PRIMARY KEY(`stateKey`)
);
--> statement-breakpoint
CREATE TABLE `contest_qsos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`call` varchar(20) NOT NULL,
	`band` varchar(8) NOT NULL,
	`mode` varchar(8) NOT NULL DEFAULT 'SSB',
	`freqKhz` double,
	`qsoTime` double,
	`rstSent` varchar(8),
	`rstRcvd` varchar(8),
	`exchangeSent` varchar(32),
	`exchangeRcvd` varchar(32),
	`cqZone` int,
	`countryPrefix` varchar(8),
	`wpxPrefix` varchar(12),
	`continent` varchar(4),
	`isNewMulti` int DEFAULT 0,
	`multiType` varchar(16),
	`multiValue` varchar(32),
	`stationName` varchar(16),
	`isRunQso` int DEFAULT 0,
	`externalId` varchar(32),
	`deleted` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contest_qsos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `contest_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contestId` varchar(32) NOT NULL,
	`category` varchar(32) NOT NULL,
	`power` varchar(16) NOT NULL DEFAULT 'HIGH',
	`mycall` varchar(16) NOT NULL DEFAULT 'F4IVV',
	`startTime` double,
	`endTime` double,
	`active` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contest_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dxcc_worked` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitorId` varchar(128) NOT NULL,
	`dxccCode` varchar(16) NOT NULL,
	`band` varchar(8) NOT NULL,
	`mode` varchar(16) NOT NULL DEFAULT 'SSB',
	`dxCall` varchar(32),
	`workedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dxcc_worked_id` PRIMARY KEY(`id`),
	CONSTRAINT `visitor_dxcc_band_mode_uniq` UNIQUE(`visitorId`,`dxccCode`,`band`,`mode`)
);
--> statement-breakpoint
CREATE TABLE `oob_spots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitorId` varchar(128) NOT NULL,
	`dxCall` varchar(32) NOT NULL,
	`freqKhz` int NOT NULL,
	`contestId` varchar(64) NOT NULL DEFAULT 'IARU-HF-2026',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `oob_spots_id` PRIMARY KEY(`id`),
	CONSTRAINT `visitor_call_freq_uniq` UNIQUE(`visitorId`,`dxCall`,`freqKhz`,`contestId`)
);
--> statement-breakpoint
CREATE TABLE `propagation_ft8_hourly` (
	`id` int AUTO_INCREMENT NOT NULL,
	`snapDate` varchar(10) NOT NULL,
	`hourUtc` int NOT NULL,
	`minuteUtc` int NOT NULL DEFAULT 0,
	`band` varchar(8) NOT NULL,
	`continent` varchar(4) NOT NULL,
	`spotCount` int NOT NULL DEFAULT 0,
	`avgSnr` double,
	`maxSnr` double,
	`dominantAzimuth` int,
	`sfi` int,
	`kp` double,
	`receiverSource` varchar(12) NOT NULL DEFAULT 'WORLD',
	`receiverCall` varchar(16),
	`source` enum('auto','manual') NOT NULL DEFAULT 'auto',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `propagation_ft8_hourly_id` PRIMARY KEY(`id`),
	CONSTRAINT `ft8_quarter_slot_uniq` UNIQUE(`snapDate`,`hourUtc`,`minuteUtc`,`band`,`continent`)
);
--> statement-breakpoint
CREATE TABLE `qso_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitorId` varchar(128) NOT NULL,
	`dxCall` varchar(32) NOT NULL,
	`freqKhz` double NOT NULL,
	`band` varchar(8) NOT NULL,
	`mode` varchar(16) NOT NULL DEFAULT 'SSB',
	`dxCountry` varchar(128),
	`dxccCode` varchar(16),
	`rstSent` varchar(8) DEFAULT '59',
	`rstRcvd` varchar(8) DEFAULT '59',
	`operatorName` varchar(64),
	`notes` text,
	`qsoDateUtc` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `qso_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitorId` varchar(128) NOT NULL,
	`dxccGoal` int DEFAULT 100,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_settings_visitorId_unique` UNIQUE(`visitorId`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`subscription` enum('free','premium') NOT NULL DEFAULT 'free',
	`subscriptionExpiry` timestamp,
	`trialStartDate` timestamp,
	`locator` varchar(8),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `websdr_deleted` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitorId` varchar(128) NOT NULL,
	`sdrName` varchar(255) NOT NULL,
	`sdrUrl` varchar(512) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `websdr_deleted_id` PRIMARY KEY(`id`),
	CONSTRAINT `visitor_del_uniq` UNIQUE(`visitorId`,`sdrName`)
);
--> statement-breakpoint
CREATE TABLE `websdr_favorites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitorId` varchar(128) NOT NULL,
	`sdrName` varchar(255) NOT NULL,
	`sdrUrl` varchar(512) NOT NULL,
	`lat` double,
	`lon` double,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `websdr_favorites_id` PRIMARY KEY(`id`),
	CONSTRAINT `visitor_sdr_uniq` UNIQUE(`visitorId`,`sdrName`)
);
--> statement-breakpoint
CREATE TABLE `worked_calls` (
	`id` int AUTO_INCREMENT NOT NULL,
	`visitorId` varchar(128) NOT NULL,
	`dxCall` varchar(32) NOT NULL,
	`band` varchar(8),
	`contestId` varchar(64) NOT NULL DEFAULT 'IARU-HF-2026',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `worked_calls_id` PRIMARY KEY(`id`),
	CONSTRAINT `visitor_call_band_uniq` UNIQUE(`visitorId`,`dxCall`,`band`,`contestId`)
);
