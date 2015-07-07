var mysql = require('mysql');
var async = require('async');
var connection = require('../routes/mysql');
var encryption = require('./encryption');

module.exports = {
  update_users: function(db, affected_users, gospel_users, top_callback){
    var dbinfo = db;
    var errors = [];
    var users = affected_users;
    var mysql_pool;
    async.waterfall([
      function(callback){
        encryption.decrypt(dbinfo.SAPass, function(err, data){
          if(err){
            console.log(err);
            callback(err);
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
          callback(null, connection);
        });
      },
      function(mysql_connection, series_callback){
        async.eachSeries(users, function(user, callback){
          if(user.MySQL_Password && user.MySQL_Password.length > 0){
            var user_exists_query = 'SELECT Host, Count(*) as `Exists` from mysql.user where User=? Group by Host;';
            mysql_connection.query(user_exists_query, [user.Username], function(err, results){
              if(err){
                console.log("Select exists failed! Error on DB " + dbinfo.Name +": " + err);
                errors.push({User: user, Database: dbinfo, Error:{Title: "Failed to query database", Details:err}, Retryable:true, Class:"Error"});
              }
              else {
                var user_query = "";
                var user_log = "";
                var user_log2= "";
                var new_user = false;
                if(results.length <1){
                  if(gospel_users.indexOf(user.Username) >=0){
                    user_query = 'Create User ? Identified by password ?;';
                    user_query2 = "Create User ?@'localhost' Identified by password ?;";
                  }
                  else{
                    user_log="User " + user.Username + " does not exist on " + dbinfo.Name +" and cannot be removed";
                    return callback();
                  }
                }
                else{
                  var all_exists = false;
                  var local_exists = false;
                  for(var i=0; i< results.length; i++){
                    if(results[i].Host == '%'){
                      all_exists = results[i].Exists!=0;
                    }
                    if(results[i].Host == 'localhost'){
                      local_exists = results[i].Exists!=0;
                    }
                  }
                  if(all_exists){
                    if(gospel_users.indexOf(user.Username) >=0){
                      user_log='Updating ' + user.Username +' on ' + dbinfo.Name;
                      user_query = 'Set PASSWORD for ? = ?;';
                    }
                    else{
                      user_log="Dropping user " + user.Username +" on " + dbinfo.Name;
                      user_query = 'Drop User ?;';
                    }
                  }
                  else{
                    if(gospel_users.indexOf(user.Username) >=0){
                      user_log="Creating user " + user.Username + " on " + dbinfo.Name;
                      user_query = 'Create User ? Identified by password ?;';
                    }
                    else{
                      user_log="User " + user.Username + " does not exist on " + dbinfo.Name +" and cannot be removed";
                      user_query = 'Set @dummy1=?';
                    }
                  }
                  if(local_exists){
                    if(gospel_users.indexOf(user.Username) >=0){
                      user_log2='Updating Localhost ' + user.Username +' on ' + dbinfo.Name;
                      user_query2 = "Set PASSWORD for ?@'localhost' = ?;"
                    }
                    else{
                      user_log2="Dropping localhost user " + user.Username +" on " + dbinfo.Name;
                      user_query2 = "Drop User ?@'localhost';";
                    }
                  }
                  else{
                    if(gospel_users.indexOf(user.Username) >=0){
                      user_log2="Creating localhost user " + user.Username + " on " + dbinfo.Name;
                      user_query2 = "Create User ?@'localhost' Identified by password ?;";
                    }
                    else{
                      user_log2="Localhost User " + user.Username + " does not exist on " + dbinfo.Name +" and cannot be removed";
                      user_query2 = 'Set @dummy1=?';
                    }
                  }
                }
                encryption.decrypt(user.MySQL_Password, function(err, data){
                  if(err){
                    console.log(err);
                    errors.push({User: user, Database: dbinfo, Error:{Title: "Error Decrypting User password", Details: err}, Retryable:true, Class:"Error"});
                  }
                  var hash_pass = data;
                  console.log(user_log);
                  mysql_connection.query(user_query, [user.Username, hash_pass], function(err, result){
                    if(err){
                      console.log("User Operation Failed! Error on DB " + dbinfo.Name +": " + err);
                      errors.push({User: user, Database: dbinfo, Error:{Title:"Error on "+user_log, Details: err}, Retryable:true, Class:"Error"});
                      callback();
                    }
                    console.log(user_log2);
                    mysql_connection.query(user_query2, [user.Username, hash_pass], function(err, result){
                      if(err){
                        console.log("Localhost User Operation Failed! Error on DB " + dbinfo.Name +": " + err);
                        errors.push({User: user, Database: dbinfo, Error:{Title:"Error on "+user_log2, Details: err}, Retryable:true, Class:"Error"});
                        callback();
                      }
                      if(new_user){
                        mysql_connection.query("GRANT ALL PRIVILEGES ON *.* TO ?@'%';", [user.Username], function(err, result){
                          if(err){
                            console.log("Privileges Error on DB " + dbinfo.Name +": " + err);
                            errors.push({User: user, Database: dbinfo, Error:{Title:"Error granting permissions", Details: err}, Retryable:true, Class:"Error"});
                            callback();
                          }
                        });
                        mysql_connection.query("GRANT ALL PRIVILEGES ON *.* TO ?@'localhost';", [user.Username], function(err, result){
                          if(err){
                            console.log("Privileges Error on DB " + dbinfo.Name +": " + err);
                            errors.push({User: user, Database: dbinfo, Error:{Title:"Error granting localhost permissions", Details: err}, Retryable:true, Class:"Error"});
                            callback();
                          }
                        });
                      }
                      callback();
                    });
                  });
                });
              }
            });
          }
          else{
            console.log("User " + user.Username + " lacks a MySQL_Password. Skipping...");
            errors.push({User: user, Database: dbinfo, Error: {Title: "User lacks a MySQL_Password", Details:"The user has no MySQL_Password on record."}, Retryable:false, Class:"Warning"});
            return callback();
          }
        },
        function(err){
          console.log('-------------------\nEND OPERATIONS FOR ' + dbinfo.Name +'\n---------------------------');
          mysql_connection.release();
          return series_callback(null, errors);
        });
      }],
      function(err, results){
        mysql_pool.end();
        top_callback(results)
    });
  }
};
