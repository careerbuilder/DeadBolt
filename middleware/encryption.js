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
var useKMS = false;
if(global.config.kmskey){
  var AWS = require('aws-sdk');
  var kms = new AWS.KMS({'region': 'us-east-1'});
  useKMS = true;
}
else if(global.config.aeskey){
  var crypto = crypto;
}
else{
  throw new Error('Must set either kmskey or aeskey in config.json');
}

module.exports = {
  encrypt: function(message, callback){
    var key;
    if(useKMS){
      key = global.config.kmskey;
      kms.encrypt({KeyId: key, Plaintext: message}, function(err, data){
        if(err){
          console.log("encryption error: ");
          console.log(err);
          callback(err);
        }
        var enc_string =data.CiphertextBlob.toString('hex');
        callback(null, enc_string);
      });
    }
    else{
      key = global.config.aeskey;
      var aes = crypto.createCipher('aes256', key);
      var enc = aes.update(message, 'utf8', 'hex');
      enc += aes.final('hex');
      return callback(null, enc);
    }
  },
  decrypt: function(enc_message, callback){
    if(useKMS){
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
    else{
      var dec = crypto.createDecipher('aes256', global.config.aeskey);
      var pt = dec.update(enc_message, 'hex', 'utf8');
      pt += dec.final('utf8');
      return callback(null. pt);
    }
  }
};
