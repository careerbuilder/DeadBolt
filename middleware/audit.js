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

var aws = require('aws-sdk');
var connection = require('./mysql');
var async = require('async');

function sns_update(activity, values, callback){
  var message = activity;
  var i =0;
  async.whilst(function(){
    return message.indexOf('?')>-1;
  }, function(cb){
    message = message.replace(/\?/, values[i]);
    i++;
    return cb();
  }, function(err){
    var sns = new aws.SNS({region: 'us-east-1'});
    sns.publish({
      TopicArn: global.config.SNS,
      Message: message
    }, function(err){
      if(err){
        console.log(err);
      }
      return callback();
    });
  });
}

function write_to_history(activity, values, callback){
  var q = 'Insert into History (Activity) Value("'+activity+'")';
  connection.query(q, values, function(err){
    if(err){
      return callback(err);
    }
    return callback();
  });
}

module.exports = {
  record: function(activity, values, callback){
    async.series([
      function(cb){
        if(global.config.SNS){
          return sns_update(activity, values, cb);
        }
        else{
          return cb();
        }
      },
      function(cb){
        return write_to_history(activity, values, cb);
      }
    ], function(err){
      if(err){
        return callback(err);
      }
      else{
        return callback();
      }
    });
  }
};
