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
