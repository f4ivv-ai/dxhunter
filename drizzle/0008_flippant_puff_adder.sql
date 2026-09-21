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
