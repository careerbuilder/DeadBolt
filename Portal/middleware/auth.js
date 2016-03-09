var connection = require('./mysql');

module.exports= {
  auth: function(req, res, next) {
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
            if(user.Admins.length<1){
              return res.send({Success:false, valid: false, Error: 'Not an Admin of any groups'});
            }
            res.locals.user = user;
            return next();
          });
        }
      }
      else{
        return res.send({Success:false, valid:false});
      }
    });
  },
  isAdmin: function(req, res, next){
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
  }
};
