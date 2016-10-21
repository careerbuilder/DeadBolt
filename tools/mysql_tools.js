/*
* Copyright 2016 CareerBuilder, LLC
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and limitations under the License.
*/
var mysql = require('mysql');
var async = require('async');
var encryption = require('../middleware/encryption');

module.exports = {
  test_connection: function(db, callback){
    var test_conn = mysql.createConnection(db);
    test_conn.connect(function(err) {
      if (err) {
        return callback(err, false);
      }
      test_conn.end(function(err) {
        return callback(null, true);
      });
    });
  },
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
      function connectSSL(plainpass, callback){
        mysql_pool = mysql.createPool({
          host     : dbinfo.Host,
          user     : dbinfo.SAUser,
          password : plainpass,
          database : 'mysql',
          port	   : dbinfo.Port,
          ssl      : 'Amazon RDS',
          acquireTimeout: 60000
        });
        mysql_pool.getConnection(function(err, connection) {
          if(err) {
            return callback(null, plainpass, err, null);
          }
          else{
            return callback(null, plainpass, null, connection);
          }
        });
      },
      function connectNonSSL(plainpass, err, connection, callback){
        if(connection){
          return callback(null, connection);
        }
        if((err && err.code === 'HANDSHAKE_NO_SSL_SUPPORT') || err.code === 'HANDSHAKE_SSL_ERROR'){
          console.log('Connection does not support SSL. Falling back to insecure connection.');
          mysql_pool.end();
          mysql_pool = mysql.createPool({
            host     : dbinfo.Host,
            user     : dbinfo.SAUser,
            password : plainpass,
            database : 'mysql',
            port	   : dbinfo.Port,
            acquireTimeout: 60000
          });
          mysql_pool.getConnection(function(err2, connection2){
            if(err2) {
              console.log("Connection Error on DB " + dbinfo.Name +": ", err2);
              users.forEach(function(err_user, i){
                errors.push({User: err_user, Database: dbinfo, Error:{Title: "Connection Error", Details: err2}, Retryable:true, Class:"Error"});
              });
              return top_callback(errors);
            }
            return callback(null, connection2);
          });
        }
        else{
          console.log("Connection Error on DB " + dbinfo.Name +": ", err);
          users.forEach(function(err_user, i){
            errors.push({User: err_user, Database: dbinfo, Error:{Title: "Connection Error", Details: err}, Retryable:true, Class:"Error"});
          });
          return top_callback(errors);
        }
      },
      function(mysql_connection, series_callback){
        async.each(users, function(userobj, callback){
          var username = userobj.Username;
          var user = {Username: username};
          if(username in g_users){
            user = g_users[username];
          }
          var user_exists_query = 'SELECT Host from mysql.user where user=?';
          mysql_connection.query(user_exists_query, [user.Username], function(err, results){
            if(err){
              console.log("Select exists failed! Error on DB " + dbinfo.Name +": " + err);
              errors.push({User: user, Database: dbinfo, Error:{Title: "Failed to query database", Details:err}, Retryable:true, Class:"Error"});
              return callback();
            }
            var all_exists = false;
            var local_exists = false;
            results.forEach(function(r, i){
              if(r.Host === '%'){
                all_exists = true;
              }
              else if(r.Host == 'localhost'){
                local_exists = true;
              }
            });
            var user_query = "Set @dummy=1;";
            if(all_exists && local_exists){
              user_query ="Drop User ?, ?@'localhost';";
            }
            else{
              if(all_exists){
                user_query = 'Drop User ?;';
              }
              else if(local_exists){
                user_query2 = "Drop User ?@'localhost';";
              }
              else{
                if(!user.MySQL_Password){
                  return callback();
                }
              }
            }
            var hash_pass= "";
            async.series([
              function(cb){
                mysql_connection.query(user_query, [user.Username, user.Username], function(err, result){
                  if(err){
                    console.log("User Operation Failed! Error on DB " + dbinfo.Name +": ", err);
                    errors.push({User: user, Database: dbinfo, Error:{Title:"Database Error on removing " + user.Username, Details: err}, Retryable:true, Class:"Error"});
                    return callback();
                  }
                  if(user.MySQL_Password){
                    return cb();
                  }
                  else{
                    console.log('Dropped', user.Username);
                    return callback();
                  }
                });
              },
              function(cb){
                encryption.decrypt(user.MySQL_Password, function(err, data){
                  if(err){
                    console.log(err);
                    errors.push({User: user, Database: dbinfo, Error:{Title: "Error Decrypting User password", Details: err}, Retryable:false, Class:"Error"});
                    return callback();
                  }
                  hash_pass = data;
                  return cb();
                });
              },
              function(cb){
                var permissions_query;
                if(user.Permissions === "SU" || user.Permissions === "DBA"){
                  permissions_query = "GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, RELOAD, PROCESS, REFERENCES, INDEX, ALTER, SHOW DATABASES, CREATE TEMPORARY TABLES, LOCK TABLES, EXECUTE, REPLICATION SLAVE, REPLICATION CLIENT, CREATE VIEW, SHOW VIEW, CREATE ROUTINE, ALTER ROUTINE, CREATE USER, EVENT, TRIGGER ON *.* TO ? IDENTIFIED BY PASSWORD ?, ?@'localhost' IDENTIFIED BY PASSWORD ?";
                }
                else if(user.Permissions === "RW"){
                  permissions_query = "Grant SELECT, INSERT, UPDATE, DELETE, EXECUTE, SHOW VIEW, PROCESS, CREATE TEMPORARY TABLES ON *.* TO ? IDENTIFIED BY PASSWORD ?, ?@'localhost' IDENTIFIED BY PASSWORD ?";
                }
                else if(user.Permissions === "RO"){
                  permissions_query = "Grant SELECT ON *.* TO ? IDENTIFIED BY PASSWORD ?, ?@'localhost' IDENTIFIED BY PASSWORD ?";
                }
                else{
                  permissions_query = "Grant USAGE ON *.* TO ? IDENTIFIED BY PASSWORD ?, ?@'localhost' IDENTIFIED BY PASSWORD ?";
                }
                if(dbinfo.ForceSSL && !user.IsSVC){
                  permissions_query += " REQUIRE SSL";
                }
                if(user.Permissions === "SU"){
                  permissions_query += " WITH GRANT OPTION";
                }
                async.series([
                  function(cb2){
                    mysql_connection.query(permissions_query, [user.Username, hash_pass, user.Username, hash_pass], function(err, result){
                      if(err){
                        console.log("Privileges Error on DB " + dbinfo.Name +": " + err);
                        errors.push({User: user, Database: dbinfo, Error:{Title:"Error granting permissions", Details: err}, Retryable:true, Class:"Error"});
                        return callback();
                      }
                      console.log('Added User', user.Username, dbinfo.ForceSSL ? 'with SSL':'');
                      return cb2();
                    });
                  },
                  function(cb2){
                    if(user.Permissions === "SU"){
                      mysql_connection.query("Grant SUPER ON *.* TO ?, ?@'localhost' WITH GRANT OPTION", [user.Username, user.Username], function(err, result){
                        if(err){
                          //console.log("Error granting super permissions on DB " + dbinfo.Name +": " + err);
                          errors.push({User: user, Database: dbinfo, Error:{Title:"Error granting SUPER permissions", Details: {Error: err, Tip: "If this database is in Amazon RDS, this error can be ignored"}}, Retryable:false, Class:"Warning"});
                          return callback();
                        }
                        return cb2();
                      });
                    }
                    else{
                      return cb2();
                    }
                  }
                ],
                function(err, results){
                  return cb();
                });
              }
            ], function(err, results){
              return callback();
            });
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
        top_callback(results);
    });
  }
};
