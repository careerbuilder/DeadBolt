var assert = require('assert');
var rewire = require('rewire');
var blanket = require('blanket');
global.config = {DB:{}, kmskey: ""};
var databases = rewire('../routes/databases.js');

var mock_db = {
    query: function(){}
  }

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

describe('databases', function(){
  var db_revert;
  var enc_revert;
  before(function(){
    db_revert = databases.__set__('connection', mock_db);
    enc_revert = databases.__set__('encryption', mock_encrypt);
  });
  describe('#add_database()', function(){
    var add_database = databases.__get__('add_database');
    it('should fail if called without all data', function(done){
      add_database({}, function(err, result){
        assert(err, 'No error despite no info passed');
        done();
      });
    });
    it('should fail on duplicate Hosts');
    it('should return an ID of the inserted DB');
  });
  describe('#update_database()', function(){
    var update_database = databases.__get__('update_database');
    it('should fail if called without all data', function(done){
      update_database({}, function(err, result){
        assert(err, 'No error despite no info passed');
        done();
      });
    });
    it('should fail if no ID is sent');
    it('should return an ID on success');
  });
  describe('#remove_database()', function(){
    var remove_database = databases.__get__('remove_database');
    it('should fail if called without all data', function(done){
      remove_database({}, function(err, result){
        assert(err, 'No error despite no info passed');
        done();
      });
    });
    it('should fail if no database has that ID');
    it('should return success if it works');
  });
  after(function(){
    db_revert();
    enc_revert();
  });
});
