var express = require('express');
var router = express.Router();
var request = require('request');
var async = require('async');
var nodemailer = require('nodemailer');
var sesTransport = require('nodemailer-ses-transport');
var transporter = nodemailer.createTransport(sesTransport());
var connection = require('./mysql');
var encryption = require('../tools/encryption');
var db_tools = require('../tools/db_tools');

function add_user(body, callback){
  var payload = {
    user:{
      UserName: body.Username,
      FirstName: body.FirstName,
      LastName: body.LastName,
      Email: body.Email
    }
  };
  var req_opts = {
    uri: "http://172.21.12.226:3000/api/createUser/",
    method: 'POST',
    json: payload
  };
  request(req_opts, function(err, response, body){
    if(err){
      console.log("error connecting to AD API");
      console.log(err);
    }
    console.log(body);
  });
  var query = 'Insert into Users (Username) value (?) ON Duplicate KEY UPDATE Username=Username';
  connection.query(query, [body.Username], function(err, result){
    if(err){
      console.log(err);
      return callback(err);
    }
    User_ID = result.insertId;
    connection.query('Update possible_users set User_ID = ? where Username = ?', [User_ID, body.Username], function(err, result){
      if(err){
        console.log(err);
        return callback(err);
      }
      var plaintext = 'An account has been created for you on the CBsiteDB active directory, for use in RDS Identity management. To activate this account, please navigate to https://password.cbsitedb.net/accounts/UnLock and unlock the account.\n ' +
      'username: ' + body.Username  + '\nUpon setting a password, all databases to which you have access will be accessible using that username and password. If you have any questions, email Adam.Yost@careerbuilder.com';
      var html = '<h1>An Account Has Been Created For You</h1><p>An account has been created for you on the CBsiteDB active directory, for use in RDS Identity management. To activate this account, please navigate to <a href="https://password.cbsitedb.net/accounts/UnLock">https://password.cbsitedb.net/accounts/UnLock</a> and unlock the account.</p>\n' +
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
        body.User_ID = User_ID;
        return callback(null, body);
      });
    });
  });
}

function update_user(body, callback){
  var User_ID = body.User_ID;
  var group_where = 'where (';
  var values = "";
  var group_ids = [];
  for(key in body.Groups){
    group_where += 'groups.ID = ? OR ';
    values +='(?,?,"'+body.Groups[key]+'"), ';
    group_ids.push(key);
  }
  values = "VALUES"+(values.substring(0,values.length-2));
  group_where+='0=1)';
  var del_group_query = 'Delete from users_groups where User_ID= ? and Group_ID not in (Select ID from groups '+group_where+');';
  var add_group_query = 'Insert into users_groups (User_ID, Group_ID, Permissions) '+values+' ON DUPLICATE KEY UPDATE Permissions=Values(Permissions);';
  var db_query = "Select * from `databases` where ID in (Select Database_ID from groups_databases where Group_ID in (Select Group_ID from users_groups where User_ID = ?))";
  connection.query(db_query, [User_ID], function(err, results){
    if(err){
      console.log(err);
      return callback(err);
    }
    var affected_dbs = results || [];
    var db_names = [];
    affected_dbs.forEach(function(db, i){
      db_names.push(db.Name);
    });
    connection.query(del_group_query, [User_ID].concat(group_ids), function(err, results){
      if(err){
        console.log(err);
        return callback(err);
      }
      connection.query(add_group_query, group_ids.concat([User_ID]), function(err, results){
        if(err){
          console.log(err);
          return callback(err);
        }
        connection.query(db_query, [User_ID], function(err, results){
          if(err){
            console.log(err);
            return callback(err);
          }
          results.forEach(function(res, i){
            if(db_names.indexOf(results[i].Name)<0){
              affected_dbs.push(results[i]);
              db_names.push(results[i].Name);
            }
          });
          connection.query("Select users.*, users_groups.Permissions from users Join user_groups on users_groups.User_ID=users.ID where ID=?", [User_ID], function(err, results){
            if(err){
              console.log(err);
              return callback(err);
            }
            async.each(affected_dbs,function(db, inner_callback){
              db_tools.update_users(db, results, function(errs){
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
  });
}

router.get('/:groupid', function(req, res){
  var groupid = req.params.groupid;
  connection.query('Select users.Username, users_groups.Permissions from users Join users_groups on users_groups.User_ID = users.ID where users_groups.Group_ID= ?', [groupid], function(err, results){
    if(err){
      console.log(err);
      return res.send({Success: false, Error: err});
    }
    return res.send({Success: true, Data: results});
  });
});

router.post('/search/:page', function(req, res){
  var body = req.body;
  var page = req.params.page;
  var start=  page * 50;
  var end  = (start + 50)-1;
  var query = "";
  var args = [];
  if(body.Info.trim().length > 0){
    var info = "%"+body.Info+"%";
    query = 'Select ID, Username, Email, User_ID, FirstName, LastName from possible_users where (Username like ? OR Email like ? OR FirstName like ? OR LastName like ?) ORDER BY if(User_ID = "" or User_ID is null,1,0),User_ID, Username ASC LIMIT ?,?;';
    args = [info, info, info, info, start, end];
  }
  else{
    query = 'Select ID, Username, Email, User_ID, FirstName, LastName from possible_users ORDER BY if(User_ID = "" or User_ID is null,1,0),User_ID, Username ASC LIMIT ?, ?;';
    args = [start, end];
  }
  connection.query(query, args, function(err, results){
    if(err){
      console.log(err);
      return res.send({Success: false, Error: err});
    }
    var users = results;
    return res.send({Success: true, Results: users});
  });
});

router.post('/', function(req, res){
  var body = req.body;
  if(!body.User_ID){
    async.waterfall([
      function(callback){
        return callback(null, body);
      },
      function(arg1, callback){
        add_user(arg1, callback);
      },
      function(arg1, callback){
        update_user(arg1, callback);
      },
      function(userinfo, callback){
        connection.query('Insert into History (Activity) Value("Added user: ?")', [userinfo.Username], function(err, result){
          if(err){
            console.log(err);
            return callback(err);
          }
          return callback(null, userinfo.User_ID);
        });
      }
    ], function(err, result){
      if(err){
        console.log(err);
        return res.send({Success:false, Error: err});
      }
      return res.send({Success:true, User_ID: result});
    });
  }
  else{
    async.waterfall([
      function(callback){
        return callback(null, body);
      },
      function(arg1, callback){
        update_user(arg1, callback);
      },
      function(userinfo, callback){
        connection.query('Insert into History (Activity) Value("Edited user: ?")', [userinfo.Username], function(err, result){
          if(err){
            console.log(err);
            return callback(err);
          }
          return callback(null, userinfo.User_ID);
        });
      }
    ], function(err, result){
      if(err){
        console.log(err);
        return res.send({Success:false, Error: err});
      }
      return res.send({Success:true, User_ID: result});
    });
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
    var req_opts = {
      uri: "http://172.21.12.226:3000/api/removeUser/",
      method: 'POST',
      json: {user: {UserName: username}}
    };
    request(req_opts, function(err, response, body){
      if(err){
        console.log(err);
      }
      //console.log(body);
    });
    var db_query = "Select * from `databases` where ID in (Select Database_ID from groups_databases where Group_ID in (Select Group_ID from users_groups where User_ID = ?))";
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
        async.each(affected_dbs, function(db, i){
          db_tools.update_users(db, [user], function(errs){
            //console.log(errs);
          })
        }, function(err){
          if(err){
            console.log(err);
          }
          console.log("All Databases Updated to remove " + username);
          connection.query('Delete from users where ID = ?', [user_id], function(err, result){
            if(err){
              console.log(err);
              return res.send({Success:false, Error: err});
            }
            connection.query("Update possible_users set User_ID = null where User_ID = ?", [user_id], function(err, result){
              if(err){
                console.log(err);
                return res.send({Success:false, Error: err});
              }
            });
          });
        });
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

module.exports = router;
