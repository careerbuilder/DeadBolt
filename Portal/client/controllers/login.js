'use strict';

app.controller('LoginCtrl', function($http, $scope, $cookies, $cookieStore, $location){
  $scope.auth = {};

  $scope.login =  function(){
    if($scope.auth.email && $scope.auth.password){
      $http.post('/api/login', $scope.auth).success(function(data){
        $scope.loginResult = data;
        if($scope.loginResult.Success){
          $cookieStore.put('rds_ad',data.Session);
          $scope.$emit('loginSuccess', true);
          $location.path('/');
        }
      });
    }
  }
});
