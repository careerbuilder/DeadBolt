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
          var dropped = false;
          var user = {Username: userobj.Username};
          if(username in g_users){
            user = g_users[username];
          }
          async.waterfall([
            function(inner_cb){
              var request = conn.request();
              request.input('username', mssql.NVarChar, user.Username);
              request.query("IF EXISTS (SELECT * FROM syslogins WHERE name= @username)	Select 1 as 'exists' Else	select 0 as 'exists'", function(err, records){
                if(err){
                  console.log(err);
                  errors.push({User: err_user, Database: dbinfo, Error:{Title: "Failed to query Database", Details: err}, Retryable:true, Class:"Error"});
                  return inner_cb({Error: "Cannot Query Database", User: user.Username, Database: dbinfo.Name, Details:err});
                }
                exists = records[0].exists;
                return inner_cb();
              });
            },
            function(inner_cb){
              if(user.SQL_Server_Password){
                //add login
                var trans = mssql.Transaction(conn);
                trans.begin(function(err){
                  var request = new mssql.Request(trans);
                  request.input('username', mssql.NVarChar, user.Username);
                  request.query("IF Exists (SELECT * FROM syslogins WHERE name= @username) \
                  CREATE Login @username WITH password=" + user.SQL_Server_Password + " HASHED, CHECK_POLICY=OFF, CHECK_EXPIRATION=OFF \
                  ELSE ALTER LOGIN @username WITH PASSWORD=" + user.SQL_Server_Password + " HASHED, CHECK_POLICY=OFF, CHECK_EXPIRATION=OFF", function(err, records){
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
                var trans = mssql.Transaction(conn);
                trans.begin(function(err){
                  var request = new mssql.Request(trans);
                  request.input('username', mssql.NVarChar, user.Username);
                  request.query("IF Exists (SELECT * FROM syslogins WHERE name= @username) DROP LOGIN @username", function(err, records){
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
              return inner_cb();
            },
            function(inner_cb){
              //drop all permissions
              var revoke ="SET NOCOUNT ON \
              DECLARE @SQL VARCHAR(MAX) \
              SET @SQL = '' \
              SELECT @SQL = @SQL + 'USE ' + name + '; \
              IF Exists (SELECT * FROM sys.database_principals WHERE name=@username) \
                BEGIN \
                  ALTER ROLE DB_DATAREADER Drop MEMBER @username; \
                  ALTER ROLE DB_DATAWRITER Drop MEMBER @username; \
                  ALTER ROLE DB_OWNER DROP MEMBER @username; \
                  REVOKE SHOWPLAN FROM @username; \
                  REVOKE VIEW DATABASE STATE FROM @username; \
                  REVOKE VIEW DEFINITION FROM @username; \
                END' \
              FROM MASTER.SYS.DATABASES WHERE database_id > 4 AND state_desc = 'ONLINE' AND name not like '%rdsadmin%' \
              EXEC(@SQL)";
              var trans = mssql.Transaction(conn);
              trans.begin(function(err){
                var request = new mssql.Request(trans);
                request.input('username', mssql.NVarChar, user.Username);
                request.query(revoke, function(err, records){
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
                var sql_roles = "ALTER ROLE DB_DATAREADER ADD MEMBER @username;\n";
                if(user.Permissions === 'RW' || user.Permissions === 'DBA' || user.Permissions === 'SU'){
                  sql_roles += "ALTER ROLE DB_DATAWRITER ADD MEMBER @username;\n";
                }
                if(user.Permissions === 'DBA' || user.Permissions === 'SU'){
                  sql_roles += "ALTER ROLE DB_OWNER ADD MEMBER @username;\n";
                }
                //update permissions
                var grant = "SET NOCOUNT ON \
                DECLARE @SQL VARCHAR(MAX) \
                SET @SQL = '' \
                SELECT @SQL = @SQL + 'USE ' + name + '; \
                IF Exists (SELECT * FROM sys.database_principals WHERE name=@username) \
                BEGIN " + sql_roles + " \
                GRANT VIEW DATABASE STATE TO @username; \
                GRANT VIEW DEFINITION TO @username; \
                END' \
                FROM MASTER.SYS.DATABASES WHERE database_id > 4 AND state_desc = 'ONLINE' AND name not like '%rdsadmin%' \
                EXEC(@SQL)";
                var trans = mssql.Transaction(conn);
                trans.begin(function(err){
                  var request = new mssql.Request(trans);
                  request.input('username', mssql.NVarChar, user.Username);
                  request.query(grant, function(err, records){
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
                var drop ="SET NOCOUNT ON \
                DECLARE @SQL VARCHAR(MAX) \
                SET @SQL = '' \
                SELECT @SQL = @SQL + 'USE ' + name + '; \
                IF Exists (SELECT * FROM sys.database_principals WHERE name=@username) \
                DROP USER @username;' \
                FROM MASTER.SYS.DATABASES WHERE database_id > 4 AND state_desc = 'ONLINE' AND name not like '%rdsadmin%' \
                EXEC(@SQL)";
                var trans = mssql.Transaction(conn);
                trans.begin(function(err){
                  var request = new mssql.Request(trans);
                  request.input('username', mssql.NVarChar, user.Username);
                  request.query(drop, function(err, records){
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
