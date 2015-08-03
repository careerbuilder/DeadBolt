describe('mssql_tools', function(){
  var assert = require('assert');
  var rewire = require('rewire');
  var blanket = require('blanket');
  global.config = {DB:{}, kmskey: ""};
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

  var Transaction = function Transaction(){
    this.conn = connection;
  }

  Transaction.prototype.begin = function begin(callback){
    if(this.conn.server && this.conn.server.search(/transerror/i)>-1){
      return callback("Transaction Error!");
    }
    return callback();
  }

  Transaction.prototype.commit = function commit(callback){
    return callback();
  }

  var Request = function Request(transaction){
    this.trans = transaction;
  }

  Request.prototype.input = function input(name, type, value){
    return;
  }

  Request.prototype.query=  function query(sql, callback){
    console.log(sql);
    return callback();
  }

  var Connection = function Connection(opts, callback){
    this.opts = opts;
    if(opts.server && opts.server.search(/connerror/i)>-1){
      return callback("DB Connection Error!");
    }
    return callback();
  }

  Connection.prototype.close = function close(){
    return;
  }

  var mock_mssql = {
    Connection: Connection,
    Transaction: Transaction,
    Request: Request
  }

  var mssql_revert;
  var encrypt_revert;
  var quiet_revert;
  before(function(){
    mssql_revert = mssql_tools.__set__('mssql', mock_mssql);
    encrypt_revert = mssql_tools.__set__('encryption', mock_encrypt);
    quiet_revert = mssql_tools.__set__('console', {log: function(){}});
  });
  var update_users = mssql_tools.update_users;
  describe('update users', function(){
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
      update_users({Host: 'nope', Port: 'nuhuh', SAUser: 'sauser', SAPass:'0xpassword'}, [{Username: 'test'}], [{Username: 'test', SQL_Server_Password:'0xpassword; drop table users; --'}], function(errors){
        assert(errors, 'No Errors!');
        assert(errors[0].Error.Title.search(/sql\s+inject/i)>-1, 'No Injection error!');
      });
      update_users({Host: 'nope', Port: 'nuhuh', SAUser: 'sauser', SAPass:'0xpassword'}, [{Username: 'test; delete * from users; --'}], [{Username: 'test; delete * from users; --', SQL_Server_Password:'0xpassword'}], function(errors){
        assert(errors, 'No Errors!');
        assert(errors[0].Error.Title.search(/sql\s+inject/i)>-1, 'No Injection error!');
      });
      done();
    });
  });
  after(function(){
    mssql_revert();
    encrypt_revert();
    quiet_revert();
  });
});
