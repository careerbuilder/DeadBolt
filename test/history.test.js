/*
* Copyright 2016 CareerBuilder, LLC
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
* 
*     http://www.apache.org/licenses/LICENSE-2.0
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and limitations under the License.
*/
describe('history', function(){
  var express = require('express');
  var assert = require('assert');
  var rewire = require('rewire');
  var blanket = require('blanket');
  var request = require('supertest');
  var bodyParser = require('body-parser');
  global.config = {DB:{}, kmskey: ""};
  var history = rewire('../routes/history.js');

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
  };


  app = express();
  app.use(bodyParser.urlencoded({extended: true}));
  app.use(bodyParser.json());
  app.use('/api/history/', history);

  var db_revert;
  var quiet_revert;
  before(function(){
    quiet_revert = history.__set__('console', {log: function(){}});
    db_revert = history.__set__('connection', mock_db);
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
    quiet_revert();
  });
});
