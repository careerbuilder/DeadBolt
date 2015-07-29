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
      if(details.subject && details.subject.toUpperCase().search('error')>-1){
        return callback("Mail Error!");
      }
      return callback(null, details);
    }
  }

  var mock_AD = {
    add_user_to_AD: function(user, callback){
      if(user.UserName && user.Username == "error"){
        return callback("AD_API Error");
      }
      return callback();
    },
    remove_user_from_AD: function(username, callback){
      if(username == "error"){
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
    it('should error on db error');
    it('should return users of the selected group');
  });
  describe('POST /search', function(){
    it('should error on db error');
    it('should return users of the selected group');
  });
  after(function(){
    db_revert();
    tools_revert();
    transport_revert();
    ad_api_revert();
    quiet_revert();
  });
});
