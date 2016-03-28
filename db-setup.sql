-- Copyright 2016 CareerBuilder, LLC
-- Licensed under the Apache License, Version 2.0 (the "License");
-- you may not use this file except in compliance with the License.
-- You may obtain a copy of the License at
--
--     http://www.apache.org/licenses/LICENSE-2.0
-- Unless required by applicable law or agreed to in writing, software
-- distributed under the License is distributed on an "AS IS" BASIS,
-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-- See the License for the specific language governing permissions and limitations under the License.


CREATE DATABASE IF NOT EXISTS `deadbolt` /*!40100 DEFAULT CHARACTER SET utf8 */;
USE deadbolt;

CREATE TABLE IF NOT EXISTS `databases` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Name` varchar(45) NOT NULL,
  `Host` varchar(100) NOT NULL,
  `Port` int(11) DEFAULT '3306',
  `Type` varchar(45) NOT NULL,
  `SAUser` varchar(45) NOT NULL,
  `SAPass` text NOT NULL,
  `ForceSSL` tinyint(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`ID`),
  UNIQUE KEY `Endpoint` (`Host`),
  UNIQUE KEY `Name_UNIQUE` (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `history` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `Activity` varchar(4096) NOT NULL,
  PRIMARY KEY (`ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `errors` (
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

CREATE TABLE IF NOT EXISTS `groups` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Name` varchar(45) NOT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `Name_UNIQUE` (`Name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

INSERT INTO `groups` (`ID`, `Name`) VALUES (-1, 'Admin');

CREATE TABLE IF NOT EXISTS `groups_databases` (
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

CREATE TABLE IF NOT EXISTS `users` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Username` varchar(45) DEFAULT NULL,
  `Email` varchar(200) DEFAULT NULL,
  `FirstName` varchar(128) DEFAULT NULL,
  `LastName` varchar(128) DEFAULT NULL,
  `MySQL_Password` text,
  `SQL_Server_Password` text,
  `Mongo_Password` text,
  `Cassandra_Password` text,
  `Portal_Password` text,
  `Portal_Salt` varchar(128) DEFAULT NULL,
  `Active` tinyint(1) DEFAULT '0',
  `Reset_ID` varchar(128) DEFAULT NULL,
  `IsSVC` tinyint(1) NOT NULL DEFAULT '0',
  `Expires` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `Username_UNIQUE` (`Username`),
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

INSERT INTO `users` (`ID`, `Username`, `Reset_ID`, `Active`, `IsSVC`) VALUES(-1, 'deadboltsvc', 'deadboltsvcreset', 1, 1);

CREATE TABLE IF NOT EXISTS `sessions` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Session_ID` varchar(256) NOT NULL,
  `Expires` bigint(16) NOT NULL,
  `User_ID` int(11) NOT NULL,
  PRIMARY KEY (`ID`),
  KEY `UserSession_idx` (`User_ID`),
  CONSTRAINT `User_Session` FOREIGN KEY (`User_ID`) REFERENCES `users` (`ID`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `users_groups` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Group_ID` int(11) NOT NULL,
  `User_ID` int(11) NOT NULL,
  `Permissions` enum('SU','DBA','RW','RO') DEFAULT 'RO',
  `GroupAdmin` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`ID`),
  UNIQUE KEY `no_dup` (`Group_ID`,`User_ID`),
  KEY `Group_ID_idx` (`Group_ID`),
  KEY `User_ID_idx` (`User_ID`),
  CONSTRAINT `Group_ID` FOREIGN KEY (`Group_ID`) REFERENCES `groups` (`ID`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `User_ID` FOREIGN KEY (`User_ID`) REFERENCES `users` (`ID`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

INSERT INTO `users_groups` (`ID`, `Group_ID`, `User_ID`, `Permissions`, `GroupAdmin`) VALUES (-1, -1, -1, 'RO', 1);
