var router = require('express').Router();
var uuid = require('node-uuid');
var crypto = require('crypto');
var async = require('async');
var connection = require('../middleware/mysql');
var email = require('../middleware/email');
var hashes = require('../middleware/hashes');
var encryption = require('../middleware/encryption');
var db_tools = require('../tools/db_tools');

function propagate_password(user, callback){
  if('AD' in global.config){
    if(!ad){
      ad = require('../middleware/ad');
    }
    ad.changePassword(user, function(err, data){
      if(err){
        console.log(err);
      }
      else{
        console.log(data);
      }
    });
  }
  hashes.get_all(user.Password, function(h){
    var creds = h.portal;
    delete h.portal;
    async.each(Object.keys(h), function(p, cb){
      encryption.encrypt(h[p], function(err, enc){
        if(err){
          return cb(err);
        }
        else{
          h[p] = enc;
          return cb();
        }
      });
    }, function(err){
      if(err){
        return callback(err);
      }
      var pq = 'Update users set MySQL_Password=?, SQL_Server_Password=?, Portal_Salt=?, Portal_Password=?, Active=1, Reset_ID=null where ID=?;';
      connection.query(pq, [h.mysql, h.mssql, creds.Salt, creds.Password, user.ID], function(err, result){
        if(err){
          return callabck(err);
        }
        connection.query('Select * from users where ID=?;', [user.ID], function(err, users){
          if(err){
            return callback(err);
          }
          user = users[0];
          var dbq = 'Select `databases`.* from `databases` join `groups_databases` on `groups_databases`.`Database_ID` = `databases`.`ID` join `users_groups` on `users_groups`.`Group_ID`=`groups_databases`.`Group_ID` join `users` on `users`.`ID` = `users_groups`.`User_ID` where `Users`.`ID`=?;';
          connection.query(dbq, [user.ID], function(err, results){
            if(err){
              return callback(err);
            }
            if(results.length<1){
              return callback();
            }
            async.each(results,function(db, inner_callback){
              db_tools.update_users(db, [user], function(errs){
                inner_callback();
              });
            }, function(err, result){
              console.log("All Databases Updated for " + user.Username);
            });
            return callback();
          });
        });
      });
    });
  });
}

router.post('/login', function(req,res){
  var body = req.body;
  if(!body.Username){
    return res.send({Success: false, Error: "No Username!"});
  }
  if(!body.Password){
    return res.send({Success: false, Error: "No Password!"});
  }
  var aq = 'Select users.ID, Portal_Salt, Portal_Password, Username, Email, Group_ID, GroupAdmin from users Join users_groups on users_groups.User_ID=users.ID where Username=? and Active=1;';
  connection.query(aq,[req.body.Username],function(err, results){
    if(err){
      console.log(err);
      return res.send({Success:false, Error: err});
    }
    if(results.length<1){
      return res.send({Success: false, Error: 'No such user'});
    }
    var user = results[0];
    var shasum = crypto.createHash('sha512');
    shasum.update(user.Portal_Salt + body.Password);
    var passcheck = shasum.digest('hex');
    if(passcheck != user.Portal_Password){
      return res.send({Success: false, Error: 'Incorrect Password'});
    }
    delete user.Portal_Salt;
    delete user.Portal_Password;
    user.Admins = [];
    results.forEach(function(r){
      if(r.GroupAdmin && r.GroupAdmin>0){
        user.Admins.push(r.Group_ID);
      }
    });
    var sessionid = uuid.v4();
    var now = ~~(new Date().getTime()/1000);
    //-----------------h-* m/h* s/m----------
    var later = now + (6 * 60 * 60);
    var sq = "Insert into Sessions (Session_ID, Expires, User_ID) Values(?, ?, ?) ON DUPLICATE KEY UPDATE Session_ID=VALUES(Session_ID), Expires=VALUES(Expires);";
    connection.query(sq, [sessionid, later, user.ID], function(err, results){
      if(err){
        console.log(err);
        return res.send({Succes:false, Error: "Error generating session ID:\n" + err});
      }
      res.cookie('rdsapit', sessionid, { maxAge: (6*60*60*1000)});
      return res.send({Success:true, User: user, Session: sessionid});
    });
  });
});

router.post('/forgot', function(req, res){
  if(!req.body || !req.body.Email){
    return res.send({Success: false, Error: 'Missing email!'});
  }
  else{
    connection.query('Select ID from Users where Email=? and Active=1;', [req.body.Email], function(err, results){
      if(err){
        return res.send({Success:false, Error:err});
      }
      else if(results.length<1){
        return res.send({Success: false, Error: 'No user with that email'});
      }
      else{
        email.send_reset_email({Init:false, To:req.body.Email, Site:res.locals.url}, function(err){
          if(err){
            return res.send({Success: false, Error:err});
          }
          else{
            return res.send({Success: true});
          }
        });
      }
    });
  }
});

router.post('/reset', function(req, res){
  if(!req.body || !req.body.ResetID || !req.body.Username || !req.body.Password){
    return res.send({Success: false, Error: 'Missing Reset Credentials'});
  }
  var resetid = req.body.ResetID;
  connection.query('Select * from Users where Reset_ID=? and Username=? LIMIT 1;', [resetid, req.body.Username], function(err, results){
    if(err){
      console.log(err);
      return res.send({Success:false, Error: "Error connecting to database:\n" + err});
    }
    else if(results.length < 1){
      return res.send({Success:false, Error: "Not a valid User"});
    }
    else{
      var user = results[0];
      user.Password = req.body.Password;
      propagate_password(user, function(err){
        if(err){
          return res.send({Success: false, Error: err});
        }
        return res.send({Success: true});
      });
    }
  });
});

//This acts as a gateway, prohibiting any traffic not containing a valid Session ID
router.use(function(req, res, next){
  var auth = req.headers.authorization;
  if(!auth || auth.length<1){
    return res.send({Success:false, valid:false, Error: "Unauthorized to perform this request"});
  }
  connection.query('Select User_ID, Expires from Sessions where Session_ID= ? LIMIT 1;', [auth], function(err, results){
    if(err){
      return res.send({Success:false, valid: false, Error: err});
    }
    if(results.length > 0){
      result = results[0];
      var now = ~~(new Date().getTime()/1000);
      var valid = now <= result.Expires;
      if(valid){
        var q = 'Select users.ID, users.Username, ug.Group_ID from users left join (Select User_ID, Group_ID from users_groups where GroupAdmin =1) ug on ug.User_ID=users.ID where users.ID=?;';
        connection.query(q, [results[0].User_ID], function(err, results){
          if(err){
            return res.send({Success:false, valid: false, Error: err});
          }
          if(result.length<1){
            return res.send({Success:false, valid: false, Error: 'Invalid Session'});
          }
          var user = {
            Username:results[0].Username,
            ID: results[0].ID,
            Admins: []
          };
          results.forEach(function(g){
            if(g.Group_ID){
              user.Admins.push(g.Group_ID);
            }
          });
          res.locals.user = user;
          return next();
        });
      }
    }
    else{
      return res.send({Success:false, valid:false});
    }
  });
});

router.post('/', function(req, res){
  if(res.locals.user.Admins.indexOf(-1)>-1){
    return res.send({Success: true, FullAdmin: true, Admins: res.locals.user.Admins});
  }
  else{
    return res.send({Success: true, FullAdmin: false, Admins: res.locals.user.Admins});
  }
});

router.post('/changePassword', function(req, res){
  var user = res.locals.user;
  user.Password = req.body.Password;
  if(user.Admins.indexOf(-1)>=0 && req.body.User){
    user = req.body.User;
  }
  propagate_password(user, function(err){
    if(err){
      return res.send({Success: false, Error: err});
    }
    return res.send({Success: true});
  });
});

module.exports=router;
