var express = require('express');
var router = express.Router();
var connection = require('./mysql');
var uuid = require('node-uuid');
var crypto = require('crypto');
var auth = require('./auth.js');

function validate_session(req, callback){
  var body = req.body;
  connection.query('Select Expires from Sessions where Session_ID= ? LIMIT 1;', [body.Session], function(err, results){
    if(err){
      return callback(err, {Success:false, valid: false, Error: err});
    }
    if(results.length > 0){
      result = results[0];
      var now = ~~(new Date().getTime()/1000)
      var valid = now <= result.Expires;
      return callback(null, {Success:true, valid:valid});
    }
    else{
      return callback(null, {Success:false, valid:false});
    }
  });
}

function signup(req, callback){
  var body = req.body;
  connection.query("Select Active from portal_users where Email=?", [body.email], function(err, results){
    if(err){
      return callback(err, {Success: false, Error: err});
    }
    if(results.length < 1){
      return callback("Sorry, Signup is invite only at this time.", {Success: false, Error: "Sorry, Signup is invite only at this time."});
    }
    if(results[0].Active && results[0].Active != 0){
      return callback("Sorry, This user has already registered.", {Success: false, Error: "Sorry, This user has already registered."});
    }
    if(!body.password){
      return callback("No User Password!", {Success:false, Error:"No Password!"});
    }
    var salt = uuid.v4();
    var shasum = crypto.createHash('sha256');
    shasum.update(salt + body.password);
    var passwordhash = shasum.digest('hex');
    connection.query("Update Portal_Users set Salt=?, Password = ?, Active=1 where Email=?;", [salt, passwordhash, body.email], function(err, results){
      if(err){
        return callback(err, {Success:false, Error: err});
      }
      return callback(null, {Success: true, Message: 'Successfully registered'});
    });
  });
}

function login(req, callback){
  var body = req.body;
  var sessionid = uuid.v4();
  var now = ~~(new Date().getTime()/1000);
  //-----------------h-* m/h* s/m----------
  var later = now + (6 * 60 * 60);
  connection.query("Select Email, Salt, Password from Portal_Users where (Email= ? and Active=1) LIMIT 1;", [body.email], function(err, results){
    if(err){
      return callback(err, {Success:false, Message: "Error connecting to database", Error: err});
    }
    else if(results.length < 1){
      return callback("Bad Login", {Success:false, Message: "Invalid username"});
    }
    if(!body.password){
      return callback("No Password!", {Success: false, Error: "No Password!"});
    }
    var shasum = crypto.createHash('sha256');
    shasum.update(results[0].Salt + body.password);
    var passcheck = shasum.digest('hex');
    if(results[0].Password != passcheck){
      return callback("Incorrect password", {Success: false, Message: "Incorrect Password"});
    }
    connection.query("Insert into Sessions (Session_ID, Expires) Values(?, ?)", [sessionid, later], function(err, results){
      if(err){
        return callback(err, {Succes:false, Message: "Error generating session ID", Error: err});
      }
      return callback(null, {Success:true, Message: 'Logged in successfuly as ' + body.email, Session: sessionid});
    });
  });
}

function get_history(req, callback){
  if(!req.params || !req.params.timelength){
    return callback("No Time length!", {Success:false, Error: "No Time window specified"});
  }
  var past = req.params.timelength;
  connection.query('Select Time, Activity from History WHERE Time BETWEEN DATE_SUB(NOW(), INTERVAL ? DAY) AND NOW() ORDER BY ID DESC LIMIT 15;', [past], function(err, results){
    if(err){
      return callback(err, {Success:false, Error:err});
    }
    return callback(null, {Success: true, History:results});
  });
}

router.get('/', function(req, res){
  return res.send("Welcome to the API");
});

router.post('/auth', function(req, res){
  validate_session(req, function(err, results){
    if(err){
      console.log(err);
    }
    return res.send(results);
  });
});

router.post('/signup', function(req,res){
  signup(req, function(err, result){
    if(err){
      console.log(err);
    }
    return res.send(result);
  });
});

router.post('/login', function(req,res){
  login(req, function(err, result){
    if(err){
      console.log(err);
    }
    else{
      res.cookie('rdsapit', result.Session, { maxAge: (6*60*60*1000)});
    }
    return res.send(result);
  });

});

//This acts as a gateway, prohibiting any traffic not containing a valid Session ID
router.use(auth);

router.get('/history/:timelength', function(req,res){
  get_history(req, function(err, results){
    if(err){
      console.log(err);
    }
    return res.send(results);
  });
});

router.use('/errors/', require('./errors.js'))
router.use('/users/', require('./users.js'));
router.use('/groups/', require('./groups.js'));
router.use('/databases/', require('./databases.js'));

module.exports = router;
