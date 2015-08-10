'use strict';

app.controller('AuthCtrl', function($http, $scope, $location, toastr, authService, isLoggingin){
  $scope.loggingIn = isLoggingin;

  $scope.logIn =  function(){
    authService.logIn($scope.auth).then(function(){
      //login succeeded;
      console.log('login Success!');
      $scope.loginResult =  {Success: true, Message:"Login Succeeded!"};
      $location.path('#/');
    },
    function(reason){
      //login Failed
      $scope.loginResult =  {Success: false, Message:reason};
    });
  }

  $scope.signUp =  function(){
    authService.signUp($scope.auth).then(function(){
      //login succeeded;
      $scope.loginResult =  {Success: true, Message:"Signup Succeeded!"};
      $location.path('#/');
    },
    function(reason){
      //login Failed
      $scope.loginResult =  {Success: false, Message:reason};
    });
  }
});

app.directive("compareTo", function() {
  return {
      require: "ngModel",
      scope: {
          otherModelValue: "=compareTo"
      },
      link: function(scope, element, attributes, ctrl) {
          ctrl.$validators.compareTo = function(modelValue) {
              return modelValue === scope.otherModelValue;
          };
          scope.$watch("otherModelValue", function() {
                ctrl.$validate();
            });
      }
  };
});
