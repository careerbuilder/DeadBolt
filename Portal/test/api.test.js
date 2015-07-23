var assert = require('assert');
var rewire = require('rewire');
var blanket = require('blanket');
var crypto  = require('crypto');
global.config = {DB:{}, kmskey: ""};
var api = rewire('../routes/api.js');

var mock_db = {
  query: function(){
    var sql_args = [];
    var args = [];
    for(var i=0; i<arguments.length; i++){
      args.push(arguments[i]);
    }
    var callback = args[args.length-1]; //last arg is callback
    if(args.length > 2){
      sql_args = args[1];
    }
    if(args[0].toUpperCase().search('SELECT EXPIRES')>-1){
      if(args.length< 3 || !args[1][0]){
        return callback('No Session Token Provided!');
      }
      if(args[1][0].toUpperCase().search('EXPIRED')>-1){
        return callback(null, [{Expires: ~~(new Date().getTime()/1000)-500}]);
      }
      if(args[1][0].toUpperCase().search('INVALID')>-1){
        return callback(null, []);
      }
      else{
        return callback(null, [{Expires: ~~(new Date().getTime()/1000)+500}]);
      }
    }
    if(args[0].toUpperCase().search('SELECT ACTIVE')>-1){
      if(args.length< 3 || !args[1][0]){
        return callback('No Email Provided!');
      }
      if(args[1][0].toUpperCase().search('INVALID')>-1){
        return callback(null, []);
      }
      else if(args[1][0].toUpperCase().search('EXISTING')>-1){
        return callback(null, [{Active: 1}]);
      }
      else{
        return callback(null, [{Active: 0}]);
      }
    }
    if(args[0].toUpperCase().search('UPDATE PORTAL')>-1){
      if(args.length< 3 || args[1].length < 3){
        return callback('Missing arguments!');
      }
      if(args[1][2].toUpperCase().search('ERROR') >-1){
        return callback('Database lookup error');
      }
      else{
        return callback();
      }
    }
    if(args[0].toUpperCase().search('SELECT EMAIL,')>-1){
      if(args.length< 3 || !args[1][0]){
        return callback('No Email Provided!');
      }
      if(args[1][0].toUpperCase().search('INVALID')>-1){
        return callback(null, []);
      }
      else{
        var salt = 'randomstring'
        var shasum = crypto.createHash('sha256');
        shasum.update(salt + 'password');
        var passcheck = shasum.digest('hex');
        return callback(null, [{Email:args[1][0], Salt: salt, Password:passcheck}]);
      }
    }
    if(args[0].toUpperCase().search('INSERT INTO SESSIONS')>-1){
      if(args.length< 3 || !args[1][0]){
        return callback('No sessionid Provided!');
      }
      if(args.length< 3 || !args[1][1]){
        return callback('No expiration Provided!');
      }
      else{
        return callback();
      }
    }
    if(args[0].toUpperCase().search('SELECT TIME')>-1){
      if(args.length< 3 || !args[1][0]){
        return callback('No Timerange Provided!');
      }
      if(args[1][0] === 'ERROR'){
        return callback('Database Error!');
      }
      else{
        return callback(null, [{Time: ~~(new Date().getTime()/1000), Activity:"Tested history!"}]);
      }
    }
  }
}

describe('api', function(){
  var db_revert;
  before(function(){
    db_revert = api.__set__('connection', mock_db);
  });
  describe('#validate_session()', function(){
    var validate = api.__get__('validate_session');
    it('should fail when no token is provided', function(done){
      failure = validate({body:{}}, function(err, result){
        assert(err, 'No Error thrown on null session');
        done();
      });
    });
    it('should fail when an invalid is provided', function(done){
      failure = validate({body:{Session: "InvalidSessionToken"}}, function(err, result){
        assert.equal(result.Success, false, 'Session lookup succeed for fake token');
        assert.equal(result.valid, false, 'Session considered valid despite expiration');
        done();
      });
    });
    it('should fail when an expired token is provided', function(done){
      failure = validate({body:{Session: "expiredSessionToken"}}, function(err, result){
        assert(result.Success, 'Session lookup failed');
        assert.equal(result.valid, false, 'Session considered valid despite expiration');
        done();
      });
    });
    it('should succeed when a valid token is provided', function(done){
      validate({body:{Session: "validSessionToken"}}, function(err, result){
        assert(result.Success, 'Session lookup failed');
        assert(result.valid, 'Session considered invalid despite future expiration');
        done();
      });
    });
  });

  describe('#signup()', function(){
    var signup = api.__get__('signup');
    it('should error on null email', function(done){
      signup({body:{}}, function(err, result){
        assert(err, 'No error on null email!');
        done();
      });
    });
    it('should err on uninvited email', function(done){
      signup({body:{email:'invalidemail'}}, function(err, result){
        assert(err, 'No error on invalid email');
        assert.equal(result.Success, false, 'Treating invalid email as success');
        done();
      });
    });
    it('should err on existing email', function(done){
      signup({body:{email:'existingemail'}}, function(err, result){
        assert(err, 'No error on existing email');
        assert.equal(result.Success, false, 'Treating existing email as success');
        done();
      });
    });
    it('should fail with no password', function(done){
      signup({body:{email:'validemail'}}, function(err, result){
        assert(err, 'no Error with no password');
        assert.equal(result.Success, false, 'Succeeded without a password!');
        done();
      });
    });
    it('should throw an error on db connection error', function(done){
      signup({body:{email:'erroremail', password:'password'}}, function(err, result){
        assert(err, 'No error despite Database Error');
        assert.equal(result.Success, false, 'Succeeded despite db error!');
        done();
      });
    });
    it('should succeed with valid email and pass', function(done){
      signup({body:{email:'validemail', password:'validpassword'}}, function(err, result){
        assert.equal(false, !!err, 'Throws an error on successful signup');
        assert.equal(result.Success, true, 'Fails to register valid email');
        assert(result.Message, 'Did not return success message');
        done();
      });
    });
  });

  describe('#login()', function(done){
    var login = api.__get__('login');
    it('should fail with no args', function(done){
      login({body:{}}, function(err, result){
        assert(err, 'No Error despite null arguments');
        done();
      });
    });
    it('should fail with no password', function(done){
      login({body:{email: 'nopassword'}}, function(err, result){
        assert(err, 'No Error despite null password');
        done();
      });
    });
    it('should fail with invalid email', function(done){
      login({body:{email: 'invalidemail', password:'somepass'}}, function(err, result){
        assert(err, 'No Error despite invalid email');
        done();
      });
    });
    it('should fail with invalid password', function(done){
      login({body:{email: 'validemail', password:'invalidpass'}}, function(err, result){
        assert(err, 'No Error despite invalid password');
        done();
      });
    });
    it('should return an error on database errors', function(done){
      var error_revert = api.__set__('connection',{
      query: function(){
        var sql_args = [];
        var args = [];
        for(var i=0; i<arguments.length; i++){
          args.push(arguments[i]);
        }
        var callback = args[args.length-1]; //last arg is callback
        if(args[0].toUpperCase().search('SELECT EMAIL,')>-1){
          var salt = 'randomstring'
          var shasum = crypto.createHash('sha256');
          shasum.update(salt + 'password');
          var passcheck = shasum.digest('hex');
          return callback(null, [{Email:args[1][0], Salt: salt, Password:passcheck}]);
        }
        else{
          return callback("Database Error!");
        }
      }
      });
      login({body:{email: 'validemail', password:'password'}}, function(err, result){
        assert(err, 'No error on database error');
        error_revert();
        done();
      });
    });
    it('should return a session id with valid auth', function(done){
      login({body:{email: 'validemail', password:'password'}}, function(err, result){
        assert.equal(false, !!err, 'Error despite valid login');
        assert(result.Success, 'Success is false on successful login');
        assert(result.Session, 'No session ID returned');
        done();
      });
    });
  });
  describe('#get_history()', function(){
    var get_history = api.__get__('get_history');
    it('should fail without a time length', function(done){
      get_history({params:{}}, function(err, results){
        assert(err, 'No error with missing arguments');
        done();
      });
    });
    it('should return errors on database errors', function(done){
      get_history({params:{timelength:'ERROR'}}, function(err, result){
        assert(err, 'Database error not being thrown');
        done();
      });
    });
    it('should return history', function(done){
      get_history({params:{timelength:7}}, function(err, result){
        assert.equal(false, !!err, 'Error retreiving history');
        assert(result.Success, 'Success is false despite succeeding');
        assert(result.History, 'No History returned');
        done();
      });
    });
  });
  describe('endpoints', function(){
    it('should not need to do this', function(){
      api.get('/', function(){}, function(){
        console.log(arguments);
      });
    });
  });
  after(function(){
    db_revert();
  });
});
