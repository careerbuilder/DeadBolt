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
app.controller('ResetCtrl', function($http, $scope, $location, toastr, authService, ResetID){
  $scope.creds = {
    ResetID: ResetID
  };
  $scope.passwordError = null;

  $scope.validatePassword=function(){
    var res = authService.validatePassword($scope.creds);
    if(res.Valid){
      $scope.passwordError = null;
      return true;
    }
    else{
      $scope.passwordError = res.Error;
      return false;
    }
  };


  $scope.reset=function(){
    $http.post('/api/auth/reset', $scope.creds).then(function(res){
      var data = res.data;
      if(data.Success){
        $location.path('/');
        toastr.success('Password reset!');
      }
      else{
        toastr.error(data.Error);
      }
    },function(err){
      toastr.error(err);
    });
  };
});
