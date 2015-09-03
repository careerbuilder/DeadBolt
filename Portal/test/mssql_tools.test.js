describe('mssql_tools', function(){
  var assert = require('assert');
  var rewire = require('rewire');
  var blanket = require('blanket');
  var mssql_tools = rewire('../tools/mssql_tools.js');

  var mock_encrypt = {
    encrypt: function(plaintext, callback){
      if(!plaintext || plaintext.length <1){
        return callback("No text to encrypt!");
      }
      return callback(null, "0x" + plaintext);
    },
    decrypt: function(cipher, callback){
      if(!cipher || cipher.search('0x')!=0){
        return callback("Invalid cipher!");
      }
      return callback(null, cipher.substring(2));
    }
  }

  var mock_mssql = {
    connect: function(config, callback){
      if(!config.server || config.server.search(/connerror/i)>-1){
        return callback('DB Connection error!');
      }
      return callback(null, {close:function(){}})
    },
    query: function(conn, sql, callback){
      return callback();
    }
  }

  var mssql_revert;
  var encrypt_revert;
  var quiet_revert;
  before(function(){
    encrypt_revert = mssql_tools.__set__('encryption', mock_encrypt);
    mssql_revert = mssql_tools.__set__('mssql_connection', mock_mssql);
    quiet_revert = mssql_tools.__set__('console', {log: function(){}});
  });
  describe('update users', function(){
    var update_users = mssql_tools.update_users;
    it('should fail on invalid cipher', function(done){
      update_users({Host: 'nope', Port: 'nuhuh', SAPass:'rd'}, [{Username: 'test'}], [{Username: 'test'}], function(errors){
        assert(errors, 'No Errors!');
        assert(errors[0].Error.Title.search(/decrypt/i)>-1, 'No Decryption error!');
        done();
      });
    });
    it('should return errors on db connection error', function(done){
      update_users({Host: 'connerror', Port: 'nuhuh', SAPass:'0xpassword'}, [{Username: 'test'}], [{Username: 'test'}], function(errors){
        assert(errors, 'No Errors!');
        done();
      });
    });
    it('should fail on user password decryption error', function(done){
      update_users({Host: 'nope', Port: 'nuhuh', SAUser: 'sauser', SAPass:'0xpassword'}, [{Username: 'test'}], [{Username: 'test', SQL_Server_Password:'nopass'}], function(errors){
        assert(errors, 'No Errors!');
        assert(errors[0].Error.Title.search(/decrypt/i)>-1, 'No Decryption error!');
        done();
      });
    });
    it('should fail on sql injection attempt', function(done){
      update_users({Host: 'nope', Port: 'nuhuh', SAUser: 'sauser', SAPass:'0xpassword'}, [{Username: 'test'},{Username: 'test; delete * from users; --'}], [{Username: 'test', SQL_Server_Password:'0xpassword; drop table users; --'},{Username: 'test; delete * from users; --'}], function(errors){
        assert(errors, 'No Errors!');
        assert(errors[0].Error.Title.search(/sql\s+inject/i)>-1, 'No Injection error!');
        done();
      });
    });
    it('should error on db error - add/update/drop login', function(done){
      var mock_query ={
        connect: function(config, callback){return callback(null, {close:function(){}})},
        query: function(conn, sql, callback){
          if(sql.search(/select\s+\*\s+from\s+(sys\.)?syslogins/i)>-1){
            return callback('DB Query Error!');
          }
          else{
            return callback();
          }
        }
      };
      var query_revert = mssql_tools.__set__('mssql_connection', mock_query);
      update_users({Host: 'nope', Port: 'nuhuh', SAUser: 'sauser', SAPass:'0xpassword'}, [{Username: 'test'},{Username: 'test2'}], [{Username: 'test', SQL_Server_Password:'0xpassword'},{Username: 'test2'}], function(errors){
        assert(errors, 'No Errors!');
        query_revert();
        done();
      });
    });
    it('should error on db error - revoke permissions', function(done){
      var mock_query ={
        connect: function(config, callback){return callback(null, {close:function(){}})},
        query: function(conn, sql, callback){
          if(sql.search(/revoke\s+showplan/i)>-1){
            return callback('DB Query Error!');
          }
          else{
            return callback();
          }
        }
      };
      var query_revert = mssql_tools.__set__('mssql_connection', mock_query);
      update_users({Host: 'nope', Port: 'nuhuh', SAUser: 'sauser', SAPass:'0xpassword'}, [{Username: 'test'},{Username: 'test2'}], [{Username: 'test', SQL_Server_Password:'0xpassword'},{Username: 'test2'}], function(errors){
        assert(errors, 'No Errors!');
        query_revert();
        done();
      });
    });
    it('should error on db error - revoke server permissions', function(done){
      var mock_query ={
        connect: function(config, callback){return callback(null, {close:function(){}})},
        query: function(conn, sql, callback){
          if(sql.search(/revoke\s+grant\s+option/i)>-1){
            return callback('DB Query Error!');
          }
          else{
            return callback();
          }
        }
      };
      var query_revert = mssql_tools.__set__('mssql_connection', mock_query);
      update_users({Host: 'nope', Port: 'nuhuh', SAUser: 'sauser', SAPass:'0xpassword'}, [{Username: 'test'},{Username: 'test2'}], [{Username: 'test', SQL_Server_Password:'0xpassword'},{Username: 'test2'}], function(errors){
        assert(errors, 'No Errors!');
        query_revert();
        done();
      });
    });
    it('should error on db error - update permissions', function(done){
      var mock_query ={
        connect: function(config, callback){return callback(null, {close:function(){}})},
        query: function(conn, sql, callback){
          if(sql.search(/grant\s+view\s+definition/i)>-1){
            return callback('DB Query Error!');
          }
          else{
            return callback();
          }
        }
      };
      var query_revert = mssql_tools.__set__('mssql_connection', mock_query);
      var gospel_users = [{Username: 'test', SQL_Server_Password:'0xpassword', Permissions:'SU'},{Username: 'test2', SQL_Server_Password:'0xpassword', Permissions:'DBA'},{Username: 'test3', SQL_Server_Password:'0xpassword', Permissions:'RW'},{Username: 'test4', SQL_Server_Password:'0xpassword', Permissions:'RO'}];
      update_users({Host: 'nope', Port: 'nuhuh', SAUser: 'sauser', SAPass:'0xpassword'}, [{Username: 'test'},{Username: 'test2'},{Username: 'test3'},{Username: 'test4'}], gospel_users, function(errors){
        assert(errors, 'No Errors!');
        query_revert();
        done();
      });
    });
    it('should error on db error - drop user', function(done){
      var mock_query ={
        connect: function(config, callback){return callback(null, {close:function(){}})},
        query: function(conn, sql, callback){
          if(sql.search(/drop\s+user/i)>-1){
            return callback('DB Query Error!');
          }
          else{
            return callback();
          }
        }
      };
      var query_revert = mssql_tools.__set__('mssql_connection', mock_query);
      update_users({Host: 'nope', Port: 'nuhuh', SAUser: 'sauser', SAPass:'0xpassword'}, [{Username: 'test'}], [{Username: 'test'}], function(errors){
        assert(errors, 'No Errors!');
        query_revert();
        done();
      });
    });
    it('should error on db error - grant server permissions', function(done){
      var mock_query ={
        connect: function(config, callback){return callback(null, {close:function(){}})},
        query: function(conn, sql, callback){
          if(sql.search(/grant\s+alter\s+any\s+connection\s+to/i)>-1){
            return callback('DB Query Error!');
          }
          else{
            return callback();
          }
        }
      };
      var query_revert = mssql_tools.__set__('mssql_connection', mock_query);
      update_users({Host: 'nope', Port: 'nuhuh', SAUser: 'sauser', SAPass:'0xpassword'}, [{Username: 'test'}], [{Username: 'test', SQL_Server_Password:'0xpassword', Permissions:'SU'}], function(errors){
        assert(errors, 'No Errors!');
        query_revert();
        done();
      });
    });
    it('should succeed on valid users', function(done){
      var gospel_users = [{Username: 'test', SQL_Server_Password:'0xpassword', Permissions:'SU'},{Username: 'test2', SQL_Server_Password:'0xpassword', Permissions:'DBA'},{Username: 'test3', SQL_Server_Password:'0xpassword', Permissions:'RW'},{Username: 'test4', SQL_Server_Password:'0xpassword', Permissions:'RO'}, {Username:'test5'}];
      update_users({Host: 'nope', Port: 'nuhuh', SAUser: 'sauser', SAPass:'0xpassword'}, [{Username: 'test'},{Username: 'test2'},{Username: 'test3'},{Username: 'test4'}, {Username: 'test5'}], gospel_users, function(errors){
        assert.equal(errors.length, 0, 'Encountered Errors!');
        done();
      });
    });
  });
  after(function(){
    encrypt_revert();
    mssql_revert();
    quiet_revert();
  });
});
