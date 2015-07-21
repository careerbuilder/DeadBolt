var mssql = require('mssql');
var async = require('async');
var encryption = require('./encryption');

module.exports = {
  update_users: function(db, affected_users, gospel_users, callback){
    var dbinfo = db;
    var errors = [];
    var g_users = {};
    gospel_users.forEach(function(gu, i){
      g_users[gu.Username] = gu;
    });
    var conn;
    var exists;
    async.waterfall([
      function(cb){
        encryption.decrypt(dbinfo.SAPass, function(err, data){
          if(err){
            console.log(err);
            affected_users.forEach(function(user, i){
              errors.push({User: err_user, Database: dbinfo, Error:{Title: "Could not decrypt SA Password", Details: err}, Retryable:true, Class:"Error"});
            });
            return cb(err);
          }
          cb(null, data);
        });
      },
      function(plainpass, cb){
        conn = new mssql.Connection({
          server   : dbinfo.Host,
          user     : dbinfo.SAUser,
          password : plainpass,
          port	   : dbinfo.Port
        }, function(err){
          if(err){
            console.log(err);
            affected_users.forEach(function(user, i){
              errors.push({User: err_user, Database: dbinfo, Error:{Title: "Connection Error", Details: err}, Retryable:true, Class:"Error"});
            });
            return cb(err);
          }
          cb();
        })
      },
      function(cb){
        async.each(affected_users, function(userobj, each_cb){
          var user = {Username: userobj.Username};
          if(user.Username in g_users){
            user = g_users[user.Username];
          }
          async.series([
            function(inner_cb){
              if(user.SQL_Server_Password){
                //add login
                console.log("Creating or Updating login for ", user.Username);
                var trans = new mssql.Transaction(conn);
                trans.begin(function(err){
                  var request = new mssql.Request(trans);
                  request.input('username', mssql.NVarChar, user.Username);
                  request.query("IF Exists (SELECT * FROM syslogins WHERE name= ''" + user.Username + "'') \
                  CREATE Login [" + user.Username + "] WITH password=" + user.SQL_Server_Password + " HASHED, CHECK_POLICY=OFF, CHECK_EXPIRATION=OFF \
                  ELSE ALTER LOGIN [" + user.Username + "] WITH PASSWORD=" + user.SQL_Server_Password + " HASHED, CHECK_POLICY=OFF, CHECK_EXPIRATION=OFF", function(err, records){
                    console.log(records);
                    trans.commit(function(err) {
                        if(err){
                          console.log(err);
                          errors.push({User: user, Database: dbinfo, Error:{Title: "Failed to Add or Update Login", Details:err}, Retryable:true, Class:"Error"})
                        }
                        return inner_cb();
                    });
                  });
                });
              }
              //if user not in gospel
              else{
                //attempt to drop login
                console.log("Dropping login for ", user.Username);
                var trans = new mssql.Transaction(conn);
                trans.begin(function(err){
                  var request = new mssql.Request(trans);
                  request.input('username', mssql.NVarChar, user.Username);
                  request.query("IF Exists (SELECT * FROM syslogins WHERE name= ''" + user.Username + "'') DROP LOGIN [" + user.Username + "]", function(err, records){
                    console.log(records);
                    trans.commit(function(err) {
                        if(err){
                          console.log(err);
                          errors.push({User: user, Database: dbinfo, Error:{Title: "Failed to Drop Login", Details:err}, Retryable:true, Class:"Error"})
                        }
                        return inner_cb();
                    });
                  });
                });
              }
            },
            function(inner_cb){
              //drop all permissions
              console.log("Dropping all permissions for ", user.Username);
              var revoke ="SET NOCOUNT ON \
              DECLARE @SQL VARCHAR(MAX) \
              SET @SQL = '' \
              SELECT @SQL = @SQL + 'USE ' + name + '; \
              IF Exists (SELECT * FROM sys.database_principals WHERE name=''" + user.Username + "'') \
                BEGIN \
                  ALTER ROLE DB_DATAREADER Drop MEMBER [" + user.Username + "]; \
                  ALTER ROLE DB_DATAWRITER Drop MEMBER [" + user.Username + "]; \
                  ALTER ROLE DB_OWNER DROP MEMBER [" + user.Username + "]; \
                  REVOKE SHOWPLAN FROM [" + user.Username + "]; \
                  REVOKE VIEW DATABASE STATE FROM [" + user.Username + "]; \
                  REVOKE VIEW DEFINITION FROM [" + user.Username + "]; \
                END' \
              FROM MASTER.SYS.DATABASES WHERE database_id > 4 AND state_desc = 'ONLINE' AND name not like '%rdsadmin%' \
              EXEC(@SQL)";
              var trans = new mssql.Transaction(conn);
              trans.begin(function(err){
                var request = new mssql.Request(trans);
                request.input('username', mssql.NVarChar, user.Username);
                request.query(revoke, function(err, records){
                  console.log(records);
                  trans.commit(function(err) {
                    if(err){
                      console.log(err);
                      errors.push({User: user, Database: dbinfo, Error:{Title: "Failed to revoke permissions", Details:err}, Retryable:true, Class:"Error"});
                    }
                    return inner_cb();
                  });
                });
              });
            },
            function(inner_cb){
              if(user.SQL_Server_Password){
                //generate permissions
                var sql_roles = "ALTER ROLE DB_DATAREADER ADD MEMBER [" + user.Username + "];\n";
                if(user.Permissions === 'RW' || user.Permissions === 'DBA' || user.Permissions === 'SU'){
                  sql_roles += "ALTER ROLE DB_DATAWRITER ADD MEMBER [" + user.Username + "];\n";
                }
                if(user.Permissions === 'DBA' || user.Permissions === 'SU'){
                  sql_roles += "ALTER ROLE DB_OWNER ADD MEMBER [" + user.Username + "];\n";
                }
                console.log("New Permissions for ", user.Username, "\n", sql_roles);
                //update permissions
                var grant = "SET NOCOUNT ON \
                DECLARE @SQL VARCHAR(MAX) \
                SET @SQL = '' \
                SELECT @SQL = @SQL + 'USE ' + name + '; \
                IF Exists (SELECT * FROM sys.database_principals WHERE name=''" + user.Username + "'') \
                BEGIN " + sql_roles + " \
                GRANT VIEW DATABASE STATE TO [" + user.Username + "]; \
                GRANT VIEW DEFINITION TO [" + user.Username + "]; \
                END' \
                FROM MASTER.SYS.DATABASES WHERE database_id > 4 AND state_desc = 'ONLINE' AND name not like '%rdsadmin%' \
                EXEC(@SQL)";
                var trans = new mssql.Transaction(conn);
                trans.begin(function(err){
                  var request = new mssql.Request(trans);
                  request.input('username', mssql.NVarChar, user.Username);
                  request.query(grant, function(err, records){
                    console.log(records);
                    trans.commit(function(err) {
                      if(err){
                        console.log(err);
                        errors.push({User: user, Database: dbinfo, Error:{Title: "Failed to grant permissions", Details:err}, Retryable:true, Class:"Error"});
                      }
                      return inner_cb();
                    });
                  });
                });
              }
              else{
                console.log("Dropping ", user.Username);
                var drop ="SET NOCOUNT ON \
                DECLARE @SQL VARCHAR(MAX) \
                SET @SQL = '' \
                SELECT @SQL = @SQL + 'USE ' + name + '; \
                IF Exists (SELECT * FROM sys.database_principals WHERE name=''" + user.Username + "'') \
                DROP USER [" + user.Username + "];' \
                FROM MASTER.SYS.DATABASES WHERE database_id > 4 AND state_desc = 'ONLINE' AND name not like '%rdsadmin%' \
                EXEC(@SQL)";
                var trans = new mssql.Transaction(conn);
                trans.begin(function(err){
                  var request = new mssql.Request(trans);
                  request.input('username', mssql.NVarChar, user.Username);
                  request.query(drop, function(err, records){
                    console.log(records);
                    trans.commit(function(err) {
                      if(err){
                        console.log(err);
                        errors.push({User: user, Database: dbinfo, Error:{Title: "Failed to drop user", Details:err}, Retryable:true, Class:"Error"});
                      }
                      return inner_cb();
                    });
                  });
                });
              }
            }
          ], function(err, results){
            if(err){
              console.log(err);
            }
            return each_cb();
          });
        }, function(err){
          cb(null, errors);
        });
      }
    ], function(err, results){
      if(err){
        return callback(errors);
      }
      callback(results);
    });
  }
};
