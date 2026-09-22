CREATE TABLE `rotor_commands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payload` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rotor_commands_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rotor_relay_state` (
	`stateKey` varchar(32) NOT NULL,
	`payload` text NOT NULL,
	`updatedAt` timestamp(3) NOT NULL,
	CONSTRAINT `rotor_relay_state_stateKey` PRIMARY KEY(`stateKey`)
);
