app.controller('AuthCtrl', function($http, $scope, $location, toastr, authService, isLoggingin){
  $scope.loggingIn = isLoggingin;
  $scope.auth ={};
  $scope.forgot={};

  $scope.logIn =  function(){
    authService.logIn($scope.auth).then(function(){
      console.log('login Success!');
      $scope.loginResult =  {Success: true, Message:"Login Succeeded!"};
      $location.path('/');
    },
    function(reason){
      $scope.loginResult =  {Success: false, Message:reason};
    });
  };

  $scope.resetPass = function(){
    authService.forgotPassword($scope.forgot.Email)
    .then(function(){
      toastr.success('Reset password email sent!');
      $location.path('/login');
    }, function(err){
      $scope.loginResult =  {Success: false, Message:err};
    });
  };

});
