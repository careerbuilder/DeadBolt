var request = require('request');
var deadbolt = global.config.Deadbolt;

module.exports = {
  update_user:function(user, callback){
    if('Password' in user){
      delete user.Password;
    }
    if('Salt' in user){
      delete user.Salt;
    }
    if('Reset_ID' in user){
      delete user.Reset_ID;
    }
    if('portal' in user.Passwords){
      delete user.Passwords.portal;
    }
    if(Object.keys(user.Passwords).length<1){
      return callback();
    }
    var req_opts = {
      uri: deadbolt.Host + "/api/users/passwordchange/",
      method: 'POST',
      headers:{
        authorization: deadbolt.APIKey
      },
      json: user
    };
    request(req_opts, function(err, response, body){
      if(err){
        console.log(err);
        return callback(err);
      }
      if(body.Success){
        return callback();
      }
      else{
        return callback(body.Error);
      }
    });
  }
};
