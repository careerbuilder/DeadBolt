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
var connection = require('../middleware/mysql');

//Attach a permissions object to all requests
router.use(function(req, res, next){
  if(res.locals.user){
    return next();
  }
  var auth = req.signedCookies.rdsapit;
  if(!auth || auth.length<1){
    res.locals.user = undefined;
    return next();
  }
  else{
    connection.query('Select User_ID, Expires from Sessions where Session_ID= ? LIMIT 1;', [auth], function(err, results){
      if(err){
        console.log(err);
        res.locals.user = undefined;
        return next();
      }
      if(results.length > 0){
        result = results[0];
        var now = ~~(new Date().getTime()/1000);
        var valid = now <= result.Expires;
        if(valid){
          var q = 'Select users.ID, users.Username, ug.Group_ID from users left join (Select User_ID, Group_ID from users_groups where GroupAdmin =1) ug on ug.User_ID=users.ID where users.ID=?;';
          connection.query(q, [results[0].User_ID], function(err, results){
            if(err){
              console.log(err);
              res.locals.user = undefined;
              return next();
            }
            if(result.length<1){
              res.locals.user = undefined;
              return next();
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
        res.locals.user = undefined;
        return next();
      }
    });
  }
});

router.use('/auth', require('./auth'));
router.use('/management', require('./management'));

//This acts as a gateway, prohibiting any traffic not containing a valid Session ID
router.use(function(req, res, next){
  if(!res.locals.user){
    return res.send({Success:false, valid:false, Error: "Unauthorized to perform this request"});
  }
  else{
    return next();
  }
});

router.use('/history', require('./history'));
router.use('/users', require('./users'));
router.use('/errors', require('./errors'));
router.use('/groups', require('./groups'));

//Only allow Full Admins to access other pages
router.use(function(req, res, next){
  if(!res.locals.user || !res.locals.user.Admins || res.locals.user.Admins.length<1){
    return res.send({Success: false, Error: 'Unauthorized to access this route!'});
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
router.use('/databases/', require('./databases'));

module.exports = router;
