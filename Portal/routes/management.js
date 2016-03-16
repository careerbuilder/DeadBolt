var router = require('express').Router();
var db = require('../middleware/mysql');

router.get('/requirements/', function(req, res){
  db.query('Select * from requirements;', function(err, results){
    if(err){
      return res.send({Success:false, Error:err});
    }
    var cfg = {};
    results.forEach(function(r){
      cfg[r.Key] = cfg[r.Value];
    });
    return res.send({Success:true, Requirements: cfg});
  });
});

router.use(function(req, res, next){
  if(!res.locals.user || res.locals.user.Admins.length<1 || res.locals.user.Admins.indexOf(-1)<0){
    return res.send({Success:false, valid:false, Error: "Unauthorized to perform this request"});
  }
  else{
    return next();
  }
});

router.post('/requirements/', function(req, res){
  var body = req.body;
  var changes = [];
  for(var key in body){
    changes.push([key, body[key]]);
  }
  db.query('Insert into requirements(Key, Value) VALUES (?) ON DUPLICATE KEY UPDATE Value=VALUES(Value);', changes, function(err){
    if(err){
      return res.send({Success: false});
    }
    return res.send({Success:true});
  });
});

module.exports=router;
