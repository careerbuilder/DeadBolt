var mssql = require('mssql');
var async = require('async');
var encryption = require('./encryption');

module.exports = {
  update_users: function(db, affected_users, gospel_users, callback){
    var errors = [];
    var g_users = {};
    gospel_users.forEach(function(gu, i){
      g_users[gu.Username] = gu;
    });
    var plainpass;
    var conn;
    async.series([
      function(cb){
        encryption.decrypt(dbinfo.SAPass, function(err, data){
          if(err){
            console.log(err);
            affected_users.forEach(function(user, i){
              errors.push({User: err_user, Database: dbinfo, Error:{Title: "Could not decrypt SA Password", Details: err}, Retryable:true, Class:"Error"});
            });
            return cb(err);
          }
          plainpass = data;
          cb();
        });
      },
      function(cb){
        con = new mssql.Connection({
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
        async.each(affected_users, function(user, each_cb){
          var request = conn.request();
          request.input('username', mssql.NVarChar, user.Username);
          request.query("IF EXISTS (SELECT * FROM sys.database_principals WHERE name= @username)	Select 1 as 'exists' Else	select 0 as 'exists'", function(err, records){
            if(err){
              console.log(err);
              errors.push({User: err_user, Database: dbinfo, Error:{Title: "Failed to query Database", Details: err}, Retryable:true, Class:"Error"});
              return cb();
            }
            console.log(records);
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
