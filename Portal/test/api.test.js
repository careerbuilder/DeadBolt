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
      // Signup
      if(args[0].search(/SELECT\s+Portal_Password,\s+ACTIVE/i)>-1){
        if(args.length< 3 || !args[1][0]){
          return callback('No Email Provided!');
        }
        if(args[1][0].search(/INVALID/i)>-1){
          return callback(null, []);
        }
        else if(args[1][0].search(/EXISTING/i)>-1){
          return callback(null, [{Portal_Password:'password', Active: 1}]);
        }
        else if(args[1][0].search(/^Error/i)>-1){
          return callback('DBError!');
        }
        else{
          return callback(null, [{Portal_Password:'password', Active: 0}]);
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
      // LogIn
      if(args[0].search(/SELECT\s+ID,\s+EMAIL,/i)>-1){
        if(args.length< 3 || !args[1][0]){
          return callback('No Email Provided!');
        }
        if(args[1][0].search(/INVALID/i)>-1){
          return callback(null, []);
        }
        else{
          var salt = 'randomstring'
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
      //History
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
      res.locals.user= {Username: 'test', 'Admins':[-1]};
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
    it('should err on uninvited email', function(done){
      request(app)
      .post('/api/signup')
      .set('Content-Type', 'application/json')
      .send({Email:'invalidemail', Password:'password'})
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
      .send({Email:'existingemail', Password:'password'})
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
    it('should throw an error on db connection error - lookup', function(done){
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
    it('should throw an error on db connection error - update', function(done){
      request(app)
      .post('/api/signup')
      .set('Content-Type', 'application/json')
      .send({Email:'upderroremail', Password:'password'})
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
        if(args[0].toUpperCase().search('SELECT ID, EMAIL,')>-1){
          var salt = 'randomstring'
          var shasum = crypto.createHash('sha512');
          shasum.update(salt + 'password');
          var passcheck = shasum.digest('hex');
          return callback(null, [{ID:1, Email:args[1][0], Salt: salt, Portal_Password:passcheck, Portal_Salt:salt}]);
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
  describe('POST /auth', function(){
    it('should error on bad access', function(done){
      var error_revert = api.__set__('auth',{
        auth: function(req, res, next){
          return res.send({Success: false, Error: 'UnAuthorized'});
        }
      });
      request(app)
      .post('/api/auth/')
      .set('Content-Type', 'application/json')
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Succeeded on auth error');
        error_revert();
        done();
      });
    });
    it('should return limited auth', function(done){
      var error_revert = api.__set__('auth',{
        auth: function(req, res, next){
          res.locals.user = {Username:"test", Admins:[2,3,4]}
          return next();
        }
      });
      request(app)
      .post('/api/auth/')
      .set('Content-Type', 'application/json')
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert.equal(res.body.Success, true, 'did not succeed with valid creds');
        assert.equal(res.body.FullAdmin, false, 'group admin considered full');
        error_revert();
        done();
      });
    });
    it('should succeed as full user', function(done){
      request(app)
        .post('/api/auth/')
        .set('Content-Type', 'application/json')
        .expect(200)
        .end(function(err, res){
          if(err){
            return done(err);
          }
          assert(res.body.Success, 'Did not succeed as full Admin');
          assert(res.body.FullAdmin, 'Was not considered admin');
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
