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
function update_user(body, caller, callback){
  var User_ID = body.ID;
  // get User info to update databases
  connection.query('Select * from users where ID = ?', [User_ID], function(err, userinfo){
    if(err){
      return callback(err);
    }
    if(userinfo.length<1){
      return callback('No User with that ID!');
    }
    var user = userinfo[0];
    //get old user_groups
    connection.query('Select Group_ID as ID, Permissions, GroupAdmin from users_groups where User_ID = ?', [User_ID], function(err, results){
      if(err){
        return callback(err);
      }
      var adds = [];
      var dels = [];
      body.Groups.forEach(function(g){
        var found=false;
        for(var i =0; i<results.length; i++){
          var r = results[i];
          if(r.ID === g.ID){
            found = true;
            if(r.Permissions !== g.Permissions || r.GroupAdmin!==g.GroupAdmin){
              adds.push(g);
            }
            break;
          }
        }
        if(!found){
          adds.push(g);
        }
      });
      results.forEach(function(r){
        var found=false;
        for(var i =0; i<body.Groups.length; i++){
          var g = body.Groups[i];
          if(g.ID === r.ID){
              found = true;
              break;
          }
        }
        if(!found){
          dels.push(r);
        }
      });
      var totChange = adds.concat(dels);
      if(totChange.length===0){
        return callback(null, body);
      }
      //full admins can do what they want
      if(caller.Admins.indexOf(-1)<0){
        //group admins can only edit their own group
        for(var i=0; i<totChange.length; i++){
          var gchange = totChange[i];
          if(caller.Admins.indexOf(gchange.ID)<0){
            return callback('Not Authorized to make this change');
          }
        }
      }
      var binstert = adds.map(x => [User_ID, x.ID, x.Permissions, x.GroupAdmin]);
      var q = 'Set @dummy=1;';
      if(binstert.length >0){
        q = 'Insert into `users_groups` (`User_ID`, `Group_ID`, `Permissions`, `GroupAdmin`) VALUES ' + connection.escape(binstert) + ' ON DUPLICATE KEY UPDATE `Permissions`=VALUES(`Permissions`), `GroupAdmin`=VALUES(`GroupAdmin`)';
      }
      // add/update groups that are still gospel
      connection.query(q, function(err, result){
        if(err){
          return callback(err);
        }
        var delIDs = dels.map(x => x.ID);
        var delq = 'Set @dummy=1';
        if(delIDs.length > 0){
          delq = 'Delete from users_groups where Group_ID in (' + connection.escape(delIDs)+');';
        }
        // delete groups no longer allowed
        connection.query(delq, function(err, result){
          if(err){
            return callback(err);
          }
          var changedIDs = totChange.map(x => x.ID);
          if(changedIDs.length <1){
            return callback(null, body);
          }
          else{
            var dbq = 'Select Distinct * from `databases` where ID in (Select Database_ID from groups_databases where Group_ID in (' + connection.escape(changedIDs)+'));';
            connection.query(dbq, function(err, dbs){
              if(err){
                return callback(err);
              }
              async.each(dbs,function(db, inner_callback){
                db_tools.update_users(db, user, function(errs){
                  inner_callback();
                });
              }, function(err, result){
                console.log("All Databases Updated for " + body.Username);
              });
              return callback(null, body);
            });
          }
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
      update_user(arg1, res.locals.user, callback);
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
