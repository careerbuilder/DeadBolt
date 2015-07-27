describe('errors', function(){
  var express = require('express');
  var assert = require('assert');
  var rewire = require('rewire');
  var blanket = require('blanket');
  var request = require('supertest');
  var bodyParser = require('body-parser');
  global.config = {DB:{}, kmskey: ""};
  var errors = rewire('../routes/errors.js');

  var mock_db = {
    query: function(){
      var sql_args = [];
      var args = [];
      for(var i=0; i<arguments.length; i++){
        args.push(arguments[i]);
      }
      var callback = args[args.length-1]; //last arg is callback
      if(args.length > 2){
        var sql_args = args[1];
      }
      if(args[0].toUpperCase().search('SELECT *') >-1){
        return callback(null, [{Acknowledged:0, User: 'testuser', DB:'testdb'}]);
      }
      if(args[0].toUpperCase().search('UPDATE ERRORS') >-1){
        if(sql_args[0]==-1){
          return callback('Database Error');
        }
        return callback();
      }
      if(args[0].toUpperCase().search('SELECT USERS') >-1){
        if(sql_args[0]===-2){
          return callback('Database Error');
        }
        if(sql_args[0]===-3){
          return callback(null, [{Retryable:0}]);
        }
        return callback(null, [{Retryable:1}]);
      }
    }
  }

  var mock_db_tools = {
    update_all_users: function(db, callback){
      return callback();
    },
    update_users: function(db, users, callback){
      return callback();
    }
  }

  var app = express();
  app.use(bodyParser.urlencoded({extended: true}));
  app.use(bodyParser.json());
  app.use('/api/errors', errors);

  var db_revert;
  var tools_revert;
  var quiet_revert;
  before(function(){
    db_revert = errors.__set__('connection', mock_db);
    tools_revert = errors.__set__('db_tools', mock_db_tools);
    quiet_revert = errors.__set__('console', {log:function(){}});
  });
  describe('GET /', function(){
    it('should error on db error', function(done){
      var error_revert = errors.__set__('connection', {
        query: function(){
          var callback = arguments[arguments.length-1];
          return callback('Database Error');
        }
      });
      request(app)
      .get('/api/errors')
      .expect(200)
      .end(function(err, res){
        if(err){
          console.log(err);
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Success returned despite db error');
        assert(res.body.Error, 'No Error on DB Error');
        error_revert();
        done();
      });
    });
    it('should return a list of errors', function(done){
      request(app)
      .get('/api/errors')
      .expect(200)
      .end(function(err, res){
        if(err){
          console.log(err);
          return done(err);
        }
        assert(res.body.Success, 'Unsuccessful request');
        assert(res.body.Results, 'No results');
        done();
      });
    });
  });
  describe('DELETE /:id', function(){
    it('should error on db error', function(done){
      request(app)
      .delete('/api/errors/-1')
      .expect(200)
      .end(function(err, res){
        if(err){
          console.log(err);
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Success despite DB Error');
        assert(res.body.Error, 'No Error on DB Error');
        done();
      });
    });
    it('should succeed on valid ID', function(done){
      request(app)
      .delete('/api/errors/1')
      .expect(200, {Success: true}, done);
    });
  });
  describe('POST /retry/:id', function(){
    it('should error on null id');
    it('should error on invalid id');
    it('should error on update error');
    it('should return success on valid retry');
  });
  describe('POST /retry/', function(){
    it('should error on null id');
    it('should error on invalid id');
    it('should error on update error');
    it('should return success on valid retry');
  });
  after(function(){
    db_revert();
    tools_revert();
    quiet_revert();
  });

});
