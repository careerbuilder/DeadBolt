var request = require('request');
var deadbolt = global.config.Deadbolt;
var mysql = require('mysql');

var pool = mysql.createPool(deadbolt.DB);

module.exports = {
  update_user:function(user, callback){
    pool.getConnection(function(err, connection) {
    	if(err) {
				return callback(err);
			}
      if(Object.keys(user.Passwords).length<1){
        return callback();
      }
      var q = "Update users SET MySQL_Password=?, SQL_Server_Password=? Where Username=?;";
	    connection.query(q, [user.Passwords.mysql, user.Passwords.mssql, user.Username], function(err, results) {
	      connection.release(); // always put connection back in pool after last query
	      if(err){
					console.log(err);
					return callback(err);
				}
        var req_opts = {
          uri: deadbolt.Host + "/api/users/password/"+user.Username,
          method: 'PUT'
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
		});
  }
};
