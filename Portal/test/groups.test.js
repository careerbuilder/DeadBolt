describe('groups', function(){
  var express = require('express');
  var assert = require('assert');
  var rewire = require('rewire');
  var blanket = require('blanket');
  var request = require('supertest');
  var bodyParser = require('body-parser');
  global.config = {DB:{}, kmskey: ""};
  var groups = rewire('../routes/groups.js');

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
      if(args[0].toUpperCase().search('SELECT ID,')>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0].toUpperCase().search('ERROR')>-1){
            return callback("Database Error");
          }
        }
        return callback(null, [{ID: 1, Name: 'testgroup'}, {ID:2, Name:'testgroup2'}]);
      }
      if(args[0].toUpperCase().search('SELECT GROUPS')>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0].toUpperCase().search('ERROR')>-1){
            return callback("Database Error");
          }
        }
        return callback(null, [{ID: 1, Name: 'testgroup', Permissions:"RW"}, {ID:2, Name:'testgroup2', Permissions:"SU"}]);
      }
      if(args[0].toUpperCase().search('INSERT INTO GROUPS')>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0].toUpperCase().search('ERROR')>-1){
            return callback("Database Error");
          }
        }
        return callback(null, {insertId:1});
      }
      if(args[0].toUpperCase().search('SELECT NAME FROM `DATABASES`')>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0]==-1){
            return callback("Database Error");
          }
          if(sql_args[0]==-2){
            return callback(null, []);
          }
        }
        return callback(null, [{Name: 'testdb'}, {Name:'testdb2'}]);
      }
      if(args[0].toUpperCase().search('INSERT INTO HISTORY')>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0].toUpperCase().search('HISTERROR')>-1){
            return callback("Database Error");
          }
        }
        return callback(null, {insertId: 1});
      }
    }
  }

  var error_db = {
    query: function(){
      var callback = arguments[arguments.length-1]; //last arg is callback
      return callback("Database Error");
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
  app.use('/api/groups', groups);

  var db_revert;
  var tools_revert;
  var quiet_revert;
  before(function(){
    db_revert = groups.__set__('connection', mock_db);
    tools_revert = groups.__set__('db_tools', mock_db_tools);
    quiet_revert = groups.__set__('console', {log:function(){}});
  });
  describe('GET /', function(){
    it('should error on DB Error', function(done){
      var error_revert = groups.__set__('connection', error_db);
      request(app)
      .get('/api/groups')
      .expect(200)
      .end(function(err, res){
        assert.equal(res.body.Success, false, 'Successful despite DB Error');
        assert(res.body.Error, 'No Error on DB Error');
        error_revert();
        done();
      });
    });
    it('should return all groups', function(done){
      request(app)
      .get('/api/groups')
      .expect(200)
      .end(function(err, res){
        assert(res.body.Success, 'Unsuccessful request');
        assert(res.body.Results, 'No groups returned');
        done();
      });
    });
  });
  describe('POST /search', function(){
    it('should error on DB Error', function(done){
      request(app)
      .post('/api/groups/search')
      .set('Content-Type', 'application/json')
      .send({Info: "Error"})
      .expect(200)
      .end(function(err, res){
        assert.equal(res.body.Success, false, 'Successful despite DB Error');
        assert(res.body.Error, 'No Error on DB Error');
        done();
      });
    });
    it('should return all groups', function(done){
      request(app)
      .post('/api/groups/search')
      .expect(200)
      .set('Content-Type', 'application/json')
      .end(function(err, res){
        assert(res.body.Success, 'Unsuccessful request');
        assert(res.body.Results, 'No groups returned');
        done();
      });
    });
    it('should return filtered groups', function(done){
      request(app)
      .post('/api/groups/search')
      .expect(200)
      .set('Content-Type', 'application/json')
      .send({Info: 'testgroup'})
      .end(function(err, res){
        assert(res.body.Success, 'Unsuccessful request');
        assert(res.body.Results, 'No groups returned');
        done();
      });
    });
  });
  describe('GET /:username', function(){
    it('should error on DB Error', function(done){
      request(app)
      .get('/api/groups/error')
      .expect(200)
      .end(function(err, res){
        assert.equal(res.body.Success, false, 'Successful despite DB Error');
        assert(res.body.Error, 'No Error on DB Error');
        done();
      });
    });
    it('should return groups for a user', function(done){
      request(app)
      .get('/api/groups/user')
      .expect(200)
      .end(function(err, res){
        assert(res.body.Success, 'Unsuccessful request');
        assert(res.body.Results, 'No Results');
        done();
      });
    });
  });
  describe('POST /', function(){
    it('should error on lack of data', function(done){
      request(app)
      .post('/api/groups/')
      .set('Content-Type', 'application/json')
      .send({})
      .expect(200)
      .end(function(err, res){
        if(err){
          console.log(err);
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Successful despite no info');
        assert(res.body.Error, 'No Error on null body');
        done();
      });
    });
    it('should error on DB Error - insert new group', function(done){
      request(app)
      .post('/api/groups/')
      .set('Content-Type', 'application/json')
      .send({Name: "error"})
      .expect(200)
      .end(function(err, res){
        if(err){
          console.log(err);
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Successful despite db error');
        assert(res.body.Error, 'No Error on db error');
        done();
      });
    });
    it('should error on DB Error - get db1', function(done){
      request(app)
      .post('/api/groups/')
      .set('Content-Type', 'application/json')
      .send({ID: -1, Name: "dberror"})
      .expect(200)
      .end(function(err, res){
        if(err){
          console.log(err);
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Successful despite db error');
        assert(res.body.Error, 'No Error on db error');
        done();
      });
    });
    it('should return ID on empty affected dbs', function(done){
      request(app)
      .post('/api/groups/')
      .set('Content-Type', 'application/json')
      .send({ID: -2, Name: "dberror"})
      .expect(200)
      .end(function(err, res){
        if(err){
          console.log(err);
          return done(err);
        }
        assert(res.body.Success, 'Unsuccessful despite complete request');
        assert(res.body.ID, 'No ID Returned');
        done();
      });
    });
    it('should error on DB Error - delete g_d');
    it('should error on DB Error - add g_d');
    it('should error on DB Error - get db2');
    it('should error on DB Error - get users');
    it.skip('should feed the new id to update', function(done){
      request(app)
      .post('/api/groups/')
      .set('Content-Type', 'application/json')
      .send({Name: "testgroup"})
      .expect(200)
      .end(function(err, res){
        if(err){
          console.log(err);
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Successful despite no info');
        assert(res.body.Error, 'No Error on null body');
        done();
      });
    });
    it.skip('should succeed on update alone', function(done){
      request(app)
      .post('/api/groups/')
      .set('Content-Type', 'application/json')
      .send({ID: 1, Name: "testgroup"})
      .expect(200)
      .end(function(err, res){
        if(err){
          console.log(err);
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Successful despite no info');
        assert(res.body.Error, 'No Error on null body');
        done();
      });
    });
  });
  describe('DELETE /', function(){

  });
  after(function(){
    db_revert();
    tools_revert();
    quiet_revert();
  });
});
