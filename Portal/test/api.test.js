describe('api', function(){
  var express = require('express');
  var assert = require('assert');
  var rewire = require('rewire');
  var blanket = require('blanket');
  var request = require('supertest');
  var crypto  = require('crypto');
  var bodyParser = require('body-parser');
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
      if(args[0].search(/SELECT\s+EXPIRES/i)>-1){
        if(args.length< 3 || !args[1][0]){
          return callback('No Session Token Provided!');
        }
        if(args[1][0].search(/EXPIRED/i)>-1){
          return callback(null, [{Expires: ~~(new Date().getTime()/1000)-500}]);
        }
        if(args[1][0].search(/INVALID/i)>-1){
          return callback(null, []);
        }
        if(args[1][0].search(/ERROR/i)>-1){
          return callback("ERROR");
        }
        else{
          return callback(null, [{Expires: ~~(new Date().getTime()/1000)+500}]);
        }
      }
      if(args[0].search(/SELECT\s+ACTIVE/i)>-1){
        if(args.length< 3 || !args[1][0]){
          return callback('No Email Provided!');
        }
        if(args[1][0].search(/INVALID/i)>-1){
          return callback(null, []);
        }
        else if(args[1][0].search(/EXISTING/i)>-1){
          return callback(null, [{Active: 1}]);
        }
        else{
          return callback(null, [{Active: 0}]);
        }
      }
      if(args[0].search(/UPDATE\s+PORTAL/i)>-1){
        if(args.length< 3 || args[1].length < 3){
          return callback('Missing arguments!');
        }
        if(args[1][2].search(/ERROR/i) >-1){
          return callback('Database lookup error');
        }
        else{
          return callback();
        }
      }
      if(args[0].search(/SELECT\s+EMAIL,/i)>-1){
        if(args.length< 3 || !args[1][0]){
          return callback('No Email Provided!');
        }
        if(args[1][0].search(/INVALID/i)>-1){
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
      if(args[0].search(/SELECT\s+TIME/i)>-1){
        if(args.length< 3 || !args[1][0]){
          return callback('No Timerange Provided!');
        }
        if(args[1][0].search(/ERROR/i)>-1){
          return callback('Database Error!');
        }
        else{
          return callback(null, [{Time: ~~(new Date().getTime()/1000), Activity:"Tested history!"}]);
        }
      }
    }
  }

  var mockAuth = {
    auth: function(req, res, next){
      return next();
    }
  }

  app = express();
  app.use(bodyParser.urlencoded({extended: true}));
  app.use(bodyParser.json());
  app.use('/api/', api);

  var db_revert;
  var auth_revert;
  var quiet_revert;
  before(function(){
    quiet_revert = api.__set__('console', {log: function(){}});
    db_revert = api.__set__('connection', mock_db);
    auth_revert = api.__set__('auth', mockAuth);
  });
  describe('GET /', function(){
    it('should return 200', function(done){
      request(app)
      .get('/api/')
      .expect(200, done);
    });
  });
  describe('POST /auth', function(){
    it('should fail when no token is provided', function(done){
      request(app)
      .post('/api/auth/')
      .set('Content-Type', 'application/json')
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Succeeded with no token');
        assert.equal(res.body.valid, false, 'Invalid token considered valid');
        done();
      });
    });
    it('should error on db error', function(done){
      request(app)
      .post('/api/auth/')
      .set('Content-Type', 'application/json')
      .send({Session: "ErrorSessionToken"})
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Succeeded on db error');
        assert.equal(res.body.valid, false, 'Invalid token considered valid');
        assert(res.body.Error, 'No Error on error');
        done();
      });
    });
    it('should fail when an invalid session token is provided', function(done){
      request(app)
      .post('/api/auth/')
      .set('Content-Type', 'application/json')
      .send({Session: "InvalidSessionToken"})
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Succeeded with invalid creds');
        assert.equal(res.body.valid, false, 'Invalid token considered valid');
        done();
      });
    });
    it('should fail when an expired token is provided', function(done){
      request(app)
        .post('/api/auth/')
        .set('Content-Type', 'application/json')
        .send({Session: "expiredSessionToken"})
        .expect(200)
        .end(function(err, res){
          if(err){
            return done(err);
          }
          assert(res.body.Success, 'Succeeded with expired creds');
          assert.equal(res.body.valid, false, 'Expired token considered valid');
          done();
        });
    });
    it('should succeed when a valid token is provided', function(done){
      request(app)
      .post('/api/auth/')
      .set('Content-Type', 'application/json')
      .send({Session: "validSessionToken"})
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert(res.body.Success, 'Session lookup failed');
        assert(res.body.valid, 'Session considered invalid despite future expiration');
        done();
      });
    });
  });
  describe('POST /signup', function(){
    it('should error on null email', function(done){
      request(app)
      .post('/api/signup')
      .set('Content-Type', 'application/json')
      .send({})
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert(res.body.Error, 'No error on null email!');
        done();
      });
    });
    it('should err on uninvited email', function(done){
      request(app)
      .post('/api/signup')
      .set('Content-Type', 'application/json')
      .send({Email:'invalidemail'})
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert(res.body.Error, 'No error on invalid email');
        assert.equal(res.body.Success, false, 'Treating invalid email as success');
        done();
      });
    });
    it('should err on existing email', function(done){
      request(app)
      .post('/api/signup')
      .set('Content-Type', 'application/json')
      .send({Email:'existingemail'})
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert(res.body.Error, 'No error on existing email');
        assert.equal(res.body.Success, false, 'Treating existing email as success');
        done();
      });
    });
    it('should fail with no password', function(done){
      request(app)
      .post('/api/signup')
      .set('Content-Type', 'application/json')
      .send({Email:'validemail'})
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert(res.body.Error, 'no Error with no password');
        assert.equal(res.body.Success, false, 'Succeeded without a password!');
        done();
      });
    });
    it('should throw an error on db connection error', function(done){
      request(app)
      .post('/api/signup')
      .set('Content-Type', 'application/json')
      .send({Email:'erroremail', Password:'password'})
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert(res.body.Error, 'No error despite Database Error');
        assert.equal(res.body.Success, false, 'Succeeded despite db error!');
        done();
      });
    });
    it('should succeed with valid email and pass', function(done){
      request(app)
      .post('/api/signup')
      .set('Content-Type', 'application/json')
      .send({Email:'validemail', Password:'validpassword'})
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert.equal(false, !!res.body.Error, 'Throws an error on successful signup');
        assert.equal(res.body.Success, true, 'Fails to register valid email');
        assert(res.body.Message, 'Did not return success message');
        done();
      });
    });
  });
  describe('POST /login', function(done){
    it('should fail with no args', function(done){
      request(app)
      .post('/api/login')
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
      .post('/api/login')
      .set('Content-Type', 'application/json')
      .send({Email: 'nopassword'})
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert(res.body.Error, 'No Error despite null password');
        done();
      });
    });
    it('should fail with invalid email', function(done){
      request(app)
      .post('/api/login')
      .set('Content-Type', 'application/json')
      .send({Email: 'invalidemail', Password:'somepass'})
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
      .post('/api/login')
      .set('Content-Type', 'application/json')
      .send({Email: 'validemail', Password:'invalidpass'})
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
      request(app)
      .post('/api/login')
      .set('Content-Type', 'application/json')
      .send({Email: 'validemail', Password:'password'})
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
      .post('/api/login')
      .set('Content-Type', 'application/json')
      .send({Email: 'validemail', Password:'password'})
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
  describe('GET /history/:time', function(){
    it('should fail without a time length', function(done){
      request(app)
      .get('/api/history/')
      .expect(404, done);
    });
    it('should return errors on database errors', function(done){
      request(app)
      .get('/api/history/error')
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert(res.body.Error, 'Database error not being thrown');
        done();
      });
    });
    it('should return history', function(done){
      request(app)
      .get('/api/history/7')
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert(res.body.Success, 'Success is false despite succeeding');
        assert(res.body.History, 'No History returned');
        done();
      });
    });
  });
  after(function(){
    db_revert();
    auth_revert();
    quiet_revert();
  });
});
