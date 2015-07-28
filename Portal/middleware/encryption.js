var AWS = require('aws-sdk');
var kms = new AWS.KMS({'region': 'us-east-1'});

module.exports = {
  encrypt: function(message, callback){
    var key = global.config.kmskey;
    kms.encrypt({KeyId: key, Plaintext: message}, function(err, data){
      if(err){
        console.log("encryption error: ");
        console.log(err);
        callback(err);
      }
      var enc_string =data.CiphertextBlob.toString('hex');
      callback(null, enc_string);
    });
  },
  decrypt: function(enc_message, callback){
    var enc_buffer = new Buffer(enc_message, 'hex');
    kms.decrypt({CiphertextBlob: enc_buffer}, function(err, data){
      if(err){
        console.log("decryption error: ");
        console.log(err);
        callback(err);
      }
      var message = data.Plaintext.toString();
      callback(null, message);
    });
  }
};
