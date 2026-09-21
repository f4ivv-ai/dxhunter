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
