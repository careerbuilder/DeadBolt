describe('users', function(){
  var express = require('express');
  var assert = require('assert');
  var rewire = require('rewire');
  var blanket = require('blanket');
  var request = require('supertest');
  var bodyParser = require('body-parser');
  global.config = {ADAPI:"", DB:{}, kmskey: ""};
  var mysql = require('mysql');
  var users = rewire('../routes/users.js');

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
      //get /:groupid
      if(args[0].search(/^select\s+users.username/i)>-1){
        if(sql_args && sql_args[0] && sql_args[0] == -1){
          return callback("Database Error");
        }
        return callback(null, [{Username: 'testuser', Permissions:'SU', GroupAdmin:0}, {Username: 'testuser2', Permissions:'RW', GroupAdmin:0}]);
      }
      //search
      if(args[0].search(/^select\s+count\(\*\)/i)>-1){
        if(sql_args && sql_args[0] && sql_args[0].toString().search(/counterror/i)>-1){
          return callback("Database Error");
        }
        return callback(null, [{Total: 100}]);
      }
      if(args[0].search(/^select\s+id,\s*username,\s*email/i)>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[sql_args.length-1] == -50){
            return callback("Database Error");
          }
        }
        return callback(null, [{Username: 'testuser', Permissions:'SU'}, {Username: 'testuser2', Permissions:'RW'}]);
      }
      //add user
      if(args[0].search(/^update\s+`users`\s+set\s+`Active`/i)>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0].search(/^upderror$/i)>-1){
            return callback("Database Error");
          }
        }
        return callback();
      }
      //update users
      if(args[0].search(/^select\s+\*\s+from\s+users/i)>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0]==-2){
            return callback("Database Error");
          }
          if(sql_args[0]==-1){
            return callback(null, []);
          }
          if(sql_args[0]==-6){
            return callback(null, [{Username: 'histerror', MySQL_Password:'thisisahashedpassword'}]);
          }
        }
        return callback(null, [{Username: 'testuser', MySQL_Password:'thisisahashedpassword'}]);
      }
      if(args[0].search(/^select\s+Group_ID\s+as\s+ID,/i)>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0]==-3){
            return callback("Database Error");
          }
        }
        return callback(null, [{ID:1, Permissions: 'SU', GroupAdmin:0},{ID:2, Permissions: 'SU', GroupAdmin:1}]);
      }
      if(args[0].search(/^insert\s+into\s+`users_groups`/i)>-1){
        return callback();
      }
      if(args[0].search(/^set\s+@dummy/i)>-1){
        return callback();
      }
      if(args[0].search(/^delete\s+from\s+users_groups.*User_ID\s*=\s*\?/i)>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0]==-4){
            return callback("Database Error");
          }
        }
        return callback();
      }
      if(args[0].search(/^delete\s+from\s+users_groups/i)>-1){
        return callback();
      }
      if(args[0].search(/^select\s+distinct\s+\*\s+from\s+`databases`.*User_ID\s*=\s*\?/i)>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0]==-3){
            return callback("Database Error");
          }
        }
        return callback(null, [{Name: 'testdb', Host:'localhost', Port:8080}]);
      }
      if(args[0].search(/^select\s+distinct\s+\*\s+from\s+`databases`/i)>-1){
        return callback(null, [{Name: 'testdb', Host:'localhost', Port:8080}]);
      }
      if(args[0].search(/^update\s+users\s+set\s+Active\s*=\s*0/i)>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0]==-5){
            return callback("Database Error");
          }
        }
        return callback();
      }
      if(args[0].search(/^insert\s+into\s+history/i)>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0].search(/histerror/i)>-1){
            return callback("Database Error");
          }
        }
        return callback();
      }
    },
    escape: function(val){
      return mysql.escape(val);
    }
  };

  var error_db = {
    query: function(){
      var callback = arguments[arguments.length-1]; //last arg is callback
      return callback("Database Error");
    },
    escape: function(val){
      return mysql.escape(val);
    }
  };

  var mock_db_tools = {
    update_all_users: function(db, callback){
      return callback();
    },
    update_users: function(db, users, callback){
      return callback();
    }
  };

  var mock_transport = {
    sendMail: function(details, callback){
      if(details.to && details.to.search(/error/i)>-1){
        return callback("Mail Error!");
      }
      return callback(null, details);
    }
  };

  var mock_AD = {
    add_user_to_AD: function(user, callback){
      if(user.UserName && user.UserName.search(/aderror/i)>-1){
        return callback("AD_API Error");
      }
      return callback();
    },
    remove_user_from_AD: function(username, callback){
      if(username.search(/error/i)>-1){
        return callback("AD_API Error");
      }
      return callback();
    }
  };

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
  app.use('/api/users', users);

  var db_revert;
  var tools_revert;
  var quiet_revert;
  var auth_revert;
  var ts_revert;
  before(function(){
    db_revert = users.__set__('connection', mock_db);
    tools_revert = users.__set__('db_tools', mock_db_tools);
    transport_revert = users.__set__('transporter', mock_transport);
    ad_api_revert = users.__set__('adapi', mock_AD);
    quiet_revert = users.__set__('console', {log:function(){}});
    auth_revert = users.__set__('auth', mockAuth);
    ts_revert = users.__set__('test_switch', mockAuth);
  });
  describe('GET /:groupid', function(){
    it('should error on db error', function(done){
      request(app)
      .get('/api/users/-1')
      .expect(200)
      .end(function(err, res){
        if(err){
          console.log(err);
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Successful on DB Error');
        assert(res.body.Error, 'No Error on DB Error');
        done();
      });
    });
    it('should return users of the selected group', function(done){
      request(app)
      .get('/api/users/1')
      .expect(200)
      .end(function(err, res){
        if(err){
          console.log(err);
          return done(err);
        }
        assert(res.body.Success, 'Unsuccessful request');
        assert(res.body.Results, 'No Results');
        done();
      });
    });
  });
  describe('POST /search', function(){
    it('should error on db error - no data', function(done){
      request(app)
      .post('/api/users/search/-1')
      .expect(200)
      .end(function(err, res){
        if(err){
          console.log(err);
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Successful on DB Error');
        assert(res.body.Error, 'No Error on DB Error');
        done();
      });
    });
    it('should error on db error - with data', function(done){
      request(app)
      .post('/api/users/search/-1')
      .expect(200)
      .set('Content-Type', 'application/json')
      .send({Info: 'Error'})
      .end(function(err, res){
        if(err){
          console.log(err);
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Successful on DB Error');
        assert(res.body.Error, 'No Error on DB Error');
        done();
      });
    });
    it('should error on db error - get total count', function(done){
      request(app)
      .post('/api/users/search/1')
      .expect(200)
      .set('Content-Type', 'application/json')
      .send({Info: 'CountError'})
      .end(function(err, res){
        if(err){
          console.log(err);
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Successful on DB Error');
        assert(res.body.Error, 'No Error on DB Error');
        done();
      });
    });
    it('should return users of the selected group', function(done){
      request(app)
      .post('/api/users/search/0')
      .expect(200)
      .set('Content-Type', 'application/json')
      .send({Info: 'Error'})
      .end(function(err, res){
        if(err){
          console.log(err);
          return done(err);
        }
        assert(res.body.Success, 'Unsuccessful request');
        assert(res.body.Results, 'No Results');
        assert(res.body.Total, 'No Row Count!');
        done();
      });
    });
  });
  describe('POST /', function(){
    describe('add user', function(){
      it('should error on lack of user info', function(done){
        request(app)
        .post('/api/users')
        .expect(200)
        .end(function(err, res){
          assert.equal(res.body.Success, false, 'Successful despite no info');
          assert(res.body.Error, 'No Error on Null info');
          done();
        });
      });
      it('should error on AD failure', function(){
        request(app)
        .post('/api/users')
        .set('Content-Type', 'application/json')
        .send({ID:1, Username: "ADError", FirstName: "Error", LastName:"Error", Email:"Error@Error.com"})
        .expect(200)
        .end(function(err, res){
          assert.equal(res.body.Success, false, 'Successful despite AD Error');
          assert(res.body.Error, 'No Error on AD Error');
          done();
        });
      });
      it('should error on db error - update', function(done){
        request(app)
        .post('/api/users')
        .set('Content-Type', 'application/json')
        .send({ID:1, Username: "upderror", FirstName: "user", LastName:"name", Email:"email@email.com"})
        .expect(200)
        .end(function(err, res){
          assert.equal(res.body.Success, false, 'Successful DB Error');
          assert(res.body.Error, 'No Error on DB Error');
          done();
        });
      });
      it('should proceed on mail failure', function(done){
        request(app)
        .post('/api/users')
        .set('Content-Type', 'application/json')
        .send({ID:1, Username: "Username", FirstName: "user", LastName:"name", Email:"error@email.com"})
        .expect(200)
        .end(function(err, res){
          assert(res.body.Success, 'Unsuccessful request');
          assert(res.body.Active, 'No Results');
          done();
        });
      });
    });
    describe('update user', function(){
      it('should error on db error - select user', function(done){
        request(app)
        .post('/api/users')
        .set('Content-Type', 'application/json')
        .send({ID: -2, Username: "username", FirstName: "user", LastName:"name", Email:"email@email.com", Active:1})
        .expect(200)
        .end(function(err, res){
          assert.equal(res.body.Success, false, 'Successful despite DB Error');
          assert(res.body.Error, 'No Error on DB Error');
          done();
        });
      });
      it('should error on invalid user', function(done){
        request(app)
        .post('/api/users')
        .set('Content-Type', 'application/json')
        .send({ID: -1, Username: "username", FirstName: "user", LastName:"name", Email:"email@email.com", Active:1})
        .expect(200)
        .end(function(err, res){
          assert.equal(res.body.Success, false, 'Successful invalid user');
          assert(res.body.Error, 'No Error despite invalid user');
          done();
        });
      });
      it('should error on db error - get groups', function(done){
        request(app)
        .post('/api/users')
        .set('Content-Type', 'application/json')
        .send({ID: -3, Username: "username", FirstName: "user", LastName:"name", Email:"email@email.com", Active:1})
        .expect(200)
        .end(function(err, res){
          assert.equal(res.body.Success, false, 'Successful despite DB Error');
          assert(res.body.Error, 'No Error on DB Error');
          done();
        });
      });
      it('should exit early on unchanged groups', function(done){
        request(app)
        .post('/api/users')
        .set('Content-Type', 'application/json')
        .send({ID: 1, Username: "username", FirstName: "user", LastName:"name", Email:"email@email.com", Groups:[{ID:1, Permissions: 'SU', GroupAdmin:0},{ID:2, Permissions: 'SU', GroupAdmin:1}], Active:1})
        .expect(200)
        .end(function(err, res){
          assert(res.body.Success, false, 'Unuccessful despite no change');
          done();
        });
      });
      it('should succeed with just add', function(done){
        request(app)
        .post('/api/users')
        .set('Content-Type', 'application/json')
        .send({
          ID: 1,
          Username: "username",
          FirstName: "user",
          LastName:"name",
          Email:"email@email.com",
          Groups:[{ID:1, Permissions: 'SU', GroupAdmin:0},{ID:2, Permissions: 'SU', GroupAdmin:1}, {ID:3, Permissions: 'SU', GroupAdmin:0},{ID:4, Permissions: 'SU', GroupAdmin:1}],
          Active:1})
        .expect(200)
        .end(function(err, res){
          assert(res.body.Success, false, 'Unuccessful despite valid change');
          done();
        });
      });
      it('should succeed with just delete', function(done){
        request(app)
        .post('/api/users')
        .set('Content-Type', 'application/json')
        .send({ID: 1, Username: "username", FirstName: "user", LastName:"name", Email:"email@email.com", Groups:[], Active:1})
        .expect(200)
        .end(function(err, res){
          assert(res.body.Success, false, 'Unuccessful despite valid change');
          done();
        });
      });
      it('should succeed with edits', function(done){
        request(app)
        .post('/api/users')
        .set('Content-Type', 'application/json')
        .send({ID: 1, Username: "username", FirstName: "user", LastName:"name", Email:"email@email.com", Groups:[{ID:2, Permissions: 'SU', GroupAdmin:0}, {ID:3, Permissions: 'SU', GroupAdmin:0}], Active:1})
        .expect(200)
        .end(function(err, res){
          assert(res.body.Success, false, 'Unuccessful despite valid change');
          done();
        });
      });
      it('should error on db error - add group', function(done){
        var db_err_revert = users.__set__('connection', {
          query:function(){
            var sql_args = [];
            var args = [];
            for(var i=0; i<arguments.length; i++){
              args.push(arguments[i]);
            }
            var callback = args[args.length-1]; //last arg is callback
            if(args.length > 2){
              sql_args = args[1];
            }
            if(args[0].search(/^select\s+\*\s+from\s+users/i)>-1){
              if(sql_args && sql_args[0]){
                if(sql_args[0]==-2){
                  return callback("Database Error");
                }
                if(sql_args[0]==-1){
                  return callback(null, []);
                }
                if(sql_args[0]==-6){
                  return callback(null, [{Username: 'histerror', MySQL_Password:'thisisahashedpassword'}]);
                }
              }
              return callback(null, [{Username: 'testuser', MySQL_Password:'thisisahashedpassword'}]);
            }
            if(args[0].search(/^select\s+Group_ID\s+as\s+ID,/i)>-1){
              if(sql_args && sql_args[0]){
                if(sql_args[0]==-3){
                  return callback("Database Error");
                }
              }
              return callback(null, [{ID:1, Permissions: 'SU', GroupAdmin:0},{ID:2, Permissions: 'SU', GroupAdmin:1}]);
            }
            if(args[0].search(/insert\s+into\s+`users_groups`/i)>-1){
              return callback('Database Error!');
            }
            if(args[0].search(/^set\s+@dummy/i)>-1){
              return callback();
            }
          },
          escape: function(val){
            return mysql.escape(val);
          }
        });
        request(app)
        .post('/api/users')
        .set('Content-Type', 'application/json')
        .send({User_ID: 1, Username: "username", FirstName: "user", LastName:"name", Email:"email@email.com", Groups:[{ID:3, Permissions: 'SU', GroupAdmin:0},{ID:4, Permissions: 'SU', GroupAdmin:1}], Active:1})
        .expect(200)
        .end(function(err, res){
          assert.equal(res.body.Success, false, 'Successful despite DB Error');
          assert(res.body.Error, 'No Error on DB Error');
          db_err_revert();
          done();
        });
      });
      it('should error on db error - del group', function(done){
        var db_err_revert = users.__set__('connection', {
          query:function(){
            var sql_args = [];
            var args = [];
            for(var i=0; i<arguments.length; i++){
              args.push(arguments[i]);
            }
            var callback = args[args.length-1]; //last arg is callback
            if(args.length > 2){
              sql_args = args[1];
            }
            if(args[0].search(/^select\s+\*\s+from\s+users/i)>-1){
              if(sql_args && sql_args[0]){
                if(sql_args[0]==-2){
                  return callback("Database Error");
                }
                if(sql_args[0]==-1){
                  return callback(null, []);
                }
                if(sql_args[0]==-6){
                  return callback(null, [{Username: 'histerror', MySQL_Password:'thisisahashedpassword'}]);
                }
              }
              return callback(null, [{Username: 'testuser', MySQL_Password:'thisisahashedpassword'}]);
            }
            if(args[0].search(/^select\s+Group_ID\s+as\s+ID,/i)>-1){
              if(sql_args && sql_args[0]){
                if(sql_args[0]==-3){
                  return callback("Database Error");
                }
              }
              return callback(null, [{ID:1, Permissions: 'SU', GroupAdmin:0},{ID:2, Permissions: 'SU', GroupAdmin:1}]);
            }
            if(args[0].search(/insert\s+into\s+`users_groups`/i)>-1){
              return callback();
            }
            if(args[0].search(/^set\s+@dummy/i)>-1){
              return callback();
            }
            if(args[0].search(/^delete\s+from\s+users_groups/i)>-1){
              return callback('Database Error!');
            }
          },
          escape: function(val){
            return mysql.escape(val);
          }
        });
        request(app)
        .post('/api/users')
        .set('Content-Type', 'application/json')
        .send({User_ID: -3, Username: "username", FirstName: "user", LastName:"name", Email:"email@email.com", Groups:[], Active:1})
        .expect(200)
        .end(function(err, res){
          assert.equal(res.body.Success, false, 'Successful despite DB Error');
          assert(res.body.Error, 'No Error on DB Error');
          db_err_revert();
          done();
        });
      });
      it('should error on db error - select dbs', function(done){
        var db_err_revert = users.__set__('connection', {
          query:function(){
            var sql_args = [];
            var args = [];
            for(var i=0; i<arguments.length; i++){
              args.push(arguments[i]);
            }
            var callback = args[args.length-1]; //last arg is callback
            if(args.length > 2){
              sql_args = args[1];
            }
            if(args[0].search(/^select\s+\*\s+from\s+users/i)>-1){
              if(sql_args && sql_args[0]){
                if(sql_args[0]==-2){
                  return callback("Database Error");
                }
                if(sql_args[0]==-1){
                  return callback(null, []);
                }
                if(sql_args[0]==-6){
                  return callback(null, [{Username: 'histerror', MySQL_Password:'thisisahashedpassword'}]);
                }
              }
              return callback(null, [{Username: 'testuser', MySQL_Password:'thisisahashedpassword'}]);
            }
            if(args[0].search(/^select\s+Group_ID\s+as\s+ID,/i)>-1){
              if(sql_args && sql_args[0]){
                if(sql_args[0]==-3){
                  return callback("Database Error");
                }
              }
              return callback(null, [{ID:1, Permissions: 'SU', GroupAdmin:0},{ID:2, Permissions: 'SU', GroupAdmin:1}]);
            }
            if(args[0].search(/insert\s+into\s+`users_groups`/i)>-1){
              return callback();
            }
            if(args[0].search(/^set\s+@dummy/i)>-1){
              return callback();
            }
            if(args[0].search(/^delete\s+from\s+users_groups/i)>-1){
              return callback();
            }
            if(args[0].search(/^select\s+distinct\s+\*\s+from\s+`databases`/i)>-1){
              return callback('Database Error!');
            }
          },
          escape: function(val){
            return mysql.escape(val);
          }
        });
        request(app)
        .post('/api/users')
        .set('Content-Type', 'application/json')
        .send({ID: 1, Username: "username", FirstName: "user", LastName:"name", Email:"email@email.com", Groups:[], Active:1})
        .expect(200)
        .end(function(err, res){
          assert.equal(res.body.Success, false, 'Successful despite DB Error');
          assert(res.body.Error, 'No Error on DB Error');
          db_err_revert();
          done();
        });
      });
      it('should resume on history error', function(done){
        request(app)
        .post('/api/users')
        .set('Content-Type', 'application/json')
        .send({ID: 1, Username: "histerror", FirstName: "user", LastName:"name", Email:"email@email.com", Groups:[], Active:1})
        .expect(200)
        .end(function(err, res){
          assert(res.body.Success, 'Unsuccessful request');
          assert(res.body.Active, 'No Results');
          done();
        });
      });
      it('should succeed on valid arguments', function(done){
        request(app)
        .post('/api/users')
        .set('Content-Type', 'application/json')
        .send({User_ID: 1, Username: "username", FirstName: "user", LastName:"name", Email:"email@email.com", Groups:[], Active:1})
        .expect(200)
        .end(function(err, res){
          assert(res.body.Success, 'Unsuccessful request');
          assert(res.body.Active, 'No Results');
          done();
        });
      });
    });
  });
  describe('DELETE /:id', function(){
    it('should fail on db error - get users', function(done){
      request(app)
      .delete('/api/users/-2')
      .expect(200)
      .end(function(err, res){
        assert.equal(res.body.Success, false, 'Successful despite DB Error');
        assert(res.body.Error, 'No Error on DB Error');
        done();
      });
    });
    it('should fail on invalid user', function(done){
      request(app)
      .delete('/api/users/-1')
      .expect(200)
      .end(function(err, res){
        assert.equal(res.body.Success, false, 'Successful invalid user');
        assert(res.body.Error, 'No Error on invalid user');
        done();
      });
    });
    it('should fail on db error - get databases',function(done){
      request(app)
      .delete('/api/users/-3')
      .expect(200)
      .end(function(err, res){
        assert.equal(res.body.Success, false, 'Successful despite DB Error');
        assert(res.body.Error, 'No Error on DB Error');
        done();
      });
    });
    it('should fail on db error - delete u_g', function(done){
      request(app)
      .delete('/api/users/-4')
      .expect(200)
      .end(function(err, res){
        assert.equal(res.body.Success, false, 'Successful despite DB Error');
        assert(res.body.Error, 'No Error on DB Error');
        done();
      });
    });
    it('should fail on db error - update users', function(done){
      request(app)
      .delete('/api/users/-5')
      .expect(200)
      .end(function(err, res){
        assert.equal(res.body.Success, false, 'Successful despite DB Error');
        assert(res.body.Error, 'No Error on DB Error');
        done();
      });
    });
    it('should succeed despite db error - history', function(done){
      request(app)
      .delete('/api/users/-6')
      .expect(200)
      .end(function(err, res){
        assert(res.body.Success, 'Unsuccessful request');
        assert(res.body.Error, 'No Error on History Error');
        done();
      });
    });
    it('should return success on valid input', function(done){
      request(app)
      .delete('/api/users/1')
      .expect(200, {Success:true}, done);
    });
  });
  after(function(){
    db_revert();
    tools_revert();
    transport_revert();
    ad_api_revert();
    quiet_revert();
    auth_revert();
    ts_revert();
  });
});
