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
