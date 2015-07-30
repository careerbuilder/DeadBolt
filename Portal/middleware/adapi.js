var request = require('request');

var host = global.config.ADAPI;

module.exports = {
  add_user_to_AD: function(userinfo, callback){
    var payload = {
      user: userinfo
    };
    var req_opts = {
      uri: host + "/api/createUser/",
      method: 'POST',
      json: payload
    };
    request(req_opts, function(err, response, body){
      if(err){
        return callback(err);
      }
      return callback(null, body);
    });
  },
  remove_user_from_AD: function(username, callback){
    var req_opts = {
      uri: host+"/api/removeUser/",
      method: 'POST',
      json: {user: {UserName: username}}
    };
    request(req_opts, function(err, response, body){
      if(err){
        return callback(err, body);
      }
      return callback(null, body);
    });
  }
}
