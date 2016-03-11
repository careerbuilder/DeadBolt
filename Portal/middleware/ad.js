var exec 		= require('child_process').exec;
var crypto  = require('crypto');

function executeAD(query, callback){
  var child = exec(query); //call out to AD
  var err = "";
  var output = "";
  child.stdout.on('data', function(data) {
    //console.log('stdout: ' + data);
    output += data;
  });
  child.stderr.on('data', function(data) {
      //console.log('stderr: ' + data);
      err += data;
  });
  child.on('close', function(code) {
      callback(err, output);
  });
}


module.exports = {
  addUser:function(user, callback){
    if(user.IsSVC){
      return callback(null, 'service accounts do not need to be added to the AD');
    }
    var firstName = user.FirstName.trim().replace(/\s+/ig, '');
    var lastName = user.LastName.trim().replace(/\s+/ig, '');
    var fullName = firstName + ' ' + lastName;
    var DN = '"CN='+ fullName + ', ' + global.config.AD.Userspath;
    var uname = '-upn ' + user.Username.trim() + '@'+global.config.AD.Domain + ' -samid ' + user.Username.trim();
    var name = '-fn ' + firstName + ' -ln ' + lastName + ' -display "' + fullName + '"'; //map username, first, last, and email handle
    var email = '-email ' + user.Email.trim();
    var password = '-pwd ' + crypto.randomBytes(16).toString('hex');
    var addstring = 'dsadd user ' + DN + ' ' + name + ' ' + email + ' ' + uname + ' ' + password;
    console.log('adding',JSON.stringify(user));
    executeAD(addstring, function(err, data){
      if(err){
        if(err.indexOf("name that is already in use") >-1){
          executeAD("dsquery user -samid " + user.Username + " | dsmod user -disabled no", function(err, data){
            if(err){
              return callback(err);
            }
            console.log("User " + user.Username + " re-enabled");
            return callback(null, data);
          });
        }
        else{
  		      return callback(err);
        }
      }
      else{
  	     console.log("Added User " + user.Username);
         return callback(null, data);
      }
    });
  },
  removeUser:function(user, callback){
    if(user.IsSVC){
      return callback(null, 'service accounts do not need to be added to the AD');
    }
    var samid = user.Username.trim();
    executeAD("dsquery user -samid " + samid + " | dsmod user -disabled yes", function(err, data){
      if(err){
        return callback(err);
      }
      else{
  		  console.log("Disabled User " + user.Username);
        return callback(null, data);
      }
    });
  },
  changePassword:function(user, callback){
    if(user.IsSVC){
      return callback(null, 'service accounts do not need to be added to the AD');
    }
    executeAD("dsquery user -samid " + user.Username + " | dsmod user -pwd " + user.Password, function(err, data){
      if(err){
        return callback(err);
      }
      console.log("User " + user.Username + " changed their password");
      return callback(null, data);
    });
  }
};
