var connection = require('./mysql');

module.exports= {
  auth: function(req, res, next) {
    var auth = req.headers.authorization;
    if(!auth || auth.length<1){
      return res.send({Success:false, valid:false, Error: "Unauthorized to perform this request"});
    }
    connection.query('Select Expires from Sessions where Session_ID= ? LIMIT 1;', [auth], function(err, results){
      if(err){
        return res.send({Success:false, valid: false, Error: err});
      }
      if(results.length > 0){
        result = results[0];
        var now = ~~(new Date().getTime()/1000)
        var valid = now <= result.Expires;
        if(valid){
         return next(); 
        }
      }
      return res.send({Success:false, valid:false});
    });
  }
}
