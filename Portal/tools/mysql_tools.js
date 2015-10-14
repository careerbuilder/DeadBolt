var mysql = require('mysql');
var async = require('async');
var encryption = require('../middleware/encryption');

module.exports = {
  update_users: function(db, affected_users, gospel_users, top_callback){
    var dbinfo = db;
    var errors = [];
    var users = affected_users;
    var mysql_pool;
    var g_users = {};
    gospel_users.forEach(function(gu, i){
      g_users[gu.Username] = gu;
    });
    async.waterfall([
      function(callback){
        encryption.decrypt(dbinfo.SAPass, function(err, data){
          if(err){
            console.log(err);
            users.forEach(function(err_user, i){
              errors.push({User: err_user, Database: dbinfo, Error:{Title: "Decryption Error", Details: err}, Retryable:false, Class:"Error"});
            });
            return top_callback(errors);
          }
          callback(null, data);
        });
      },
      function(plainpass, callback){
        mysql_pool = mysql.createPool({
          host     : dbinfo.Host,
          user     : dbinfo.SAUser,
          password : plainpass,
          database : 'mysql',
          port	   : dbinfo.Port,
          acquireTimeout: 60000
        });
        mysql_pool.getConnection(function(err, connection) {
          if(err) {
            console.log("Connection Error on DB " + dbinfo.Name +": " + err);
            users.forEach(function(err_user, i){
              errors.push({User: err_user, Database: dbinfo, Error:{Title: "Connection Error", Details: err}, Retryable:true, Class:"Error"});
            });
            return top_callback(errors);
          }
          return callback(null, connection);
        });
      },
      function(mysql_connection, series_callback){
        async.eachSeries(users, function(userobj, callback){
          var dropped = false;
          var username = userobj.Username;
          var user = {Username: username};
          if(username in g_users){
            user = g_users[username];
          }
          var user_exists_query = 'SELECT Host, plugin from mysql.user where user=?';
          mysql_connection.query(user_exists_query, [user.Username], function(err, results){
            if(err){
              console.log("Select exists failed! Error on DB " + dbinfo.Name +": " + err);
              errors.push({User: user, Database: dbinfo, Error:{Title: "Failed to query database", Details:err}, Retryable:true, Class:"Error"});
              return callback();
            }
            else {
              var user_query = "";
              var user_log = "";
              var user_log2= "";
              var new_user = false;
              if(results.length <1){
                if(user.MySQL_Password){
                  user_log = "Creating user " + user.Username + " on " + dbinfo.Name;
                  user_query = 'Create User ? Identified by password ?;';
                  user_log2="Creating localhost user " + user.Username + " on " + dbinfo.Name;
                  user_query2 = "Create User ?@'localhost' Identified by password ?;";
                }
                else{
                  console.log("User " + user.Username + " does not exist on " + dbinfo.Name +" and cannot be removed");
                  errors.push({User: user, Database: dbinfo, Error:{Title: "User does not Exist and cannot be dropped", Details:" "}, Retryable:false, Class:"Info"});
                  return callback();
                }
              }
              else{
                var all_exists = false;
                var local_exists = false;
                var auth_drops = [];
                results.forEach(function(r, i){
                  if(r.Host === '%'){
                    if(r.plugin.search(/auth_pam/i)>-1){
                      console.log(dbinfo.Name, r.Host, r.plugin);
                      auth_drops.push(user.Username+'@'+"'"+r.Host+"'");
                      all_exists = false;
                    }
                    else{
                      all_exists = true;
                    }
                  }
                  else if(r.Host == 'localhost'){
                    if(r.plugin.search(/auth_pam/i)>-1){
                      console.log(dbinfo.Name, r.Host, r.plugin);
                      auth_drops.push(user.Username+'@'+"'"+r.Host+"'");
                      local_exists = false;
                    }
                    else{
                      local_exists = true;
                    }
                  }
                  else{
                    console.log(dbinfo.Name, r.Host, r.plugin);
                    auth_drops.push(user.Username+'@'+"'"+r.Host+"'");
                  }
                });
                if(all_exists){
                  if(user.MySQL_Password){
                    user_log='Updating ' + user.Username +' on ' + dbinfo.Name;
                    user_query = 'Set PASSWORD for ? = ?;';
                  }
                  else{
                    user_log="Dropping user " + user.Username +" on " + dbinfo.Name;
                    user_query = 'Drop User ?;';
                    dropped = true;
                  }
                }
                else{
                  if(user.MySQL_Password){
                    user_log="Creating user " + user.Username + " on " + dbinfo.Name;
                    user_query = 'Create User ? Identified by password ?;';
                  }
                  else{
                    user_log="User " + user.Username + " does not exist on " + dbinfo.Name +" and cannot be removed";
                    user_query = 'Set @dummy1=?';
                  }
                }
                if(local_exists){
                  if(user.MySQL_Password){
                    user_log2='Updating Localhost ' + user.Username +' on ' + dbinfo.Name;
                    user_query2 = "Set PASSWORD for ?@'localhost' = ?;"
                  }
                  else{
                    user_log2="Dropping localhost user " + user.Username +" on " + dbinfo.Name;
                    user_query2 = "Drop User ?@'localhost';";
                    dropped = true;
                  }
                }
                else{
                  if(user.MySQL_Password){
                    user_log2="Creating localhost user " + user.Username + " on " + dbinfo.Name;
                    user_query2 = "Create User ?@'localhost' Identified by password ?;";
                  }
                  else{
                    user_log2="Localhost User " + user.Username + " does not exist on " + dbinfo.Name +" and cannot be removed";
                    user_query2 = 'Set @dummy2=?';
                  }
                }
              }
              var hash_pass= "";
              async.series([
                function(cb){
                  if(user.MySQL_Password){
                    encryption.decrypt(user.MySQL_Password, function(err, data){
                      if(err){
                        console.log(err);
                        errors.push({User: user, Database: dbinfo, Error:{Title: "Error Decrypting User password", Details: err}, Retryable:false, Class:"Error"});
                        return callback();
                      }
                      hash_pass = data;
                      cb();
                    });
                  }
                  else{
                    cb();
                  }
                },
                function(cb){
                  if(auth_drops && auth_drops.length > 0){
                    console.log("Dropping nonstandard logins");
                    var pre_drop = "Drop User ";
                    auth_drops.forEach(function(u, i){
                      pre_drop += (u + ', ');
                    });
                    pre_drop = pre_drop.substring(0, pre_drop.length-2) +';'
                    mysql_connection.query(pre_drop, function(err, res){
                      if(err){
                        console.log(err);
                        errors.push({User: user, Database: dbinfo, Error:{Title: "Failed to drop nonstandard auth users", Details: err}, Retryable:false, Class:"Error"});
                        return callback();
                      }
                      return cb()
                    });
                  }
                  else{
                    return cb();
                  }
                },
                function(cb){
                  console.log(user_log);
                  mysql_connection.query(user_query, [user.Username, hash_pass], function(err, result){
                    if(err){
                      console.log("User Operation Failed! Error on DB " + dbinfo.Name +": " + err);
                      errors.push({User: user, Database: dbinfo, Error:{Title:"Database Error on "+user_log, Details: err}, Retryable:true, Class:"Error"});
                      return callback();
                    }
                    cb();
                  });
                },
                function(cb){
                  console.log(user_log2);
                  mysql_connection.query(user_query2, [user.Username, hash_pass], function(err, result){
                    if(err){
                      console.log("Localhost User Operation Failed! Error on DB " + dbinfo.Name +": " + err);
                      errors.push({User: user, Database: dbinfo, Error:{Title:"Database Error on "+user_log2, Details: err}, Retryable:true, Class:"Error"});
                      return callback();
                    }
                    cb();
                  });
                },
                function(cb){
                  if(!dropped){
                    mysql_connection.query("Revoke ALL PRIVILEGES, GRANT OPTION FROM ?, ?@'localhost'", [user.Username, user.Username], function(err, results){
                      if(err){
                        console.log("Privileges Error on DB " + dbinfo.Name +": " + err);
                        errors.push({User: user, Database: dbinfo, Error:{Title:"Error revoking permissions", Details: err}, Retryable:true, Class:"Error"});
                        return callback();
                      }
                      var permissions_query;
                      if(user.Permissions === "SU"){
                        permissions_query = "GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, RELOAD, PROCESS, REFERENCES, INDEX, ALTER, SHOW DATABASES, CREATE TEMPORARY TABLES, LOCK TABLES, EXECUTE, REPLICATION SLAVE, REPLICATION CLIENT, CREATE VIEW, SHOW VIEW, CREATE ROUTINE, ALTER ROUTINE, CREATE USER, EVENT, TRIGGER ON *.* TO ?, ?@'localhost' WITH GRANT OPTION";
                      }
                      else if(user.Permissions === "DBA"){
                        permissions_query = "GRANT ALL on `%`.* TO ?, ?@'localhost'";
                      }
                      else if(user.Permissions === "RW"){
                        permissions_query = "Grant SELECT, INSERT, UPDATE, DELETE, EXECUTE, SHOW VIEW, CREATE TEMPORARY TABLES ON `%`.* TO ?, ?@'localhost'";
                      }
                      else if(user.Permissions === "RO"){
                        permissions_query = "Grant SELECT ON `%`.* TO ?, ?@'localhost'";
                      }
                      else{
                        permissions_query = "Grant USAGE ON `%`.* TO ?, ?@'localhost'";
                      }
                      async.series([
                        function(cb2){
                          mysql_connection.query(permissions_query, [user.Username, user.Username], function(err, result){
                            if(err){
                              console.log("Privileges Error on DB " + dbinfo.Name +": " + err);
                              errors.push({User: user, Database: dbinfo, Error:{Title:"Error granting permissions", Details: err}, Retryable:true, Class:"Error"});
                              return callback();
                            }
                            cb2();
                          });
                        },
                        function(cb2){
                          if(user.Permissions === "SU"){
                            mysql_connection.query("Grant SUPER ON *.* TO ?, ?@'localhost' WITH GRANT OPTION", [user.Username, user.Username], function(err, result){
                              if(err){
                                console.log("Privileges Error on DB " + dbinfo.Name +": " + err);
                                errors.push({User: user, Database: dbinfo, Error:{Title:"Error granting SUPER permissions", Details: {Error: err, Tip: "If this database is in Amazon RDS, this error can be ignored"}}, Retryable:false, Class:"Warning"});
                                return callback();
                              }
                              cb2();
                            });
                          }
                          else{
                            cb2();
                          }
                        }
                      ],
                      function(err, results){
                        cb();
                      });
                    });
                  }
                  else{
                    cb();
                  }
                }
              ], function(err, results){
                callback();
              });
            }
          });
        },
        function(err){
          console.log('---------------------------\nEND OPERATIONS FOR ' + dbinfo.Name +'\n---------------------------');
          mysql_connection.release();
          return series_callback(null, errors);
        });
      }],
      function(err, results){
        if(mysql_pool){
          mysql_pool.end();
        }
        top_callback(results)
    });
  }
};
