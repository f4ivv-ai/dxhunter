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
