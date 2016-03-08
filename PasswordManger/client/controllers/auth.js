app.controller('AuthCtrl', function($http, $scope, $location, toastr, authService, isLoggingin){
  $scope.loggingIn = isLoggingin;

  $scope.logIn =  function(){
    authService.logIn($scope.auth).then(function(){
      console.log('login Success!');
      $scope.loginResult =  {Success: true, Message:"Login Succeeded!"};
      $location.path('#/');
    },
    function(reason){
      $scope.loginResult =  {Success: false, Message:reason};
    });
  };


});
