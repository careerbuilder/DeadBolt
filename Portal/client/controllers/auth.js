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

});
