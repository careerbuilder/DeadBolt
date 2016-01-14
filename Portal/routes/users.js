var express = require('express');
var router = express.Router();
var request = require('request');
var async = require('async');
var nodemailer = require('nodemailer');
var sesTransport = require('nodemailer-ses-transport');
var transporter = nodemailer.createTransport(sesTransport());
var adapi = require('../middleware/adapi');
var connection = require('../middleware/mysql');
var encryption = require('../middleware/encryption');
var db_tools = require('../tools/db_tools');

function add_user(body, callback){
  if(!body || !body.Username || !body.FirstName || !body.LastName || !body.Email){
    return callback("No User info");
  }
  var user = {
    UserName: body.Username,
    FirstName: body.FirstName,
    LastName: body.LastName,
    Email: body.Email
  };
  adapi.add_user_to_AD(user, function(err, result){
    if(err){
      console.log(err);
      return callback(err);
    }
    console.log(result || "");
    var query = 'Update `users` set `Active`=1 where `Username` = ?';
    connection.query(query, [body.Username], function(err, result){
      if(err){
        console.log(err);
        return callback(err);
      }
      var plaintext = 'An account has been created for you on the CBsiteDB active directory, for use in RDS Identity management. To activate this account, please navigate to https://password.cbsitedb.net/accounts/Reset and unlock the account.\n ' +
      'username: ' + body.Username  + '\nUpon setting a password, all databases to which you have access will be accessible using that username and password. If you have any questions, email Adam.Yost@careerbuilder.com';
      var html = '<h1>An Account Has Been Created For You</h1><p>An account has been created for you on the CBsiteDB active directory, for use in RDS Identity management. To activate this account, please navigate to <a href="https://password.cbsitedb.net/accounts/Reset">https://password.cbsitedb.net/accounts/Reset</a> and unlock the account.</p>\n' +
      '<h4>username: ' + body.Username  + '</h4>\n<p>Upon setting a password, all databases to which you have access will be accessible using that username and password. If you have any questions, email <a href="mailto:Adam.Yost@careerbuilder.com">Adam.Yost@careerbuilder.com</a></p>';
      transporter.sendMail({
        from: 'DeadBolt@cbsitedb.net',
        to: body.Email,
        subject: 'Identity Added to Databases',
        text: plaintext,
        html: html
      }, function(err, info){
        if(err){
          console.log(err);
        }
        body.Active=1;
        return callback(null, body);
      });
    });
  });
}

//@TODO: rewrite group change detection, look for allowed changes.

function update_user(body, callback){
  var User_ID = body.ID;
  var del_group_query;
  var add_group_query;
  var group_ids = [];
  var group_where = 'where (';
  var db_or = "";
  var values = "";
  var b_groups = body.Groups || {};
  for(key in b_groups){
    group_where += 'groups.ID = ? OR ';
    db_or += 'Group_ID=? OR ';
    values +='('+User_ID+',?,"'+body.Groups[key]+'"), ';
    group_ids.push(parseInt(key));
  }
  db_or += '0=1';
  group_where += '0=1)'
  values = "VALUES "+(values.substring(0,values.length-2));
  del_group_query = 'Delete from users_groups where User_ID= ? and Group_ID not in (Select ID from groups '+group_where+');';
  add_group_query = 'Insert into users_groups (User_ID, Group_ID, Permissions) '+values+' ON DUPLICATE KEY UPDATE Permissions=Values(Permissions);';
  if(group_ids.length<1){
    del_group_query = 'Delete from users_groups where User_ID= ?;';
    add_group_query = 'set @dummy = 1';
  }
  var db_query = "Select DISTINCT * from `databases` where ID in (Select Database_ID from groups_databases where ("+db_or+") OR Group_ID in (Select Group_ID from users_groups where User_ID=?));";
  connection.query(db_query, group_ids.concat([User_ID]), function(err, results){
    if(err){
      console.log(err);
      return callback(err);
    }
    var affected_dbs = results || [];
    connection.query("Select * from users where users.ID=?;", [User_ID], function(err, results){
      if(err){
        console.log(err);
        return callback(err);
      }
      var userinfo = results
      connection.query(del_group_query, [User_ID].concat(group_ids), function(err, results){
        if(err){
          console.log(err);
          return callback(err);
        }
        connection.query(add_group_query, group_ids, function(err, results){
          if(err){
            console.log(err);
            return callback(err);
          }
          async.each(affected_dbs,function(db, inner_callback){
            db_tools.update_users(db, userinfo, function(errs){
              inner_callback();
            });
          }, function(err, result){
            console.log("All Databases Updated for " + body.Username);
          });
          callback(null, body);
        });
      });
    });
  });
}

router.get('/:groupid', function(req, res){
  var groupid = req.params.groupid;
  connection.query('Select users.Username, users_groups.Permissions from users Join users_groups on users_groups.User_ID = users.ID where users_groups.Group_ID= ? Order by (users_groups.Permissions+0) ASC;', [groupid], function(err, results){
    if(err){
      console.log(err);
      return res.send({Success: false, Error: err});
    }
    return res.send({Success: true, Results: results});
  });
});

router.post('/search/:page', function(req, res){
  var body = req.body;
  var page = req.params.page;
  var start=  page * 50;
  var args = [];
  var count_query = 'Select Count(*) as Total from users';
  var query = 'Select ID, Username, Email, FirstName, LastName, LENGTH(MySQL_Password) as hasmysql, LENGTH(SQL_Server_Password) as hasmssql, Active from users';
  if(body.Info && body.Info.trim().length > 0){
    var info = "%"+body.Info+"%";
    args = [info, info, info, info];
    count_query += ' where (Username like ? OR Email like ? OR FirstName like ? OR LastName like ?)';
    query += ' where (Username like ? OR Email like ? OR FirstName like ? OR LastName like ?)';
  }
  connection.query(count_query +';', args, function(err, results){
    if(err){
      console.log(err);
      return res.send({Success: false, Error: err});
    }
    var total = results[0].Total;
    args.push(start);
    connection.query(query + ' ORDER BY Active DESC, Username ASC LIMIT ?,50;', args, function(err, users){
      if(err){
        console.log(err);
        return res.send({Success: false, Error: err});
      }
      return res.send({Success: true,  Results: users, Total: total});
    });
  });
});

router.post('/', function(req, res){
  var body = req.body;
  var exists = !!body.Active;
  async.waterfall([
    function(callback){
      if(body.Active && body.Active == 1){
        return callback(null, body);
      }
      add_user(body, callback);
    },
    function(arg1, callback){
      update_user(arg1, callback);
    },
    function(userinfo, callback){
      var activity = "";
      if(exists){
        activity = '"Updated user: ?"';
      }
      else{
        activity = '"Added user: ?"';
      }
      connection.query('Insert into History (Activity) Value('+ activity +')', [userinfo.Username], function(err, result){
        if(err){
          console.log(err);
        }
        return callback(null, userinfo.Active);
      });
    }
  ], function(err, result){
    if(err){
      console.log(err);
      return res.send({Success:false, Error: err});
    }
    return res.send({Success:true, Active: result});
  });
});

router.use(function(req, res, next){
  if(!res.locals.user || !res.locals.user.Admins || res.locals.user.Admins.length<1){
    return res.send({Success: false, Error: 'No Auth!'});
  }
  else{
    if(res.locals.user.Admins.indexOf(-1)<0){
      return res.send({Success: false, Error: 'Not a full Admin!'});
    }
    else{
      return next();
    }
  }
});

router.delete('/:id', function(req,res){
  var user_id = req.params.id;
  connection.query("Select * from users where ID = ?", [user_id], function(err, results){
    if(err){
      console.log(err);
      return res.send({Success: false, Error: err});
    }
    var user = results[0];
    var username = user.Username;
    adapi.remove_user_from_AD(username, function(err, result){
      console.log('removing', username);
      if(err){
        console.log('Error removing ' + username, err);
      }
      else{
        console.log(result);
      }
    });
    var db_query = "Select DISTINCT * from `databases` where ID in (Select Database_ID from groups_databases where Group_ID in (Select Group_ID from users_groups where User_ID = ?))";
    connection.query(db_query, [user_id], function(err, results){
      if(err){
        console.log(err);
        return res.send({Success:false, Error: err});
      }
      var affected_dbs = results;
      var query = "Delete from Users_Groups where User_ID = ?";
      connection.query(query, [user_id], function(err, result){
        if(err){
          console.log(err);
          return res.send({Success:false, Error: err});
        }
        async.each(affected_dbs, function(db, cb){
          db_tools.update_users(db, [user], function(errs){
            cb();
          });
        }, function(err){
          console.log("All Databases Updated to remove " + username);
          connection.query('Update Users set Active = 0 where ID = ?;', [user_id], function(err, result){
            if(err){
              console.log(err);
              return res.send({Success:false, Error: err});
            }
            connection.query('Insert into History (Activity) Value("Deleted user: ?")', [username], function(err, result){
              if(err){
                console.log(err);
                return res.send({Success: true, Error: "History error: " + err.toString(), });
              }
              return res.send({Success: true});
            });
          });
        });
      });
    });
  });
});

module.exports = router;
