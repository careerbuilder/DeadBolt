# DeadBolt
A management portal for database user management through active directory.
DeadBolt was created to allow for user Identity and Access Management(IAM) in Amazon RDS, which does not allow for SSH or traditional methods of IAM such as kerberos or LDAP.

##Dependencies##
DeadBolt depends on a couple external tools right now

* MySQL server
* Node
* Angular
* __These dependencies will be replaced by Jumpcloud in the near future__
* Amazon Simple AD
* AD Manage Engine Password Self Service

##Install##

* Create an accessible MySQL database
* Run the .sql script located in `Scripts/` to create the correct schema and tables
* Add the backing database connection info in a new file `Portal/config.json`
The config file should be a json object, with the following layout:

_config.json_
```  
{
  "DB" : {
    "host"      : "your_database_endpoint",
    "user"      : "your_sausername",
    "password"  : "your_sapassword",
    "database"  : "deadbolt",
    "port"      : //your database port
  },
  "SSL": {
    "keyfile": //path to keyfile,
    "certfile"://path to .cert
  }
}
```
* Install the necessary node and angular packages by running `npm install` in `Portal/` and `bower install` in `Portal/client`
* Start the app, and navigate to https://yourhosthere


__Note__ The userlist and portal_users list are meant to be secured, and as such need to be manually populated. We recommend keeping it this way in order to control access.

To add users, simply insert their information in the `possible_users` table in MySQL. To add users with access to the Deadbolt control plane, add a new Email to the `portal_users` table and direct that user to the Signup page on the Deadbolt website. This will prompt them to create a password, giving them access.

Deadbolt was designed at Careerbuilder for the SiteDB team to maintain users across a variety of database platforms. As such, the ordering of supported databases relies on that team's usecases and the contribution of outside developers.

###Currently Supported Systems:###
- [x] MySQL
- [x] Microsoft SQL server
- [ ] MongoDB
- [ ] Cassandra
- [ ] Postgresql
- [ ] Oracle
