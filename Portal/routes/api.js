var express = require('express');
var router = express.Router();
var connection = require('../middleware/mysql');
var uuid = require('node-uuid');
var crypto = require('crypto');
var auth = require('../middleware/auth.js');

router.get('/', function(req, res){
  return res.send("Welcome to the API");
});

router.post('/signup', function(req,res){
  var body = req.body;
  if(!body.Email){
    return res.send({Success:false, Error:"No Email!"});
  }
  if(!body.Password){
    return res.send({Success:false, Error:"No Password!"});
  }
  connection.query("Select Portal_Password, Active from users where Email=?", [body.Email], function(err, results){
    if(err){
      return res.send({Success: false, Error: err});
    }
    if(results.length < 1){
      return res.send({Success: false, Error: "User not found"});
    }
    if(results[0].Active && results[0].Active != 0){
      return res.send({Success: false, Error: "Sorry, This user has already registered."});
    }
    var salt = uuid.v4();
    var shasum = crypto.createHash('sha512');
    shasum.update(salt + body.Password);
    var passwordhash = shasum.digest('hex');
    connection.query("Update Users set Portal_Salt=?, Portal_Password = ?, Active=1 where Email=?;", [salt, passwordhash, body.Email], function(err, results){
      if(err){
        console.log(err);
        return res.send({Success:false, Error: err});
      }
      return res.send({Success: true, Message: 'Successfully registered'});
    });
  });
});


router.post('/login', function(req,res){
  var body = req.body;
  if(!body.Email){
    return res.send({Success: false, Error: "No Email!"});
  }
  if(!body.Password){
    return res.send({Success: false, Error: "No Password!"});
  }
  connection.query("Select ID, Email, Portal_Salt, Portal_Password from Users where (Email= ? and Active=1) and ID in (select User_ID from users_groups where GroupAdmin=1) LIMIT 1;", [body.Email], function(err, results){
    if(err){
      console.log(err);
      return res.send({Success:false, Error: "Error connecting to database:\n" + err});
    }
    else if(results.length < 1){
      return res.send({Success:false, Error: "Not a valid User"});
    }
    var shasum = crypto.createHash('sha512');
    shasum.update(results[0].Portal_Salt + body.Password);
    var passcheck = shasum.digest('hex');
    if(results[0].Portal_Password != passcheck){
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
      res.cookie('rdsapit', sessionid, { maxAge: (6*60*60*1000)});
      return res.send({Success:true, Message: 'Logged in successfuly as ' + body.Email, Session: sessionid});
    });
  });
});

//This acts as a gateway, prohibiting any traffic not containing a valid Session ID
router.use(function(req, res, next){
  return auth.auth(req, res, next);
});

router.post('/auth', function(req, res){
  if(res.locals.user.Admins.indexOf(-1)>-1){
    return res.send({Success: true, FullAdmin: true, Admins: res.locals.user.Admins});
  }
  else{
    return res.send({Success: true, FullAdmin: false, Admins: res.locals.user.Admins});
  }
});

router.get('/history/:timelength', function(req,res){
  var past = req.params.timelength;
  connection.query('Select Time, Activity from History WHERE Time BETWEEN DATE_SUB(NOW(), INTERVAL ? DAY) AND NOW() ORDER BY ID DESC LIMIT 15;', [past], function(err, results){
    if(err){
      console.log(err);
      return res.send({Success:false, Error:err});
    }
    return res.send({Success: true, History:results});
  });
});
router.use('/errors/', require('./errors.js'));
router.use('/users/', require('./users.js'));
router.use('/groups/', require('./groups.js'));

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

router.use('/databases/', require('./databases.js'));

module.exports = router;
