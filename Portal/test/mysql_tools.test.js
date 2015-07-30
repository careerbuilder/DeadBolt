describe('mysql_tools', function(){
  var assert = require('assert');
  var rewire = require('rewire');
  var blanket = require('blanket');
  global.config = {DB:{}, kmskey: ""};
  var mysql_tools = rewire('../tools/mysql_tools.js');

  var mock_encrypt = {
    encrypt: function(plaintext, callback){
      if(!plaintext || plaintext.length <1){
        return callback("No text to encrypt!");
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

  var mock_mysql = {
    createPool: function(opts){
      return mock_pool;
    }
  }

  var mock_pool = {
    getConnection: function(callback){
      return mock_db;
    }
  }

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
    }
  }

  before(function(){

  });



  after(function(){

  });
});
