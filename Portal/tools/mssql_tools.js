var async = require('async');
var encryption = require('../middleware/encryption.js');
var mssql_connection = require('../middleware/mssql.js');

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
              errors.push({User: user, Database: dbinfo, Error:{Title: "Could not decrypt SA Password", Details: err}, Retryable:true, Class:"Error"});
            });
            return callback(errors);
          }
          cb(null, data);
        });
      },
      function(plainpass, cb){
        mssql_connection.connect({
          server   : dbinfo.Host,
          user     : dbinfo.SAUser,
          password : plainpass,
          port	   : dbinfo.Port
        }, function(err, connection){
          if(err){
            console.log(err);
            affected_users.forEach(function(user, i){
              errors.push({User: user, Database: dbinfo, Error:{Title: "Connection Error", Details: err}, Retryable:true, Class:"Error"});
            });
            return callback(errors);
          }
          conn = connection;
          cb();
        });
      },
      function(cb){
        async.each(affected_users, function(userobj, each_cb){
          var user = {Username: userobj.Username};
          if(user.Username in g_users){
            user = g_users[user.Username];
          }
          var user_pass;
          async.series([
            function(inner_cb){
              if(user.SQL_Server_Password){
                encryption.decrypt(user.SQL_Server_Password, function(err, result){
                  if(err){
                    errors.push({User: user, Database: dbinfo, Error:{Title: "User Password could not be decrypted", Details:err}, Retryable:false, Class:"Error"});
                    return inner_cb(err);
                  }
                  user_pass = result;
                  return inner_cb();
                });
              }
              else{
                return inner_cb();
              }
            },
            function(inner_cb){
              var valid = true;
              var inputs = {
                Username: user.Username,
                Password: user_pass
              };
              var attempt = "";
              for(var field in inputs){
                var val = inputs[field];
                if(val && !val.match(/^[a-z0-9]+$/i)){
                  valid = false;
                  attempt = val;
                  break;
                }
              }
              if(!valid){
                errors.push({User: user, Database: dbinfo, Error:{Title: "SQL Injection Attempt!", Details:'User has a field containing invlaid characters, possibly for malicious purposes'}, Retryable:false, Class:"Warning"});
                return inner_cb('SQL Injection attempt!\n\t' + attempt);
              }
              else{
                return inner_cb();
              }
            },
            function(inner_cb){
              var login_query = "IF Exists (SELECT * FROM syslogins WHERE name= '" + user.Username + "') DROP LOGIN [" + user.Username + "]";
              var operation = "Drop Login";
              if(user.SQL_Server_Password){
                login_query = "IF NOT Exists (SELECT * FROM sys.syslogins WHERE name= '" + user.Username + "') \
                CREATE Login [" + user.Username + "] WITH password=" + user_pass + " HASHED, CHECK_POLICY=OFF, CHECK_EXPIRATION=OFF \
                ELSE ALTER LOGIN [" + user.Username + "] WITH PASSWORD=" + user_pass + " HASHED, CHECK_POLICY=OFF, CHECK_EXPIRATION=OFF";
                operation = "Add or Update Login";
              }
              console.log("Beginning " + operation + " for ", user.Username);
              mssql_connection.query(conn, login_query, function(err, results){
                if(err){
                  errors.push({User: user, Database: dbinfo, Error:{Title: "Failed to "+operation, Details:err}, Retryable:false, Class:"Error"});
                  return inner_cb(err);
                }
                return inner_cb();
              });
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
              END; \
              ' \
              FROM MASTER.SYS.DATABASES WHERE database_id > 4 AND state_desc = 'ONLINE' AND name not like '%rdsadmin%' \
              EXEC(@SQL)";
              mssql_connection.query(conn, revoke, function(err, records){
                if(err){
                  errors.push({User: user, Database: dbinfo, Error:{Title: "Failed to revoke permissions", Details:err}, Retryable:true, Class:"Error"});
                  return inner_cb(err);
                }
                return inner_cb();
              });
            },
            function(inner_cb){
              //drop server permissions
              console.log("Dropping server permissions for ", user.Username);
              var revoke ="SET NOCOUNT ON \
              DECLARE @SQL VARCHAR(MAX) \
              SET @SQL = 'USE [master] \
                IF Exists (SELECT * FROM sys.server_principals WHERE name=''" + user.Username + "'') \
                BEGIN \
                  ALTER SERVER ROLE [processadmin] DROP MEMBER [" + user.Username +"]; \
                  ALTER SERVER ROLE [setupadmin] DROP MEMBER [" + user.Username +"]; \
                  REVOKE GRANT OPTION FOR ALTER ANY CONNECTION, ALTER ANY CONNECTION, ALTER ANY CONNECTION FROM [" + user.Username + "] CASCADE; \
                  REVOKE GRANT OPTION FOR ALTER ANY LINKED SERVER, ALTER ANY LINKED SERVER FROM [" + user.Username + "] CASCADE; \
                  REVOKE GRANT OPTION FOR ALTER ANY LOGIN, ALTER ANY LOGIN FROM [" + user.Username + "] CASCADE; \
                  REVOKE GRANT OPTION FOR ALTER ANY SERVER ROLE, ALTER ANY SERVER ROLE FROM [" + user.Username + "] CASCADE; \
                  REVOKE GRANT OPTION FOR ALTER SERVER STATE, ALTER SERVER STATE FROM [" + user.Username + "] CASCADE; \
                  REVOKE GRANT OPTION FOR ALTER TRACE, ALTER TRACE FROM [" + user.Username + "] CASCADE; \
                  REVOKE GRANT OPTION FOR CONNECT SQL, CONNECT SQL FROM [" + user.Username + "] CASCADE; \
                  REVOKE GRANT OPTION FOR CREATE ANY DATABASE, CREATE ANY DATABASE FROM [" + user.Username + "] CASCADE; \
                  REVOKE GRANT OPTION FOR VIEW ANY DATABASE, VIEW ANY DATABASE FROM [" + user.Username + "] CASCADE; \
                  REVOKE GRANT OPTION FOR VIEW ANY DEFINITION, VIEW ANY DEFINITION FROM [" + user.Username + "] CASCADE; \
                  REVOKE GRANT OPTION FOR VIEW SERVER STATE, VIEW SERVER STATE FROM [" + user.Username + "] CASCADE; \
                END' \
              EXEC(@SQL)";
              mssql_connection.query(conn, revoke, function(err, records){
                if(err){
                  errors.push({User: user, Database: dbinfo, Error:{Title: "Failed to revoke server permissions", Details:err}, Retryable:true, Class:"Error"});
                  return inner_cb(err);
                }
                return inner_cb();
              });
            },
            function(inner_cb){
              if(user.SQL_Server_Password){
                //generate permissions
                console.log("Generating new permissions for ", user.Username);
                var sql_roles = "ALTER ROLE DB_DATAREADER ADD MEMBER [" + user.Username + "];\n";
                if(user.Permissions === 'RW' || user.Permissions === 'DBA' || user.Permissions === 'SU'){
                  sql_roles += "ALTER ROLE DB_DATAWRITER ADD MEMBER [" + user.Username + "];\n";
                }
                if(user.Permissions === 'DBA' || user.Permissions === 'SU'){
                  sql_roles += "ALTER ROLE DB_OWNER ADD MEMBER [" + user.Username + "];\n";
                }
                //update permissions
                var grant = "SET NOCOUNT ON \
                DECLARE @SQL VARCHAR(MAX) \
                SET @SQL = '' \
                SELECT @SQL = @SQL + 'USE ' + name + '; \
                IF NOT Exists (SELECT * FROM sys.database_principals WHERE name=''" + user.Username + "'') \
                CREATE USER [" + user.Username + "] FOR LOGIN [" + user.Username + "] WITH DEFAULT_SCHEMA=[dbo];" + sql_roles + " \
                GRANT VIEW DATABASE STATE TO [" + user.Username + "]; \
                GRANT VIEW DEFINITION TO [" + user.Username + "]; \
                GRANT SHOWPLAN TO [" + user.Username + "];' \
                FROM MASTER.SYS.DATABASES WHERE database_id > 4 AND state_desc = 'ONLINE' AND name not like '%rdsadmin%' \
                EXEC(@SQL)";
                mssql_connection.query(conn, grant, function(err, records){
                  if(err){
                    errors.push({User: user, Database: dbinfo, Error:{Title: "Failed to grant permissions", Details:err}, Retryable:true, Class:"Error"});
                    return inner_cb(err);
                  }
                  return inner_cb();
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
                mssql_connection.query(conn, drop, function(err, records){
                  if(err){
                    errors.push({User: user, Database: dbinfo, Error:{Title: "Failed to drop user", Details:err}, Retryable:true, Class:"Error"});
                    return inner_cb(err);
                  }
                  return inner_cb();
                });
              }
            },
            function(inner_cb){
              if(user.SQL_Server_Password && user.Permissions === "SU"){
                console.log("Granting server permissions for", user.Username);
                var grant = "SET NOCOUNT ON \
                DECLARE @SQL VARCHAR(MAX) \
                SET @SQL = 'USE [master] \
                IF Exists (SELECT * FROM sys.server_principals WHERE name=''" + user.Username + "'') \
                  BEGIN \
                    ALTER SERVER ROLE [processadmin] ADD MEMBER [" + user.Username +"]; \
                    ALTER SERVER ROLE [setupadmin] ADD MEMBER [" + user.Username +"]; \
                    GRANT ALTER ANY CONNECTION TO [" + user.Username + "]; \
                    GRANT ALTER ANY LINKED SERVER TO [" + user.Username + "]; \
                    GRANT ALTER ANY LOGIN TO [" + user.Username + "]; \
                    GRANT ALTER ANY SERVER ROLE TO [" + user.Username + "]; \
                    GRANT ALTER SERVER STATE TO [" + user.Username + "]; \
                    GRANT ALTER TRACE TO [" + user.Username + "]; \
                    GRANT CONNECT SQL TO [" + user.Username + "]; \
                    GRANT CREATE ANY DATABASE TO [" + user.Username + "]; \
                    GRANT VIEW ANY DATABASE TO [" + user.Username + "]; \
                    GRANT VIEW ANY DEFINITION TO [" + user.Username + "]; \
                    GRANT VIEW SERVER STATE TO [" + user.Username + "]; \
                  END' \
                EXEC(@SQL)";
                mssql_connection.query(conn, grant, function(err, records){
                  if(err){
                    errors.push({User: user, Database: dbinfo, Error:{Title: "Failed to grant Super permissions", Details:err}, Retryable:false, Class:"Warning"});
                    return inner_cb(err);
                  }
                  return inner_cb();
                });
              }
              else{
                return inner_cb();
              }
            }
          ], function(err, results){
            if(err){
              console.log(err);
            }
            return each_cb();
          });
        }, function(err){
          cb();
        });
      }
    ], function(err, results){
      if(conn){
        conn.close();
      }
      console.log('---------------------------\nEND OPERATIONS FOR ' + dbinfo.Name +'\n---------------------------');
      callback(errors);
    });
  },
  test_connection: function(db, callback){
    mssql_connection.connect(db, function(err, test_conn){
      if(err){
        return callback(err, false);
      }
      else{
        test_conn.close();
        return callback(null, true);
      }
    });
  }
};
