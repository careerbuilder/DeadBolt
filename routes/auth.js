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
var router = require('express').Router();
var uuid = require('node-uuid');
var crypto = require('crypto');
var async = require('async');
var email = require('../middleware/email');
var connection = require('../middleware/mysql');
var email = require('../middleware/email');
var hashes = require('../middleware/hashes');
var encryption = require('../middleware/encryption');
var db_tools = require('../tools/db_tools');

function propagate_password(user, callback){
  if('AD' in global.config){
    if(!ad){
      ad = require('../middleware/adapi');
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
      var exp = Math.floor(new Date().getTime()/1000)+(60*60*24*90);
      var pq = 'Update users set MySQL_Password=?, SQL_Server_Password=?, Portal_Salt=?, Portal_Password=?, Active=1, Reset_ID=null, Expires=? where ID=?;';
      connection.query(pq, [h.mysql, h.mssql, creds.Salt, creds.Password, exp, user.ID], function(err){
        if(err){
          return callback(err);
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

function warn_expire(emailaddr, daysleft, site, callback){
  var emailinfo = {
    To: emailaddr,
    Days: daysleft,
    Site: site
  };
  email.send_expires_email(emailinfo, function(err){
    if(err){
      return callback(err);
    }
    return callback();
  });
}

function expire_pass(user, callback){
  if('AD' in global.config){
    if(!ad){
      ad = require('../middleware/adapi');
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
  user.Password = hashes.randomPass(32);
  hashes.get_all(user.Password, function(h){
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
      var pq = 'Update users set MySQL_Password=?, SQL_Server_Password=?, Active=1, Reset_ID=null, Expires=null where ID=?;';
      connection.query(pq, [h.mysql, h.mssql, user.ID], function(err, result){
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

router.get('/expired', function(req, res){
  var now = Math.floor(new Date().getTime()/1000);
  var warning = now + (60*60*24*5); //5 days before expire
  connection.query('Select * from users where Active=1 and IsSVC!=1 and Length(MySQL_Password)>0 and Expires<=?', [warning], function(err, results){
    if(err){
      return res.send({Success: false, Error:err});
    }
    async.each(results, function(r, cb){
      var daysleft = Math.floor((r.Expires-now)/(60*60*24));
      warn_expire(r.Email, daysleft, res.locals.url, function(err){
        if(err){
          console.log(err);
        }
        if(daysleft<1){
          expire_pass(r, function(err){
            if(err){
              console.log(err);
            }
            return cb();
          });
        }
        else{
          return cb();
        }
      });
    }, function(err){
      if(err){
        console.log(err);
      }
      return res.send({Success: true});
    });
  });
});

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
  if(!res.locals.user){
    return res.send({Success:false, valid:false, Error: "Unauthorized to perform this request"});
  }
  else{
    return next();
  }
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
