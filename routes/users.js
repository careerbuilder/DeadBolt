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
var express = require('express');
var router = express.Router();
var request = require('request');
var async = require('async');
var email = require('../middleware/email');
var audit = require('../middleware/audit');
var connection = require('../middleware/mysql');
var encryption = require('../middleware/encryption');
var db_tools = require('../tools/db_tools');

var test_switch = {
  auth: function(req, res, next){
    return next();
  }
};
//This lets us overwrite in test to load in res.locals
router.use(function(req,res,next){
  return test_switch.auth(req, res, next);
});

function add_user(body, callback){
  if(!body || !body.Username || !body.FirstName || !body.LastName || !body.Email){
    return callback("No User info");
  }
  var user = {
    Username: body.Username,
    FirstName: body.FirstName,
    LastName: body.LastName,
    Email: body.Email,
    IsSVC: body.IsSVC || false
  };
  if('AD' in global.config){
    var ad = require('../middleware/adapi');
    ad.add_user_to_AD(user, function(err){
      if(err){
        console.log(err);
      }
    });
  }
  var aq = 'Insert Into users (Username, FirstName, LastName, Email, IsSVC) VALUES(?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE Username=Username;';
  connection.query(aq, [user.Username, user.FirstName, user.LastName, user.Email, user.IsSVC], function(err){
    if(err){
      return callback(err);
    }
    connection.query('Select ID from users where Email=? and Username=?;', [user.Email, user.Username], function(err, results){
      if(err){
        return callback(err);
      }
      if(results.length<1){
        return callback('No such user');
      }
      body.ID = results[0].ID;
      email.send_reset_email({Init:true, To:user.Email, Site:body.URL}, function(err){
        if(err){
          return callback(err);
        }
        body.Active=1;
        return callback(null, body);
      });
    });
  });
}

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
      var groups = body.Groups || [];
      groups.forEach(function(g){
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
        for(var i =0; i<groups.length; i++){
          var g = groups[i];
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
          delq = 'Delete from users_groups where Group_ID in (' + connection.escape(delIDs)+') and User_ID=?;';
        }
        // delete groups no longer allowed
        connection.query(delq, [User_ID], function(err, result){
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
                db_tools.update_users(db, [user], function(errs){
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
  connection.query('Select users.Username, users_groups.Permissions, users_groups.GroupAdmin from users Join users_groups on users_groups.User_ID = users.ID where users_groups.Group_ID= ? Order by GroupAdmin DESC, (users_groups.Permissions+0) ASC;', [groupid], function(err, results){
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
  var query = 'Select ID, Username, Email, FirstName, LastName, LENGTH(MySQL_Password) as hasmysql, LENGTH(SQL_Server_Password) as hasmssql, Active, IsSVC from users';
  if(body.Info && body.Info.trim().length > 0){
    var info = "%"+body.Info+"%";
    args = [info, info, info, info];
    count_query += ' where (Username like ? OR Email like ? OR FirstName like ? OR LastName like ?) AND ID>=0';
    query += ' where (Username like ? OR Email like ? OR FirstName like ? OR LastName like ?) AND ID>=0';
  }
  else{
    count_query += ' where ID>=0';
    query += ' where ID>=0';
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

router.get('/id/:username', function(req, res){
  var username = req.params.username;
  var query = 'Select ID, Username, Active from users WHERE Username = ? LIMIT 1';
  connection.query(query, [username], function(err, user){
    if (err){
      console.log(err);
      return res.send({Success: false, Error: err});
    }
    if (user.length < 1){
      return res.send({Success: false, Error: "Could not find user"});
    }
    return res.send({Success: true,  Results: user[0]});
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
      body.URL = res.locals.url;
      add_user(body, callback);
    },
    function(arg1, callback){
      update_user(arg1, res.locals.user, callback);
    },
    function(userinfo, callback){
      var activity = "";
      if(exists){
        activity = 'Updated user: ?';
      }
      else{
        activity = 'Added user: ?';
      }
      audit.record(activity, [userinfo.Username], function(err){
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
  if(res.locals.user.Admins && res.locals.user.Admins.length>0 && res.locals.user.Admins.indexOf(-1)>=0){
    return next();
  }
  else{
    return res.send({Success: false, Error: 'Insufficient Privileges'});
  }
});

router.delete('/:id', function(req,res){
  var user_id = req.params.id;
  connection.query("Select * from users where ID = ?", [user_id], function(err, results){
    if(err){
      console.log(err);
      return res.send({Success: false, Error: err});
    }
    if(results.length<1){
      return res.send({Success: false, Error: 'No such user!'});
    }
    var user = results[0];
    var username = user.Username;
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
            audit.record("Deleted user: ?", [username], function(err){
              if(err){
                console.log(err);
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
