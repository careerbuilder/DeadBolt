# DeadBolt
A management portal for database user management through active directory.
DeadBolt was created to allow for user Identity and Access Management(IAM) in Amazon RDS, which does not allow for SSH or traditional methods of IAM such as kerberos or LDAP.

##Install##
* Create an Amazon IAM Role with ses:send_email permissions
* Create an EC2 isntance with that Role (alternatively, run aws config on an existing instance)
* Create an accessible MySQL database
* Copy `defaultconfig.json` to `config.json`
* Edit `config.json` for your configuration
The config file should be a json object, with the following layout:

_config.json_
```javascript  
{
  "kmskey": "alias/keyname",
  "DB" : {
    "host"      : "your_database_endpoint",
    "user"      : "your_sausername",
    "password"  : "your_sapassword",
    "database"  : "deadbolt",
    "port"      : 3306//your database port
  },
  "Email":{
    "From": "Deadbolt@yoursite.com"
  },
  /*Only required if you are hosting with HTTPS */
  "SSL": {
    "keyfile": //path to keyfile,
    "certfile"://path to .cert
  }
}

```

* Install npm
* Install bower globally with `npm install -g bower`
* Run `npm install --production`
* Run `db-setup.sql` against your database
* The db-setup script will create a single user, `deadboltsvc`
* Run `node app.js` to start the app. You can also install pm2 and daemonize the app  with `pm2 start app.js --name "deadbolt"` to leave it running.
* Navigate to `https://YOURHOST/#/reset/deadboltsvcreset` and set a password for the username `deadboltsvc`
* Open a browser and navigate to your host. Login as `deadboltsvc`, and start using deadbolt!


##Usage##
Deadbolt manages users and databases via mapping to Groups. Groups represent selections of databases owned which should have the same permissions. The most common usecase would be to create a group for each functional team in your organization. By grouping databases in to one or groups, you allow the users in those groups access.

Start by adding Users in the User tab. The users can be given differing permission levels to any groups to which they need access. Please note, in case of overlap on a server, the more permissive of the assignments will be used. Additionally, you can assign "Group Admin" permissions to a user. This allows the user to log in and manage other users for the group which they administrate. Granting group admin permissions on the "Admin" group gives the user full access to the portal, with the ability to add and remove databases, groups, and users.

Adding Databases is done on the Databases tab, where you can provide connection credentials to allow Deadbolt access to the database.

Databases can be mapped to groups on the Groups tab. Any database in a group will be automatically populated and updated each time the users in the group change.


##Optional AD##
There is a workaround currently to allow pushing users and password changes to an ActiveDirectory. This is still in development, and is not currently supported.


###Currently Supported Systems:###
- [x] MySQL
- [x] Amazon Aurora
- [x] Microsoft SQL server
- [ ] MongoDB
- [ ] Cassandra
- [ ] Postgresql
- [ ] Oracle

_Deadbolt was designed at Careerbuilder for the SiteDB team to maintain users across a variety of database platforms. As such, the ordering of supported databases relies on that team's usecases and the contribution of outside developers._
