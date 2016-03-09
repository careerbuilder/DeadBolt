Create Schema IF NOT EXISTS `passwordportal`;

CREATE TABLE IF NOT EXISTS `users` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Username` varchar(128) NOT NULL,
  `Email` varchar(200) DEFAULT NULL,
  `FirstName` varchar(45) DEFAULT NULL,
  `LastName` varchar(45) DEFAULT NULL,
  `IsAdmin` tinyint(1) NOT NULL DEFAULT '0',
  `IsSVC` tinyint(1) NOT NULL DEFAULT '0',
  `Reset_ID` varchar(100) DEFAULT NULL,
  `Active` tinyint(1) NOT NULL DEFAULT '0',
  `Salt` varchar(100) DEFAULT NULL,
  `Password` varchar(256) DEFAULT NULL,
  PRIMARY KEY (`ID`),
  UNIQUE KEY `Username_UNIQUE` (`Username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `sessions` (
  `ID` int(11) NOT NULL AUTO_INCREMENT,
  `Session_ID` varchar(100) DEFAULT NULL,
  `User_ID` int(11) NOT NULL,
  `Expires` bigint(20) DEFAULT NULL,
  `Active` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`ID`),
  UNIQUE KEY `User_ID_UNIQUE` (`User_ID`),
  KEY `sessionuser_idx` (`User_ID`),
  CONSTRAINT `sessionuser` FOREIGN KEY (`User_ID`) REFERENCES `users` (`ID`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
