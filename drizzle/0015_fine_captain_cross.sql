CREATE TABLE `cat_relay_state` (
	`stateKey` varchar(32) NOT NULL,
	`payload` text NOT NULL,
	`updatedAt` timestamp(3) NOT NULL,
	CONSTRAINT `cat_relay_state_stateKey` PRIMARY KEY(`stateKey`)
);
