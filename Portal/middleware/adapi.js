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
var request = require('request');

var host = global.config.ADAPI;

module.exports = {
  add_user_to_AD: function(userinfo, callback){
    var payload = {
      user: userinfo
    };
    var req_opts = {
      uri: host + "/api/createUser/",
      method: 'POST',
      json: payload
    };
    request(req_opts, function(err, response, body){
      if(err){
        return callback(err);
      }
      if(body.Success){
        return callback(null, body);
      }
      else{
        return callback(body.Error);
      }
    });
  },
  remove_user_from_AD: function(username, callback){
    var req_opts = {
      uri: host+"/api/removeUser/",
      method: 'POST',
      json: {user: {UserName: username}}
    };
    request(req_opts, function(err, response, body){
      if(err){
        return callback(err, body);
      }
      if(body.Success){
        return callback(null, body);
      }
      else{
        return callback(body.Error);
      }
    });
  }
};
