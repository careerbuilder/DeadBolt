var connection = require('../routes/mysql.js');
var async = require('async');
var mysql_tools = require('./mysql_tools.js');
//var mssql_tools = require('./mssql_tools.js');
//var mongo_tools = require('./mongo_tools.js');

function update(db, init_users, callback){
  var dbinfo = db;
  var gospel_users = [];
  var users = init_users;
  //get gospel user list
  var get_users = "Select Distinct Username from users where users.ID in (Select User_ID from users_groups where users_groups.Group_ID in (Select Group_ID from groups_databases where Database_ID = ?))";
  connection.query(get_users, [dbinfo.ID], function(err, results){
    if(err){
      console.log("Error on " + dbinfo.Name +": " + err);
      return callback([err]);
    }
    var gospel_users = [];
    results.forEach(function(res, i){
      gospel_users.push(res.Username);
    });
    var final_errors = [];
    async.retry({times:3, interval:(60*1000)}, function(cb, results){
      switch(dbinfo.Type.toLowerCase().trim()){
        case 'mysql':
          mysql_tools.update_users(dbinfo, users, gospel_users, function(errors){
            save_errors(dbinfo, errors, function(save_err, rem_users, rem_errors){
              if(save_err){
                console.log(save_err);
              }
              if(rem_users.lenth > 0){
                users = rem_users;
                final_errors = final_errors.concat(rem_errors);
                cb(true, final_errors);
              }
              cb(null, final_errors)
            });
          });
          break;
        case 'aurora':
          mysql_tools.update_users(dbinfo, users, gospel_users, function(err){
            console.log(dbinfo.Name + " Updated");
            save_errors(dbinfo, err, function(save_err, rem_users, rem_errors){
              if(save_err){
                console.log(save_err);
              }
              if(rem_users.lenth > 0){
                users = rem_users;
                final_errors = final_errors.concat(rem_errors);
                cb(true);
              }
              cb(null, final_errors)
            });
          });
          break;
        /*
        case 'sqlserver':
          mssql_tools.update_users(dbinfo, users, gospel_users, function(err){
            save_errors(dbinfo, err, callback);
            //callback(errs);
          });
          break;
        case 'mongo':
          mongo_tools.update_users(dbinfo, users, gospel_users, function(err){
            save_errors(dbinfo, err, callback);
            //callback(errs);
          });
          break;
        */
        default:
          cb(null, [{Database:dbinfo, Error:{Title: "Unsupported Database type", Details: dbinfo.Type + " Is not currently supported."}, Retryable: false, Class:"Warning"}]);
          break;
      }
    }, function(err, results){
      callback(results);
    });
  });
}

function save_errors(db, errors, callback){
  var remaining_errors = [];
  var usernames = [];
  var users = [];
  errors.forEach(function(error, i){
    console.log(error);
    if(error.Retryable){
      if(usernames.indexOf(error.User.UserName)<=0){
        usernames.push(error.User.UserName);
        users.push(error.User);
      }
    }
    else{
      remaining_errors.push(error);
    }
  });
  callback(null, users, remaining_errors);
}

module.exports = {
  update_database_users: function(db, callback){
    var dbinfo = db;
    connection.query("Select * from users;", function(err, all_users){
      if(err){
        console.log("Error on " + dbinfo.Name +": " + err);
        callback(err);
      }
      update(dbinfo, all_users, function(errs){
        console.log(errs);
        callback(errs);
      });
    });
  },
  update_users: function(db, users, callback){
    var dbinfo = db;
    update(dbinfo, users, function(errs){
      console.log(errs);
      callback(errs);
    });
  }
};
