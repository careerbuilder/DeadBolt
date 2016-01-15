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
      // Get / and search
      if(args[0].search(/SELECT\s+ID,\s+Name\s+from\s+groups/i)>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0].search(/ERROR/i)>-1){
            return callback("Database Error");
          }
        }
        return callback(null, [{ID: 1, Name: 'testgroup'}, {ID:2, Name:'testgroup2'}]);
      }
      // get/:username
      if(args[0].search(/SELECT\s+GROUPS\.ID\s+as\s+Group_ID/i)>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0].search(/ERROR/i)>-1){
            return callback("Database Error");
          }
        }
        return callback(null, [{Group_ID: 1, Name: 'testgroup', Permissions:"RW", GroupAdmin:0}, {Group_ID:2, Name:'testgroup2', Permissions:"SU", GroupAdmin:0}]);
      }
      if(args[0].toUpperCase().search('INSERT INTO GROUPS_DATABASES')>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0]==-4){
            return callback("Database Error");
          }
        }
        return callback(null, {insertId:1});
      }
      if(args[0].toUpperCase().search('DELETE FROM GROUPS_DATABASES')>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0]==-3){
            return callback("Database Error");
          }
        }
        return callback(null, {});
      }
      if(args[0].toUpperCase().search('INSERT INTO GROUPS ')>-1){
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
          if(sql_args[0] == 1){
            return callback(null, {insertId: 1});
          }
          if(sql_args[0] == -8){
            return callback("Database Error");
          }
          if(sql_args[0].toUpperCase().search('HISTERROR')>-1){
            return callback("Database Error");
          }
        }
        return callback(null, {insertId: 1});
      }
      if(args[0].toUpperCase().search('`DATABASES`.NAME')>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0].toUpperCase().search('ERROR')>-1){
            return callback("Database Error");
          }
        }
        return callback(null, [{ID:1, Name: 'testdb'}, {ID:2, Name:'testdb2'}]);
      }
      if(args[0].toUpperCase().search('FROM USERS WHERE')>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0]==-5){
            return callback("Database Error");
          }
        }
        return callback(null, [{ID:1, Name: 'testuser'}, {ID:2, Name:'testuser2'}]);
      }
      if(args[0].toUpperCase().search('FROM `DATABASES` WHERE ID')>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0]==-1){
            return callback("Database Error");
          }
        }
        return callback(null, [{ID:1, Name: 'testuser'}, {ID:2, Name:'testuser2'}]);
      }
      if(args[0].toUpperCase().search('DELETE FROM USERS_GROUPS')>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0]==-6){
            return callback("Database Error");
          }
        }
        return callback();
      }
      if(args[0].toUpperCase().search('DELETE FROM GROUPS')>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0]==-7){
            return callback("Database Error");
          }
        }
        return callback();
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

  var mockAuth = {
    auth: function(req, res, next){
      res.locals.user= {Username: 'test', 'Admins':[-1]};
      return next();
    },
    isAdmin: function(req,res,next){
      res.locals.user= {Username: 'test', 'Admins':[-1]};
      return next();
    }
  };

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
    auth_revert = groups.__set__('auth', mockAuth);
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
    it('should error on DB Error - delete g_d', function(done){
      request(app)
      .post('/api/groups/')
      .set('Content-Type', 'application/json')
      .send({ID: -3, Name: "dberror"})
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
    it('should error on DB Error - add g_d', function(done){
      request(app)
      .post('/api/groups/')
      .set('Content-Type', 'application/json')
      .send({ID: -4, Name: "dberror", Databases:["test1", "test2"]})
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
    it('should error on DB Error - get db2', function(done){
      request(app)
      .post('/api/groups/')
      .set('Content-Type', 'application/json')
      .send({ID: -2, Name: "dberror", Databases:["error", "test2"]})
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
    it('should error on DB Error - get users', function(done){
      request(app)
      .post('/api/groups/')
      .set('Content-Type', 'application/json')
      .send({ID: -5, Name: "dberror", Databases:["error", "test2"]})
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
    it('should feed the new id to update', function(done){
      request(app)
      .post('/api/groups/')
      .set('Content-Type', 'application/json')
      .send({Name: "testgroup", Databases:["test1", "test2"]})
      .expect(200)
      .end(function(err, res){
        if(err){
          console.log(err);
          return done(err);
        }
        assert(res.body.Success, 'Unsuccessful request');
        assert(res.body.ID, 'No ID Returned');
        done();
      });
    });
    it('should succeed on update alone', function(done){
      request(app)
      .post('/api/groups/')
      .set('Content-Type', 'application/json')
      .send({ID: 1, Name: "testgroup", Databases:["test1", "test2"]})
      .expect(200)
      .end(function(err, res){
        if(err){
          console.log(err);
          return done(err);
        }
        assert(res.body.Success, 'Unsuccessful request');
        assert(res.body.ID, 'No ID Returned');
        assert.equal(res.body.ID, 1, 'Returned ID does not match fed ID');
        done();
      });
    });
  });
  describe('DELETE /', function(){
    it('should error on DB Error - get db1', function(done){
      request(app)
      .delete('/api/groups/-1')
      .set('Content-Type', 'application/json')
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
    it('should error on DB Error - get users', function(done){
      request(app)
      .delete('/api/groups/-5')
      .set('Content-Type', 'application/json')
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
    it('should error on DB Error - delete g_d', function(done){
      request(app)
      .delete('/api/groups/-3')
      .set('Content-Type', 'application/json')
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
    it('should error on DB Error - delete u_g', function(done){
      request(app)
      .delete('/api/groups/-6')
      .set('Content-Type', 'application/json')
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
    it('should error on DB Error - delete groups', function(done){
      request(app)
      .delete('/api/groups/-7')
      .set('Content-Type', 'application/json')
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
    it('should succeed on history error', function(done){
      request(app)
      .delete('/api/groups/-8')
      .set('Content-Type', 'application/json')
      .expect(200)
      .end(function(err, res){
        if(err){
          console.log(err);
          return done(err);
        }
        assert(res.body.Success, 'Unsuccessful despite history error');
        assert(res.body.Error, 'No Error on history error');
        done();
      });
    });
    it('should succeed on valid input', function(done){
      request(app)
      .delete('/api/groups/1')
      .set('Content-Type', 'application/json')
      .expect(200, {Success:true}, done);
    });
  });
  after(function(){
    db_revert();
    tools_revert();
    quiet_revert();
    auth_revert();
  });
});
