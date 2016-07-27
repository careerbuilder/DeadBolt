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
app.controller('WipeCtrl', function($http, $scope, $cookies){

  $scope.showDoubleCheck = false;
  $scope.usernameInput = undefined;
  $scope.logBody = "";

  $scope.doubleCheck = function(){
    $scope.showDoubleCheck = true;
    console.log("hit button");
  };

  $scope.wipeEmployee = function(username){
    var payload = {username: username};
    if (username && username.length > 0){
      $http.post('/api/wipe/', payload).then(function(res){
        $scope.logBody = res.data;
      },
      function(err){

      });
    }else{
      $scope.logBody = 'Invalid Username';
    }

  };
});
