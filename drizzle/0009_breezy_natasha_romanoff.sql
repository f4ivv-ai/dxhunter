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
