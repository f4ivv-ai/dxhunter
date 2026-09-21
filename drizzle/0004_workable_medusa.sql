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
