describe('databases', function(){
  var express = require('express');
  var assert = require('assert');
  var rewire = require('rewire');
  var blanket = require('blanket');
  var request = require('supertest');
  var bodyParser = require('body-parser');
  global.config = {DB:{}, kmskey: ""};
  var databases = rewire('../routes/databases.js');

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
      if(args[0].toUpperCase().search('SELECT ID') >-1){

        if(sql_args && sql_args[0]){
          if(sql_args[0].toUpperCase().search('ERROR')>-1){
            return callback("Database Error");
          }
        }
        return callback(null, [{ID:1, Name: 'testing', Type:'mysql', Host: 'localhost', Port:8080, SAUser:'sauser'}]);
      }
      else if(args[0].toUpperCase().search('SELECT NAME') >-1){

        if(sql_args && sql_args[0]){
          if(sql_args[0].toUpperCase().search('ERROR')>-1){
            return callback("Database Error");
          }
        }
        return callback(null, [{ID:1, Name: 'testing', Type:'mysql', Host: 'localhost', Port:8080, SAUser:'sauser'}]);
      }
      else if(args[0].toUpperCase().search('SELECT *') >-1){

        if(sql_args && sql_args[0]){
          if(sql_args[0].toUpperCase().search('ERROR1')>-1){
            return callback("Database Error");
          }
          if(sql_args[0].toUpperCase().search('ERROR4')>-1){
            return callback(null, [{ID:1, Name: 'error', Type:'mysql', Host: 'localhost', Port:8080, SAUser:'sauser', SAPass: 'password'}]);
          }
        }
        return callback(null, [{ID:1, Name: 'testing', Type:'mysql', Host: 'localhost', Port:8080, SAUser:'sauser', SAPass: 'password'}]);
      }
      else if(args[0].toUpperCase().search('DELETE FROM GROUPS_') >-1){

        if(sql_args && sql_args[0]){
          if(sql_args[0].toUpperCase().search('ERROR2')>-1){
            return callback("Database Error");
          }
        }
        return callback(null, [{ID:1, Name: 'testing', Type:'mysql', Host: 'localhost', Port:8080, SAUser:'sauser', SAPass: 'password'}]);
      }
      else if(args[0].toUpperCase().search('DELETE FROM `DATABASES`') >-1){

        if(sql_args && sql_args[0]){
          if(sql_args[0].toUpperCase().search('ERROR3')>-1){
            return callback("Database Error");
          }
        }
        return callback(null, [{ID:1, Name: 'testing', Type:'mysql', Host: 'localhost', Port:8080, SAUser:'sauser', SAPass: 'password'}]);
      }
      else if(args[0].toUpperCase().search('INSERT INTO `DATABASES`') >-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0].toUpperCase().search('ERROR1')>-1){
            return callback("Database Error");
          }
          if(sql_args[0].toUpperCase().search('ERROR2')>-1){
            return callback(null, {insertId:-1});
          }
        }
        return callback(null, {insertId:1});
      }
      else if(args[0].toUpperCase().search('INSERT INTO GROUPS_DATABASES') >-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0]===-1){
            return callback("Database Error");
          }
        }
        return callback(null, {insertId:1});
      }
      else if(args[0].search(/update\s+`databases`/i) >-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0].search(/upderror/i)>-1){
            return callback("Database Error");
          }
        }
        return callback(null, {insertId:1});
      }
      else if(args[0].search(/history/i) >-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0].search(/error/i)>-1){
            return callback("Database Error");
          }
        }
        return callback(null, {insertId:1});
      }
      else{
        return callback("DB Error");
      }
    }
  }

  var mock_encrypt = {
    encrypt: function(plaintext, callback){
      if(!plaintext || plaintext.length <1){
        return callback("No text to encrypt!");
      }
      if(plaintext.search(/encerror/i)>-1){
        return callback("Encryption Error!");
      }
      return callback(null, "0x" + plaintext);
    },
    decrypt: function(cipher, callback){
      if(!cipher || cipher.length<3){
        return callback("Invalid cipher!");
      }
      return callback(null, cipher.substring(2));
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
  app.use('/api/databases', databases);

  var db_revert;
  var enc_revert;
  var tools_revert;
  var quiet_revert;
  before(function(){
    db_revert = databases.__set__('connection', mock_db);
    enc_revert = databases.__set__('encryption', mock_encrypt);
    tools_revert = databases.__set__('db_tools', mock_db_tools);
    quiet_revert = databases.__set__('console', {log:function(){}});
  });
  describe('GET /', function(){
    it('should return an error on db error', function(done){
      var error_revert = databases.__set__('connection', {query: function(){
        var callback = arguments[arguments.length-1];
        return callback("DB Error");
      }});
      request(app)
      .get('/api/databases')
      .expect(200)
      .end(function(err, res){
        assert.equal(res.body.Success, false, 'Successful request, despite db error');
        assert(res.body.Error, 'No Error Thrown');
        error_revert();
        done();
      });
    });
    it('should return a list of all databases', function(done){
      request(app)
      .get('/api/databases')
      .expect(200)
      .end(function(err, res){
        assert(res.body.Success, 'Unsuccessful request');
        assert(res.body.Results, 'No Results');
        done();
      });
    });
  });
  describe('POST /search', function(){
    it('should return an error on DB Error', function(done){
      request(app)
      .post('/api/databases/search')
      .set('Content-Type', 'application/json')
      .send({Info: 'Error'})
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Error marked as success');
        assert(res.body.Error, 'No error on DB Error');
        done();
      });
    });
    it('should return an a list of databases on null argument', function(done){
      request(app)
      .post('/api/databases/search')
      .set('Content-Type', 'application/json')
      .send()
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert(res.body.Success, 'Unsuccessful request');
        assert(res.body.Results, 'No Results from search');
        done();
      });
    });
  });
  describe('GET /:group', function(){
    it('should return an error on DB Error', function(done){
      request(app)
      .get('/api/databases/error')
      .expect(200)
      .end(function(err, res){
        if(err){
          console.log(err);
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Successful despite DB Error');
        assert(res.body.Error, 'No error on DB Error');
        done();
      });
    });
    it('should return a list of databases for a given group', function(done){
      request(app)
      .get('/api/databases/groupname')
      .expect(200)
      .end(function(err, res){
        if(err){
          console.log(err);
          return done(err);
        }
        assert(res.body.Success,'Unsuccessful request');
        assert(res.body.Results, 'No databases returned');
        done();
      });
    });
  });
  describe('DELETE /:id', function(){
    it('should error on database error - select', function(done){
      request(app)
      .delete('/api/databases/error1')
      .expect(200)
      .end(function(err, res){
        if(err){
          console.log(err);
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Successful request despite error');
        assert(res.body.Error, 'No Error on DB Error');
        done();
      });
    });
    it('should error on database error - delete g_d', function(done){
      request(app)
      .delete('/api/databases/error2')
      .expect(200)
      .end(function(err, res){
        if(err){
          console.log(err);
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Successful request despite error');
        assert(res.body.Error, 'No Error on DB Error');
        done();
      });
    });
    it('should error on database error - delete databases', function(done){
      request(app)
      .delete('/api/databases/error3')
      .expect(200)
      .end(function(err, res){
        if(err){
          console.log(err);
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Successful request despite error');
        assert(res.body.Error, 'No Error on DB Error');
        done();
      });
    });
    it('should error on database error - insert', function(done){
      request(app)
      .delete('/api/databases/error4')
      .expect(200)
      .end(function(err, res){
        if(err){
          console.log(err);
          return done(err);
        }
        assert(res.body.Error, 'No Error on DB Error');
        done();
      });
    });
    it('should return successfully on valid ID', function(done){
      request(app)
      .delete('/api/databases/7')
      .expect(200, {Success: true}, done);
    });
  });
  describe('POST /', function(){
    it('should fail if called without all data', function(done){
      request(app)
      .post('/api/databases/')
      .set('Content-Type', 'application/json')
      .send({})
      .expect(200)
      .end(function(err, res){
        if(err){
          return done(err);
        }
        assert.equal(res.body.Success, false, 'Successful post with no data');
        assert(res.body.Error, 'No Error on null body');
        done();
      });
    });
    describe('add database', function(){
      it('should fail on db error - insert database', function(done){
        request(app)
        .post('/api/databases/')
        .set('Content-Type', 'application/json')
        .send({Name: 'error1', Type: 'mysql', Host:'localhost', Port: 8080, SAUser:'sauser', SAPass: 'somepass'})
        .expect(200)
        .end(function(err, res){
          if(err){
            return done(err);
          }
          assert.equal(res.body.Success, false, 'Successful post despite db error');
          assert(res.body.Error, 'No Error on DB Error');
          done();
        });
      });
      it('should fail on db error - insert groups_databases', function(done){
        request(app)
        .post('/api/databases/')
        .set('Content-Type', 'application/json')
        .send({Name: 'error2', Type: 'mysql', Host:'localhost', Port: 8080, SAUser:'sauser', SAPass: 'somepass'})
        .expect(200)
        .end(function(err, res){
          if(err){
            return done(err);
          }
          assert.equal(res.body.Success, false, 'Successful post despite db error');
          assert(res.body.Error, 'No Error on DB Error');
          done();
        });
      });
      it('should still work on history error', function(done){
        request(app)
        .post('/api/databases/')
        .set('Content-Type', 'application/json')
        .send({Name: 'error', Type: 'mysql', Host:'localhost', Port: 8080, SAUser:'sauser', SAPass: 'somepass'})
        .expect(200)
        .end(function(err, res){
          if(err){
            return done(err);
          }
          assert(res.body.Success, 'Unsuccessful post');
          assert(res.body.ID, 'No ID Returned');
          done();
        });
      });
    });
    describe('update database', function(){
      it('should fail on new password encryption error', function(done){
        request(app)
        .post('/api/databases/')
        .set('Content-Type', 'application/json')
        .send({ID:-1, Name: 'testuser', Type: 'mysql', Host:'localhost', Port: 8080, SAUser:'sauser', SAPass: 'encerror'})
        .expect(200)
        .end(function(err, res){
          if(err){
            return done(err);
          }
          assert.equal(res.body.Success, false, 'Successful post despite db error');
          assert(res.body.Error, 'No Error on DB Error');
          done();
        });
      });
      it('should fail on db error - update database', function(done){
        request(app)
        .post('/api/databases/')
        .set('Content-Type', 'application/json')
        .send({ID:-1, Name: 'upderror', Type: 'mysql', Host:'localhost', Port: 8080, SAUser:'sauser'})
        .expect(200)
        .end(function(err, res){
          if(err){
            return done(err);
          }
          assert.equal(res.body.Success, false, 'Successful post despite db error');
          assert(res.body.Error, 'No Error on DB Error');
          done();
        });
      });
      it('should still work on history error', function(done){
        request(app)
        .post('/api/databases/')
        .set('Content-Type', 'application/json')
        .send({ID:1, Name: 'error', Type: 'mysql', Host:'localhost', Port: 8080, SAUser:'sauser', SAPass: 'somepass'})
        .expect(200)
        .end(function(err, res){
          if(err){
            return done(err);
          }
          assert(res.body.Success, 'Unsuccessful post');
          assert(res.body.ID, 'No ID Returned');
          done();
        });
      });
      it('return the ID of the affected database',function(done){
        request(app)
        .post('/api/databases/')
        .set('Content-Type', 'application/json')
        .send({ID:1, Name: 'test', Type: 'mysql', Host:'localhost', Port: 8080, SAUser:'sauser', SAPass: 'somepass'})
        .expect(200)
        .end(function(err, res){
          if(err){
            return done(err);
          }
          assert(res.body.Success, 'Unsuccessful post');
          assert(res.body.ID, 'No ID Returned');
          done();
        });
      });
    });
  });
  after(function(){
    db_revert();
    enc_revert();
    tools_revert();
    quiet_revert
  });
});
