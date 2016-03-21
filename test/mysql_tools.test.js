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
      if(opts.ssl){
        if(opts.port.search(/SSLERROR/i)>-1){
          return SSL_Error_pool;
        }
        if(opts.port==='ERROR'){
          return error_pool;
        }
        return SSL_pool;
      }
      if(opts.port==='SSLERROR2'){
        return error_pool;
      }
      if(opts.port==='ERROR'){
        return error_pool;
      }
      return mock_pool;
    }
  }

  var SSL_pool={
    getConnection: function(callback){
      return callback(null, mock_db);
    },
    end: function(){
      return;
    }
  }

  var SSL_Error_pool={
    getConnection: function(callback){
      return callback({code:'HANDSHAKE_NO_SSL_SUPPORT'});
    },
    end: function(){
      return;
    }
  }

  var error_pool = {
    getConnection: function(callback){
      return callback("Could not connect!");
    },
    end: function(){
      return;
    }
  }

  var mock_pool = {
    getConnection: function(callback){
      return callback(null, mock_db);
    },
    end: function(){
      return;
    }
  }

  var mock_db = {
    release:function(){
      return;
    },
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
      if(args[0].search(/^select\s+host\s+/i)>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0].search(/errorhost/i)>-1){
            return callback("DB Error");
          }
          if(sql_args[0].search(/nohost/i)>-1){
            return callback(null, [])
          }
          if(sql_args[0].search(/localhost/i)>-1){
            return callback(null, [{Host:'localhost', plugin:''}]);
          }
          if(sql_args[0].search(/allhost/i)>-1){
            return callback(null, [{Host:'%', plugin:''}]);
          }
        }
        return callback(null, [{Host:'%', plugin:''}, {Host:'localhost', plugin:''}]);
      }
      if(args[0].search(/^grant\s+super\s+/i)>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0].search(/supererror/i)>-1){
            return callback('DB Error!');
          }
        }
        return callback();
      }
      if(args[0].search(/^grant\s+/i)>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0].search(/granterror/i)>-1){
            return callback('DB Error!');
          }
        }
        return callback();
      }
      if(args[0].search(/drop\s+user/i)>-1){
        if(sql_args && sql_args[0]){
          if(sql_args[0].search(/droperror/i)>-1){
            return callback('DB Error!');
          }
        }
      }
      if(args[0].search(/@'localhost'/i)>-1 || args[0].search(/^set\s+@dummy2/i)>-1){
        if(sql_args && sql_args[1]){
          if(sql_args[1].search(/dberror2/i)>-1){
            return callback('DB Error!');
          }
        }
        if(sql_args && sql_args[0]){
          if(sql_args[0].search(/error2/i)>-1){
            return callback('DB Error!');
          }
        }
        return callback();
      }
      if(args[0].search(/@'localhost'/i)<0){
        if(sql_args && sql_args[1]){
          if(sql_args[1].search(/dberror1/i)>-1){
            return callback('DB Error!');
          }
        }
        if(sql_args && sql_args[0]){
          if(sql_args[0].search(/error1/i)>-1){
            return callback('DB Error!');
          }
        }
        return callback();
      }

    }
  }

  var mysql_revert;
  var encrypt_revert;
  var quiet_revert;
  before(function(){
    mysql_revert = mysql_tools.__set__('mysql', mock_mysql);
    encrypt_revert = mysql_tools.__set__('encryption', mock_encrypt);
    quiet_revert = mysql_tools.__set__('console', {log: function(){}});
  });
  var update_users = mysql_tools.update_users;
  describe('update users', function(){
    it('should fail on invalid cipher', function(done){
      update_users({Host: 'nope', Port: 'nuhuh', SAPass:'rd'}, [{Username: 'test'}], [{Username: 'test'}], function(errors){
        assert(errors.length>0, 'No Errors!');
        assert(errors[0].Error.Title.search(/Decryption/i)>-1, 'No Decryption error!');
        done();
      });
    });
    it('should fallback off of SSL on SSL error', function(done){
      update_users({Host: 'nope', Port: 'SSLERROR', SAPass:'0xpassword'}, [{Username: 'test'}], [{Username: 'test'}], function(errors){
        assert(errors.length<1, 'SSL Fallback Errors!');
        done();
      });
    });
    it('should return errors on SSL connection error', function(done){
      update_users({Host: 'nope', Port: 'SSLERROR2', SAPass:'0xpassword'}, [{Username: 'test'}], [{Username: 'test'}], function(errors){
        assert(errors.length>0, 'No Errors!');
        done();
      });
    });
    it('should return errors on db error - SSL Fallback', function(done){
      update_users({Host: 'nope', Port: 'ERROR', SAPass:'0xpassword'}, [{Username: 'test'}], [{Username: 'test'}], function(errors){
        assert(errors.length>0, 'No Errors!');
        done();
      });
    });
    it('should return errors on db error', function(done){
      update_users({Name: 'testError', Host: 'nope', Port: 'nuhuh', SAPass:'0xpassword', SAUser:'sauser'}, [{Username: 'errorhost'}], [{Username: 'errorhost', MySQL_Password:'password'}], function(errors){
        assert(errors.length>0, 'No Errors!');
        done();
      });
    });
    it('should only stop errored users', function(done){
      update_users({Name: 'testError', Host: 'nope', Port: 'nuhuh', SAPass:'0xpassword', SAUser:'sauser'}, [{Username: 'errorhost'}, {Username: 'validuser'}], [{Username: 'errorhost', MySQL_Password:'password'}], function(errors){
        assert(errors.length>0, 'No Errors!');
        errors.forEach(function(err){
          assert(err.User.Username != 'validuser', 'Valid User errored');
        });
        done();
      });
    });
    it('should end early when trying to drop a nonexistent user', function(done){
      update_users({Name: 'test', Host: 'nope', Port: 'nuhuh', SAPass:'0xpassword', SAUser:'sauser'}, [{Username: 'nohost'}], [], function(errors){
        assert(errors.length<1, 'Error with nonexistant user!');
        done();
      });
    });
    it('should return errors on user password decryption error', function(done){
      var hosts = ['user', 'allhost', 'localhost'];
      hosts.forEach(function(host){
        update_users({Name: 'test', Host: 'nope', Port: 'nuhuh', SAPass:'0xpassword', SAUser:'sauser'}, [{Username: host}], [{Username: host, MySQL_Password:'pa'}], function(errors){
          assert(errors.length>0, 'No Errors!');
          var error_found = false;
          errors.forEach(function(err){
            if(err.User.Username =='user'){
              if(err.Error.Title.search(/decrypting\s+user\s+password/i)>-1){
                error_found = true;
              }
            }
          });
          assert(error_found, 'No Decryption error found!');
        });
      });
      done();
    });
    it('should error on DB Error - drop users', function(done){
      update_users({Name: 'test', Host: 'nope', Port: 'nuhuh', SAPass:'0xpassword', SAUser:'sauser'}, [{Username: 'nohost'},{Username: 'allhost'}, {Username:'droperror'}], [{Username: 'nohost', MySQL_Password:'0xdberror1'},{Username: 'allhost', MySQL_Password:'0xdberror1'}], function(errors){
        assert(errors.length>0, 'No Errors!');
        done();
      });
    });
    it('should complete successfully on drops', function(done){
      update_users({Name: 'test', Host: 'nope', Port: 'nuhuh', SAPass:'0xpassword', SAUser:'sauser'}, [{Username: 'allhost'},{Username: 'user'},{Username: 'localhost'}], [], function(errors){
        assert(errors.length<1, 'Errors occured!');
        done();
      });
    });
    var permissions = ['SU', 'DBA', 'RW', 'RO', 'FAKE'];
    permissions.forEach(function(perm){
      it('should error on permissions error - ' + perm, function(done){
        update_users({Name: 'test', Host: 'nope', Port: 'nuhuh', SAPass:'0xpassword', SAUser:'sauser'}, [{Username: 'granterror'}], [{Username: 'granterror', MySQL_Password:"0xpass", Permissions:perm}], function(errors){
          assert(errors.length>0, 'No Errors!');
          done();
        });
      });
    });
    it('should error on db error - grant super', function(done){
      update_users({Name: 'test', Host: 'nope', Port: 'nuhuh', SAPass:'0xpassword', SAUser:'sauser', ForceSSL:true}, [{Username: 'supererror'}], [{Username: 'supererror', MySQL_Password:"0xpass", Permissions:'SU'}], function(errors){
        assert(errors.length>0, 'No Errors!');
        done();
      });
    });
    it('should succeed when no db errors occur', function(done){
      var users = [
        {Username: 'test1', MySQL_Password:"0xpass", Permissions:'SU'},
        {Username: 'test2', MySQL_Password:"0xpassword", Permissions:'RW'},
        {Username: 'nohost', MySQL_Password:"0xpass", Permissions:'RO'},
        {Username: 'test4', MySQL_Password:"0xpassword", Permissions:'DBA'},
        {Username: 'test5', MySQL_Password:"0xpass", Permissions:'SU'},
        {Username: 'localhost', MySQL_Password:"0xpassword", Permissions:'RW'},
        {Username: 'allhost', MySQL_Password:"0xpass", Permissions:'RO'},
        {Username: 'test8', MySQL_Password:"0xpassword", Permissions:'DBA'},
      ];
      update_users({Name: 'test', Host: 'nope', Port: 'nuhuh', SAPass:'0xpassword', SAUser:'sauser'}, [{Username: 'test1'},{Username: 'test2'},{Username: 'test4'},{Username: 'nohost'}], users, function(errors){
        assert(errors.length<1, 'Update Errors!');
        done();
      });
    });
  });
  after(function(){
    mysql_revert();
    encrypt_revert();
    quiet_revert();
  });
});
