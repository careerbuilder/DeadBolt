var router      = require('express').Router();
var uuid        = require('node-uuid');
var connection  = require('../middleware/db');
var hashes      = require('../middleware/passwordhash');
var deadbolt    = require('../middleware/deadbolt');
var ad;

router.post('/reset/:resetid', function(req, res){
  var resetid = req.params.resetid;
  connection.query('Select ID from Users where Reset_ID=? and Username=? LIMIT 1;', [resetid, req.body.Username], function(err, results){
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
      if(global.config.UseAD){
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
      hashes.get_all(req.body.Password, function(hash_obj){
        user.Passwords = hash_obj;
        var creds = hash_obj.portal;
        deadbolt.update_user(user, function(err){
          if(err){
            return res.send({Success: false, Error: err});
          }
          connection.query('Update Users set Reset_ID=NULL, Salt=?, Password=? where ID=?', [creds.Salt, creds.Password, user.ID], function(err, result){
            if(err){
              return res.send({Success: false, Error: err});
            }
            return res.send({Success: true});
          });
        });
      });
    }
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
  connection.query("Select ID, Email, Username, Salt, Password, IsAdmin from Users where (Username= ? and Active=1) LIMIT 1;", [body.Username], function(err, results){
    if(err){
      console.log(err);
      return res.send({Success:false, Error: "Error connecting to database:\n" + err});
    }
    else if(results.length < 1){
      return res.send({Success:false, Error: "Not a valid User"});
    }
    var isadmin = results[0].IsAdmin;
    var shasum = crypto.createHash('sha512');
    shasum.update(results[0].Salt + body.Password);
    var passcheck = shasum.digest('hex');
    if(results[0].Password != passcheck){
      return res.send({Success: false, Error: "Incorrect Password"});
    }
    var sessionid = uuid.v4();
    var now = ~~(new Date().getTime()/1000);
    //-----------------h-* m/h* s/m----------
    var later = now + (6 * 60 * 60);
    connection.query("Insert into Sessions (Session_ID, Expires, User_ID) Values(?, ?, ?)", [sessionid, later, results[0].ID], function(err, results){
      if(err){
        console.log(err);
        return res.send({Succes:false, Error: "Error generating session ID:\n" + err});
      }
      res.cookie('dbpp_sc', sessionid, { maxAge: (6*60*60*1000)});
      return res.send({Success:true, User:{Username: body.Username, IsAdmin:isadmin}, Session: sessionid});
    });
  });
});


//This acts as a gateway, prohibiting any traffic not containing a valid Session ID
router.use(function(req, res, next){
  var q = 'Select Users.* from Sessions join Users on User_ID = Users.ID where Session_ID = ? and Expires<? and Sessions.Active=1;';
  connection.query(q, [req.req.headers.authorization, ~~(new Date().getTime()/1000)], function(err, results){
    if(err){
      return res.send({Success:false, Error:err});
    }
    if(results.length<1){
      return res.send({Success:false, Error: 'Invalid SessionID'});
    }
    else{
      res.locals.user = results[0];
      return next();
    }
  });
});

router.post('/changePassword', function(req, res){
  var user = res.locals.user;
  if(user.IsAdmin && req.body.User){
    user = req.body.User;
  }
  if(global.config.UseAD){
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
  hashes.get_all(user.Password, function(hash_obj){
    user.Passwords = hash_obj;
    var creds = hash_obj.portal;
    deadbolt.update_user(user, function(err){
      if(err){
        return res.send({Success: false, Error: err});
      }
      connection.query('Update users set Salt=?, Password=? where ID=?', [creds.Salt, creds.Password, user.ID], function(err, result){
        if(err){
          return res.send({Success: false, Error: err});
        }
        return res.send({Success: true});
      });
    });
  });
});

router.post('/addUser', function(req, res){
  if(!user.IsAdmin){
    return res.send({Success:false, Error: 'Insufficient permissions'});
  }
  var user = req.body.User;
  if(global.config.UseAD){
    if(!ad){
      ad = require('../middleware/ad');
    }
    ad.addUser(user, function(err, data){
      if(err){
        console.log(err);
      }
      else{
        console.log(data);
      }
    });
  }
  var q = 'Insert into users (Username, FirstName, LastName, Email, Reset_ID, Active) VALUES(?, ?, ?, ?, ?, 0);';
  var resetid = uuid.v4();
  connection.query(q,[user.Username, user.FirstName, user.LastName, user.Email, resetid], function(err){
    if(err){
      return res.send({Success:false, Error: err});
    }
    return res.send({Success: true, ResetID: resetid});
  });
});


module.exports=router;
