describe('auth', function(){
  var express = require('express');
  var assert = require('assert');
  var rewire = require('rewire');
  var blanket = require('blanket');
  var request = require('supertest');
  var crypto  = require('crypto');
  var bodyParser = require('body-parser');
  global.config = {DB:{}, kmskey: ""};
  var auth = rewire('../routes/auth.js');

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
      // Login
      if(args[0].search(/SELECT\s+users\.ID,\s+Portal_Salt,\s+Portal_Password/i)>-1){
        var passhash = crypto.createHash('sha512');
        passhash.update('randomstring'+'password');
        if(args.length< 3 || !args[1][0]){
          return callback('No Username Provided!');
        }
        if(args[1][0].search(/INVALID/i)>-1){
          return callback(null, []);
        }
        else if(args[1][0].search(/EXISTING/i)>-1){
          return callback(null, [{ID: 1, Portal_Salt: 'randomstring', Portal_Password:passhash.digest('hex'), Active: 1}]);
        }
        else if(args[1][0].search(/^Error/i)>-1){
          return callback('DBError!');
        }
        else{
          return callback(null, [{ID:1, Portal_Salt: 'randomstring', Portal_Password:passhash.digest('hex'), Active: 0}]);
        }
      }
      if(args[0].search(/UPDATE\s+Users/i)>-1){
        if(args.length< 3 || args[1].length < 3){
          return callback('Missing arguments!');
        }
        if(args[1][2].search(/updERROR/i) >-1){
          return callback('Database lookup error');
        }
        else{
          return callback();
        }
      }
      // LogIn2
      if(args[0].search(/SELECT\s+ID,\s+EMAIL,/i)>-1){
        if(args.length< 3 || !args[1][0]){
          return callback('No Email Provided!');
        }
        if(args[1][0].search(/INVALID/i)>-1){
          return callback(null, []);
        }
        else{
          var salt = 'randomstring';
          var shasum = crypto.createHash('sha512');
          shasum.update(salt + 'password');
          var passcheck = shasum.digest('hex');
          return callback(null, [{ID: 1, Email:args[1][0], Salt: salt, Portal_Password:passcheck, Portal_Salt:salt}]);
        }
      }
      if(args[0].search(/INSERT\s+INTO\s+SESSIONS/i)>-1){
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
      //forgot
      if(args[0].search(/SELECT\s+ID\s+from\s+Users/i)>-1){
        if(args.length< 3 || !args[1][0]){
          return callback('No Email Provided!');
        }
        if(args[1][0].search(/ERROR/i)>-1){
          return callback('Database Error!');
        }
        if(args[1][0].search(/invalid/i)>-1){
          return callback(null, []);
        }
        else{
          return callback(null, [{ID:1}]);
        }
      }
    }
  };

  app = express();
  app.use(bodyParser.urlencoded({extended: true}));
  app.use(bodyParser.json());
  app.use('/api/auth/', auth);

  var db_revert;
  var quiet_revert;
  before(function(){
    quiet_revert = auth.__set__('console', {log: function(){}});
    db_revert = auth.__set__('connection', mock_db);
  });
  describe('POST /login', function(done){
    it('should fail with no args', function(done){
      request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert(res.body.Error, 'No Error despite null arguments');
        done();
      });
    });
    it('should fail with no password', function(done){
      request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({Username: 'nopassword'})
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert(res.body.Error, 'No Error despite null password');
        done();
      });
    });
    it('should fail with invalid username', function(done){
      request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({Username: 'invalidemail', Password:'somepass'})
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Success returned despite invalid email');
        done();
      });
    });
    it('should fail with invalid password', function(done){
      request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({Username: 'validemail', Password:'invalidpass'})
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Success returned despite invalid password');
        done();
      });
    });
    it('should return an error on database errors', function(done){
      var error_revert = auth.__set__('connection',{
      query: function(){
        var sql_args = [];
        var args = [];
        for(var i=0; i<arguments.length; i++){
          args.push(arguments[i]);
        }
        var callback = args[args.length-1]; //last arg is callback
        if(args[0].toUpperCase().search('SELECT ID, Portal_Salt,')>-1){
          var salt = 'randomstring';
          var shasum = crypto.createHash('sha512');
          shasum.update(salt + 'password');
          var passcheck = shasum.digest('hex');
          return callback(null, [{ID:1, Username:args[1][0], Salt: salt, Portal_Password:passcheck, Portal_Salt:salt}]);
        }
        else{
          return callback("Database Error!");
        }
      }
      });
      request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({Username: 'validemail', Password:'password'})
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert(res.body.Error, 'No error on database error');
        error_revert();
        done();
      });
    });
    it('should return a session id with valid auth', function(done){
      request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send({Username: 'validemail', Password:'password'})
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert(res.body.Success, 'Success is false on successful login');
        assert.equal(false, !!res.body.Error, 'Error despite valid login');
        assert(res.body.Session, 'No session ID returned');
        assert(res.headers['set-cookie'], 'No session cookie included');
        done();
      });
    });
  });
  describe('POST /forgot', function(){
    it('should error on missing email', function(done){
      request(app)
      .post('/api/auth/forgot/')
      .set('Content-Type', 'application/json')
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Succeeded on error');
        assert(res.body.Error.search(/missing email/i)>-1, 'Incorrect error!');
        done();
      });
    });
    it('should error on db error', function(done){
      request(app)
      .post('/api/auth/forgot/')
      .set('Content-Type', 'application/json')
      .send({Email: 'erroremail'})
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Succeeded on db error');
        assert(res.body.Error.search(/database/i)>-1, 'Incorrect error!');
        done();
      });
    });
    it('should error on empty result set', function(done){
      request(app)
      .post('/api/auth/forgot/')
      .set('Content-Type', 'application/json')
      .send({Email: 'invalidemail'})
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Succeeded on invalid suer');
        assert(res.body.Error.search(/no\s+user/i)>-1, 'Incorrect error!');
        done();
      });
    });
    //@TODO Mock out email send
  });
  describe('POST /reset', function(){
    it('should error on missing resetid', function(done){
      request(app)
      .post('/api/auth/reset/')
      .set('Content-Type', 'application/json')
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Succeeded on error');
        assert(res.body.Error.search(/missing reset/i)>-1, 'Incorrect error!');
        done();
      });
    });
    //@TODO: mock out password propagate
  });
  after(function(){
    db_revert();
    quiet_revert();
  });
});
