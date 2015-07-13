var connection = require('../routes/mysql.js');
var async = require('async');
var mysql_tools = require('./mysql_tools.js');
//var mssql_tools = require('./mssql_tools.js');
//var mongo_tools = require('./mongo_tools.js');

function update(db, init_users, callback){
  var dbinfo = db;
  var gospel_users = [];
  var users = init_users;
  var final_errors = [];
  //get gospel user list
  var get_users = "Select Users.*, MAX(users_groups.Permissions) as Permissions from users join users_groups on users_groups.User_ID = users.ID join groups_databases on groups_databases.Group_ID = users_groups.Group_ID where groups_databases.Database_ID = 1 group by users.Username;";
  connection.query(get_users, [dbinfo.ID], function(err, results){
    if(err){
      console.log("Error on " + dbinfo.Name +": " + err);
      return callback([err]);
    }
    var gospel_users = results;
    async.retry({times:3, interval:30000}, function(cb, results){
      switch(dbinfo.Type.toLowerCase().trim()){
        case 'mysql':
          mysql_tools.update_users(dbinfo, users, gospel_users, function(errors){
            retry_errors(dbinfo, errors, function(save_err, rem_users, rem_errors){
              if(save_err){
                console.log(save_err);
              }
              if(rem_users.length > 0){
                users = rem_users;
                return cb({Error: "update failed for some users", Users: users});
              }
              return cb(null, rem_errors);
            });
          });
          break;
        case 'aurora':
          mysql_tools.update_users(dbinfo, users, gospel_users, function(err){
            retry_errors(dbinfo, err, function(save_err, rem_users, rem_errors){
              if(save_err){
                console.log(save_err);
              }
              if(rem_users.length > 0){
                users = rem_users;
                return cb(true);
              }
              return cb(null, rem_errors);
            });
          });
          break;
        /*
        case 'sqlserver':
          mssql_tools.update_users(dbinfo, users, gospel_users, function(err){
            retry_errors(dbinfo, err, callback);
            //callback(errs);
          });
          break;
        case 'mongo':
          mongo_tools.update_users(dbinfo, users, gospel_users, function(err){
            retry_errors(dbinfo, err, callback);
            //callback(errs);
          });
          break;
        */
        default:
          cb(null, [{Database:dbinfo, Error:{Title: "Unsupported Database type", Details: dbinfo.Type + " Is not currently supported."}, Retryable: false, Class:"Warning"}]);
          break;
      }
    }, function(err, results){
      if(err){
        console.log("Retry error", err);
      }
      save_errors(results, callback);
    });
  });
}

function retry_errors(db, errors, callback){
  var remaining_errors = [];
  var usernames = [];
  var users = [];
  errors.forEach(function(error, i){
    if(error.Retryable){
      if(usernames.indexOf(error.User.Username)<0){
        usernames.push(error.User.Username);
        users.push(error.User);
      }
    }
    else{
      remaining_errors.push(error);
    }
  });
  callback(null, users, remaining_errors);
}

function save_errors(errors, callback){
  if(errors && errors.length > 0){
    async.each(errors, function(error, cb){
      connection.query("Insert into Errors(Username, `Database`, Title, Details, Retryable, Class) Values(?, ?, ?, ?, ?, ?);", [error.User.Username, error.Database.Name, error.Error.Title, error.Error.Details, error.Retryable, error.Class], function(err, results){
        if(err){
          console.log("insert in to errors error: " + err);
          return cb(err);
        }
        return cb();
      });
    }, function(err, results){
      if(err){
        return callback(err);
      }
      return callback(results);
    });
  }
  else{
    callback([]);
  }
}

function filter_users(users, dbtype, cb){
  var db_type = dbtype.toLowerCase().trim();
  var good_users =[];
  async.each(users, function(user, callback){
    if(db_type==="mysql" || db_type==="aurora"){
      if(user.MySQL_Password){
        good_users.push(user);
      }
      return callback();
    }
    else if(db_type==="mssql"){
      if(user.SQL_Server_Password){
        good_users.push(user);
      }
      return callback();
    }
    else if(db_type==='cassandra'){
      if(user.Cassandra_Password){
        good_users.push(user);
      }
      return callback();
    }
    else if(db_type==='mongo'){
      if(user.Mongo_Password){
        good_users.push(user);
      }
      return callback();
    }
    else{
      return callback();
    }
  }, function(err){
    cb(good_users);
  });
}

module.exports = {
  update_all_users: function(db, callback){
    var dbinfo = db;
    connection.query("Select * from users;", function(err, all_users){
      if(err){
        console.log("Error on " + dbinfo.Name +": " + err);
        callback(err);
      }
      filter_users(all_users, dbinfo.Type, function(cleanusers){
        console.log("dbinfo ", dbinfo);
        console.log("users ", cleanusers);
        if(cleanusers.length <1){
          return callback();
        }
        update(dbinfo, cleanusers, function(errs){
          callback(errs);
        });
      });
    });
  },
  update_users: function(db, users, callback){
    var dbinfo = db;
    console.log("reached update users for db: " + db.Name);
    filter_users(users, dbinfo.Type, function(cleanusers){
      if(cleanusers.length <1){
        console.log("no suitable users!");
        return callback();
      }
      update(dbinfo, cleanusers, function(errs){
        callback(errs);
      });
    });
  }
};
