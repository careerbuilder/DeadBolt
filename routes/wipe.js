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

var router = require('express').Router();
var fork = require('child_process').fork;

router.post('/', function(req, res){
  console.log('wipe API hit');
  var username = req.body.username;
  var options = {
    encoding: 'utf8',
    timeout: 0,
    maxBuffer: 200*1024,
    killSignal: 'SIGTERM',
    cwd: '/home/ubuntu/Lifecycle_Easy_Button',
    env: null,
    silent: false
  };
  var wipeScript = fork('wipeScript.js', [username], options);
  var output = '';
  var lastMessage;
  wipeScript.stdout.on('data', function(data) {
    lastMessage = data.toString();
    output += lastMessage;
  });
  wipeScript.on('close', function(code){
    var finalResults = lastMessage;

    return res.send({"FinalResults": finalResults, "OutputLog": output});
  });

});

module.exports = router;
