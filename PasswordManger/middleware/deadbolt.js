var request = require('request');
var deadbolt = global.config.Deadbolt;

module.exports = {
  update_user:function(user, callback){
    pool.getConnection(function(err, connection) {
    	if(err) {
				return callback(err);
			}
      if(Object.keys(user.Passwords).length<1){
        return callback();
      }
      var req_opts = {
        uri: deadbolt.Host + "/api/users/password/",
        method: 'POST',
        json: user
      };
      request(req_opts, function(err, response, body){
        if(err){
          return callback(err);
        }
        if(body.Success){
          return callback();
        }
        else{
          return callback(body.Error);
        }
      });
		});
  }
};
