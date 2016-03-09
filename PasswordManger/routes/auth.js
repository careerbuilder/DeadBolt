var router      = require('express').Router();
var uuid        = require('node-uuid');
var crypto      = require('crypto');
var nodemailer  = require('nodemailer');
var sesTransport= require('nodemailer-ses-transport');
var connection  = require('../middleware/db');
var hashes      = require('../middleware/passwordhash');
var deadbolt    = require('../middleware/deadbolt');
var transporter = nodemailer.createTransport(sesTransport());
var ad;


function send_reset_email(emailinfo, callback){
  var resetid = uuid.v4();
  connection.query('Update Users Set Reset_ID=? where Email=?;',[resetid, emailinfo.To], function(err, result){
    if(err){
      return callback(err);
    }
    var plaintext, html, inithtml, resethtml;
    var url = emailinfo.Site+'/#/reset/'+resetid;
    var initText = "An account has been created for you in the Deadbolt user management system. To activate this account, please go to "+ url;
    var resetText = 'A user has requested a password reset for an account tied to this email. ' +
      '<br />If this was not you, please ignore this email. Otherwise, to reset your password go to '+
      '<a href="'+url+'">'+url+'</a>'; //your link here
    if('Email' in global.config){
      if('InitText' in global.config.Email){
        initText = global.config.Email.InitText;
      }
      if('ResetText' in global.config.Email){
        resetText = global.config.Email.ResetText;
      }
      if('InitHtml' in global.config.Email){
        inithtml = global.config.Email.InitHtml;
      }
      if('ResetHtml' in global.config.Email){
        resethtml = global.config.Email.ResetHtml;
      }
    }
    if(emailinfo.Init){
      plaintext = initText;
      if(inithtml){
        html = inithtml;
      }
      else{
        html = '<p>'+initText+'</p>';
      }
    }
    else{
      plaintext = resetText;
      if(resethtml){
        html = resethtml;
      }
      else{
        html = '<p>'+resetText+'</p>';
      }
    }
    transporter.sendMail({
      from: global.config.Email.From || "Deadbolt@yoursite.com",
      to: emailinfo.To,
      subject: emailinfo.Init ? 'Account created for you' : 'Password reset',
      text: plaintext,
      html: html
    }, function(err, info){
      if(err){
        return callback(err);
      }
      return callback();
    });
  });
}

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
        var url;
        if(req.protocol == 'http'){
          url =req.protocol+'://'+req.hostname;
          if(res.locals.port !== 80){
            url += ":"+res.locals.port;
          }
        }
        else if(req.protocol == 'https'){
          url =req.protocol+'://'+req.hostname;
          if(res.locals.port!==443){
            url+=":"+res.locals.port;
          }
        }
        else{
          url =req.protocol+'://'+req.hostname+':'+res.locals.port;
        }
        send_reset_email({Init:false, To:req.body.Email, Site:url}, function(err){
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
            console.log(err);
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
    var q = "Insert into Sessions (Session_ID, Expires, User_ID) Values(?, ?, ?) ON DUPLICATE KEY Update Session_ID=VALUES(Session_ID), Expires=Values(Expires), Active=1;";
    connection.query(q, [sessionid, later, results[0].ID], function(err, results){
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
  var q = 'Select Users.* from Sessions join Users on User_ID = Users.ID where Session_ID = ? and Expires>? and Sessions.Active=1;';
  connection.query(q, [req.headers.authorization, ~~(new Date().getTime()/1000)], function(err, results){
    if(err){
      console.log(err);
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

router.get('/', function(req, res){
  //if you made it this far, you have access
  return res.send({Success: true, User: res.locals.user});
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
  var q = 'Insert into users (Username, FirstName, LastName, Email, isSVC, Active) VALUES(?, ?, ?, ?, ?, ?);';
  connection.query(q,[user.Username, user.FirstName, user.LastName, user.Email || null, user.IsSVC, !user.IsSVC], function(err){
    if(err){
      return res.send({Success:false, Error: err});
    }
    if(user.IsSVC){
      return res.send({Success: true});
    }
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
    var url;
    if(req.protocol == 'http'){
      url =req.protocol+'://'+req.hostname;
      if(res.locals.port !== 80){
        url += ":"+res.locals.port;
      }
    }
    else if(req.protocol == 'https'){
      url =req.protocol+'://'+req.hostname;
      if(res.locals.port!==443){
        url+=":"+res.locals.port;
      }
    }
    else{
      url =req.protocol+'://'+req.hostname+':'+res.locals.port;
    }
    send_reset_email({Init:true, To:user.Email, Site:url}, function(err){
      if(err){
        return res.send({Success: false, Error:err});
      }
      else{
        return res.send({Success: true});
      }
    });
  });
});


module.exports=router;
