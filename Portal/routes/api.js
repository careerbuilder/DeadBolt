var express = require('express');
var router = express.Router();
var connection = require('./mysql');
var uuid = require('node-uuid');
var crypto = require('crypto');
var auth = require('./auth.js');

router.get('/', function(req, res){
  return res.send("Welcome to the API");
});

router.post('/auth', function(req, res){
  if(!req.body || !req.body.Session){
    return res.send({Success: false, valid: false});
  }
  var body = req.body;
  connection.query('Select Expires from Sessions where Session_ID= ? LIMIT 1;', [body.Session], function(err, results){
    if(err){
      console.log(err);
      return res.send({Success:false, valid: false, Error: err});
    }
    if(results.length > 0){
      result = results[0];
      var now = ~~(new Date().getTime()/1000)
      var valid = now <= result.Expires;
      return res.send({Success:true, valid:valid});
    }
    else{
      return res.send({Success:false, valid:false});
    }
  });
});

router.post('/signup', function(req,res){
  var body = req.body;
  connection.query("Select Active from portal_users where Email=?", [body.email], function(err, results){
    if(err){
      console.log(err);
      return res.send({Success: false, Error: err});
    }
    if(results.length < 1){
      return res.send({Success: false, Error: "Sorry, Signup is invite only at this time."});
    }
    if(results[0].Active && results[0].Active != 0){
      return res.send({Success: false, Error: "Sorry, This user has already registered."});
    }
    if(!body.password){
      return res.send({Success:false, Error:"No Password!"});
    }
    var salt = uuid.v4();
    var shasum = crypto.createHash('sha256');
    shasum.update(salt + body.password);
    var passwordhash = shasum.digest('hex');
    connection.query("Update Portal_Users set Salt=?, Password = ?, Active=1 where Email=?;", [salt, passwordhash, body.email], function(err, results){
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
  var sessionid = uuid.v4();
  var now = ~~(new Date().getTime()/1000);
  //-----------------h-* m/h* s/m----------
  var later = now + (6 * 60 * 60);
  connection.query("Select Email, Salt, Password from Portal_Users where (Email= ? and Active=1) LIMIT 1;", [body.email], function(err, results){
    if(err){
      console.log(err);
      return res.send({Success:false, Message: "Error connecting to database", Error: err});
    }
    else if(results.length < 1){
      return res.send({Success:false, Message: "Invalid username"});
    }
    if(!body.password){
      return res.send({Success: false, Error: "No Password!"});
    }
    var shasum = crypto.createHash('sha256');
    shasum.update(results[0].Salt + body.password);
    var passcheck = shasum.digest('hex');
    if(results[0].Password != passcheck){
      return res.send({Success: false, Message: "Incorrect Password"});
    }
    connection.query("Insert into Sessions (Session_ID, Expires) Values(?, ?)", [sessionid, later], function(err, results){
      if(err){
        console.log(err);
        return res.send({Succes:false, Message: "Error generating session ID", Error: err});
      }
      res.cookie('rdsapit', sessionid, { maxAge: (6*60*60*1000)});
      return res.send({Success:true, Message: 'Logged in successfuly as ' + body.email, Session: sessionid});
    });
  });
});

//This acts as a gateway, prohibiting any traffic not containing a valid Session ID
router.use(function(req, res, next){
  return auth.auth(req, res, next);
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

router.use('/errors/', require('./errors.js'))
router.use('/users/', require('./users.js'));
router.use('/groups/', require('./groups.js'));
router.use('/databases/', require('./databases.js'));

module.exports = router;
