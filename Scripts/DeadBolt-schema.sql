CREATE DATABASE `deadbolt` /*!40100 DEFAULT CHARACTER SET utf8 */;
use deadbolt;
CREATE TABLE `databases` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Name` varchar(45) NOT NULL,
  `Host` varchar(100) NOT NULL,
  `Port` int(11) DEFAULT '3306',
  `Type` varchar(45) NOT NULL,
  `SAUser` varchar(45) NOT NULL,
  `SAPass` text NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `Endpoint` (`Host`),
  UNIQUE KEY `Name_UNIQUE` (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `groups` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Name` varchar(45) NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `Name_UNIQUE` (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `groups_databases` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Group_ID` int(11) DEFAULT NULL,
  `Database_ID` int(11) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `no_dup` (`Group_ID`,`Database_ID`),
  KEY `Group_ID_idx` (`Group_ID`),
  KEY `Database_ID_idx` (`Database_ID`),
  CONSTRAINT `Database_ID` FOREIGN KEY (`Database_ID`) REFERENCES `databases` (`ID`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `GroupID` FOREIGN KEY (`Group_ID`) REFERENCES `groups` (`ID`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `history` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `Activity` varchar(4096) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `portal_users` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Salt` varchar(128) NOT NULL,
  `Password` varchar(512) NOT NULL,
  `Email` varchar(45) NOT NULL,
  `Active` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`ID`),
  UNIQUE KEY `Email_UNIQUE` (`Email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `possible_users` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Username` varchar(45) DEFAULT NULL,
  `Email` varchar(100) DEFAULT NULL,
  `FirstName` varchar(45) DEFAULT NULL,
  `LastName` varchar(45) DEFAULT NULL,
  `User_ID` int(11) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `Username_UNIQUE` (`Username`),
  UNIQUE KEY `Email_UNIQUE` (`Email`),
  UNIQUE KEY `User_ID_UNIQUE` (`User_ID`),
  KEY `Added_User_idx` (`User_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `sessions` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Session_ID` varchar(256) NOT NULL,
  `Expires` bigint(16) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `users` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Username` varchar(25) DEFAULT NULL,
  `MySQL_Password` text,
  `SQL_Server_Password` text,
  `Mongo_Password` text,
  `Cassandra_Password` text,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `Username` (`Username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `users_groups` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Group_ID` int(11) NOT NULL,
  `User_ID` int(11) NOT NULL,
  `Permissions` enum('SU','DBA','RW','RO') DEFAULT 'RO',
  PRIMARY KEY (`ID`),
  UNIQUE KEY `no_dup` (`Group_ID`,`User_ID`),
  KEY `Group_ID_idx` (`Group_ID`),
  KEY `User_ID_idx` (`User_ID`),
  CONSTRAINT `Group_ID` FOREIGN KEY (`Group_ID`) REFERENCES `groups` (`ID`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `User_ID` FOREIGN KEY (`User_ID`) REFERENCES `users` (`ID`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE `errors` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Username` varchar(45) NOT NULL,
  `Database` varchar(200) NOT NULL,
  `Title` varchar(256) NOT NULL,
  `Details` longtext,
  `Acknowledged` tinyint(1) NOT NULL DEFAULT '0',
  `Retryable` tinyint(1) NOT NULL DEFAULT '0',
  `Class` varchar(45) NOT NULL DEFAULT 'Info',
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

Insert Into groups (ID, Name) Values(-1, "Admin");
