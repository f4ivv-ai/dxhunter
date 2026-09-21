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
