'use strict';

app.controller('SignupCtrl', function($http, $scope, $location){
    $scope.auth= {};
    $scope.signUp = function () {
      if($scope.auth.email && $scope.auth.password){
        $http.post('https://deadbolt.cbsitedb.net/api/signup', $scope.auth).success(function(data){
          $scope.signupResult = data;
          if(data.Error){
            $scope.signupResult.Message = data.Error;
          }
        });
      }
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
