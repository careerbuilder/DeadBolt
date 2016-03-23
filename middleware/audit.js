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
