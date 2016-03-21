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
app.controller('AuthCtrl', function($http, $scope, $location, toastr, authService){
  $scope.loggingIn = true;
  $scope.auth = {};
  $scope.passwordError = null;
  $scope.forgot={};

  $scope.isLoggedIn = function(){
    return !!authService.getSession();
  };

  $scope.logIn =  function(){
    authService.logIn($scope.auth).then(function(){
      toastr.success('Welcome!');
      $scope.auth={};
      $location.path('/');
    },
    function(reason){
      toastr.error(reason);
    });
  };

  $scope.resetPass = function(){
    authService.forgotPassword($scope.forgot.Email)
    .then(function(){
      toastr.success('Reset password email sent!');
      $scope.forgot={};
      $location.path('/');
    }, function(err){
      toastr.error(err);
    });
  };

  $scope.changePassword =  function(){
    authService.changePassword($scope.auth).then(function(){
      toastr.success('Password successfully changed');
      $scope.auth={};
      $location.path('/');
    },
    function(reason){
      toastr.error(reason);
    });
  };

  $scope.validatePassword=function(){
    var res = authService.validatePassword($scope.auth);
    if(res.Valid){
      $scope.passwordError = null;
      return true;
    }
    else{
      $scope.passwordError = res.Error;
      return false;
    }
  };

  $scope.toggleLogin=function(){
    $scope.loggingIn = !$scope.loggingIn;
  };

});
