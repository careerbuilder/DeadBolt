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
      $scope.loginResult =  {Success: true, Message:"Login Succeeded!"};
      toastr.success('Welcome!');
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
      $location.path('/');
    }, function(err){
      $scope.loginResult =  {Success: false, Message:err};
    });
  };

  $scope.changePassword =  function(){
    authService.changePassword($scope.auth).then(function(){
      $scope.loginResult =  {Success: true, Message:"Password Change Succeeded!"};
      toastr.success('Password successfully changed');
      $location.path('/');
    },
    function(reason){
      $scope.loginResult =  {Success: false, Message:reason};
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

});
