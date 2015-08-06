describe('users', function(){
  var express = require('express');
  var assert = require('assert');
  var rewire = require('rewire');
  var blanket = require('blanket');
  var request = require('supertest');
  var bodyParser = require('body-parser');
  global.config = {ADAPI:"", DB:{}, kmskey: ""};
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
        var sql_args = args[1];
      }
      if(args[0].search(/^select\s+users.username/i)>-1){
        if(sql_args && sql_args[0] && sql_args[0] == -1){
          return callback("Database Error");
        }
        return callback(null, [{Username: 'testuser', Permissions:'SU'}, {Username: 'testuser2', Permissions:'RW'}]);
      }
      if(args[0].search(/^select\s+count\(\*\)/i)>-1){
        if(sql_args && sql_args[0] && sql_args[0].toString().search(/counterror/i)>-1){
          return callback("Database Error");
        }
        return callback(null, [{Total: 100}]);
      }
      if(args[0].search(/^select\s+id,\s+username/i)>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0] == -50 || sql_args[4] == -50){
            return callback("Database Error");
          }
        }
        return callback(null, [{Username: 'testuser', Permissions:'SU'}, {Username: 'testuser2', Permissions:'RW'}]);
      }
      if(args[0].search(/^insert\s+into\s+users[^_]/i)>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0].search(/dberror1/i)>-1){
            return callback("Database Error");
          }
        }
        return callback(null, {insertId: 1});
      }
      if(args[0].search(/^update\s+possible_users/i)>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0]==-5){
            return callback("Database Error");
          }
        }
        if(sql_args && sql_args[1]){
          if(sql_args[1].search(/dberror2/i)>-1){
            return callback("Database Error");
          }
        }
        return callback(null, {insertId: 1});
      }
      if(args[0].search(/^select\s+distinct\s+\*\s+from\s+`databases`/i)>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0]==-1){
            return callback("Database Error");
          }
        }
        return callback(null, [{Name: 'testdb', Host:'localhost', Port:8080}]);
      }
      if(args[0].search(/^select\s+\*\s+from\s+users/i)>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0]==-2){
            return callback("Database Error");
          }
          if(sql_args[0]==-6){
            return callback(null, [{Username: 'histerror', MySQL_Password:'thisisahashedpassword'}]);

          }
        }
        return callback(null, [{Username: 'testuser', MySQL_Password:'thisisahashedpassword'}]);
      }
      if(args[0].search(/^delete\s+from\s+users_groups/i)>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0]==-3){
            return callback("Database Error");
          }
        }
        return callback();
      }
      if(args[0].search(/^insert\s+into\s+users_groups/i)>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0]==1){
            return callback("Database Error");
          }
        }
        return callback();
      }
      if(args[0].search(/^set\s+@dummy/i)>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0]==1){
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
      if(args[0].search(/^delete\s+from\s+users/i)>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0]==-4){
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

  var mock_transport = {
    sendMail: function(details, callback){
      if(details.to && details.to.search(/error/i)>-1){
        return callback("Mail Error!");
      }
      return callback(null, details);
    }
  }

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
  }

  var app = express();
  app.use(bodyParser.urlencoded({extended: true}));
  app.use(bodyParser.json());
  app.use('/api/users', users);

  var db_revert;
  var tools_revert;
  var quiet_revert;
  before(function(){
    db_revert = users.__set__('connection', mock_db);
    tools_revert = users.__set__('db_tools', mock_db_tools);
    transport_revert = users.__set__('transporter', mock_transport);
    ad_api_revert = users.__set__('adapi', mock_AD);
    quiet_revert = users.__set__('console', {log:function(){}});
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
        .send({Username: "ADError", FirstName: "Error", LastName:"Error", Email:"Error@Error.com"})
        .expect(200)
        .end(function(err, res){
          assert.equal(res.body.Success, false, 'Successful despite AD Error');
          assert(res.body.Error, 'No Error on AD Error');
          done();
        });
      });
      it('should error on db error - insert', function(done){
        request(app)
        .post('/api/users')
        .set('Content-Type', 'application/json')
        .send({Username: "DBError1", FirstName: "user", LastName:"name", Email:"email@email.com"})
        .expect(200)
        .end(function(err, res){
          assert.equal(res.body.Success, false, 'Successful DB Error');
          assert(res.body.Error, 'No Error on DB Error');
          done();
        });
      });
      it('should error on db error - update', function(done){
        request(app)
        .post('/api/users')
        .set('Content-Type', 'application/json')
        .send({Username: "DBError2", FirstName: "user", LastName:"name", Email:"email@email.com"})
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
        .send({Username: "Username", FirstName: "user", LastName:"name", Email:"error@email.com"})
        .expect(200)
        .end(function(err, res){
          assert(res.body.Success, 'Unsuccessful request');
          assert(res.body.User_ID, 'No Results');
          done();
        });
      });
      it('should pass the new ID in to update', function(done){
        request(app)
        .post('/api/users')
        .set('Content-Type', 'application/json')
        .send({Username: "Username", FirstName: "user", LastName:"name", Email:"email@email.com", Groups:[]})
        .expect(200)
        .end(function(err, res){
          assert(res.body.Success, 'Unsuccessful request');
          assert(res.body.User_ID, 'No Results');
          done();
        });
      });
    });
    describe('update user', function(){
      it('should error on db error - select dbs', function(done){
        request(app)
        .post('/api/users')
        .set('Content-Type', 'application/json')
        .send({User_ID: -1, Username: "username", FirstName: "user", LastName:"name", Email:"email@email.com"})
        .expect(200)
        .end(function(err, res){
          assert.equal(res.body.Success, false, 'Successful despite DB Error');
          assert(res.body.Error, 'No Error on DB Error');
          done();
        });
      });
      it('should error on db error - select users', function(done){
        request(app)
        .post('/api/users')
        .set('Content-Type', 'application/json')
        .send({User_ID: -2, Username: "username", FirstName: "user", LastName:"name", Email:"email@email.com", Groups:{1:'SU', 4:'RW'}})
        .expect(200)
        .end(function(err, res){
          assert.equal(res.body.Success, false, 'Successful despite DB Error');
          assert(res.body.Error, 'No Error on DB Error');
          done();
        });
      });
      it('should error on db error - del group', function(done){
        request(app)
        .post('/api/users')
        .set('Content-Type', 'application/json')
        .send({User_ID: -3, Username: "username", FirstName: "user", LastName:"name", Email:"email@email.com", Groups:{1:'SU', 4:'RW'}})
        .expect(200)
        .end(function(err, res){
          assert.equal(res.body.Success, false, 'Successful despite DB Error');
          assert(res.body.Error, 'No Error on DB Error');
          done();
        });
      });
      it('should error on db error - add group', function(done){
        request(app)
        .post('/api/users')
        .set('Content-Type', 'application/json')
        .send({User_ID: 1, Username: "username", FirstName: "user", LastName:"name", Email:"email@email.com", Groups:{1:'ER', 4:'RW'}})
        .expect(200)
        .end(function(err, res){
          assert.equal(res.body.Success, false, 'Successful despite DB Error');
          assert(res.body.Error, 'No Error on DB Error');
          done();
        });
      });
      it('should resume on history error', function(done){
        request(app)
        .post('/api/users')
        .set('Content-Type', 'application/json')
        .send({User_ID: 1, Username: "histerror", FirstName: "user", LastName:"name", Email:"email@email.com", Groups:{2:'SU', 4:'RW'}})
        .expect(200)
        .end(function(err, res){
          assert(res.body.Success, 'Unsuccessful request');
          assert(res.body.User_ID, 'No Results');
          done();
        });
      });
      it('should succeed on valid arguments', function(done){
        request(app)
        .post('/api/users')
        .set('Content-Type', 'application/json')
        .send({User_ID: 1, Username: "username", FirstName: "user", LastName:"name", Email:"email@email.com", Groups:{2:'SU', 4:'RW'}})
        .expect(200)
        .end(function(err, res){
          assert(res.body.Success, 'Unsuccessful request');
          assert(res.body.User_ID, 'No Results');
          assert.equal(res.body.User_ID, 1, 'IDs do not match!');
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
    it('should fail on db error - get databases',function(done){
      request(app)
      .delete('/api/users/-1')
      .expect(200)
      .end(function(err, res){
        assert.equal(res.body.Success, false, 'Successful despite DB Error');
        assert(res.body.Error, 'No Error on DB Error');
        done();
      });
    });
    it('should fail on db error - delete u_g', function(done){
      request(app)
      .delete('/api/users/-3')
      .expect(200)
      .end(function(err, res){
        assert.equal(res.body.Success, false, 'Successful despite DB Error');
        assert(res.body.Error, 'No Error on DB Error');
        done();
      });
    });
    it('should fail on db error - delete from users', function(done){
      request(app)
      .delete('/api/users/-4')
      .expect(200)
      .end(function(err, res){
        assert.equal(res.body.Success, false, 'Successful despite DB Error');
        assert(res.body.Error, 'No Error on DB Error');
        done();
      });
    });
    it('should fail on db error - update possible_users', function(done){
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
  });
});
