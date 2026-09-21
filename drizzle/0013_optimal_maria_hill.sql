CREATE TABLE `cat_commands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payload` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cat_commands_id` PRIMARY KEY(`id`)
);
