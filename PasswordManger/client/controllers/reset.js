app.controller('ResetCtrl', function($http, $scope, $location, toastr, ResetID){
  $scope.creds = {
    ResetID: ResetID
  };

  $scope.requirements = {
    Forbidden:  [],
    MinLength: 8,
    MinLowerCase: 1,
    MinUpperCase: 1,
    MinNumbers:1,
    MinSymbols:1
  };

  $scope.passwordError = null;

  $scope.validatePassword=function(){
    if(!$scope.creds.Password || $scope.creds.Password.length<1){
      return true;
    }
    for(var i=0; i<$scope.requirements.Forbidden.length; i++){
      var f = $scope.requirements.Forbidden[i];
      if($scope.creds.Password.search(f)>-1){
        $scope.passwordError = 'Forbidden password pattern';
        return false;
      }
    }
    var upper=0, lower=0, number=0, symbol=0;
    for(var j=0; j<$scope.creds.Password.length; j++){
      var char = $scope.creds.Password[j];
      if(char.match(/[a-z]/)){
        lower++;
      }
      else if(char.match(/[A-Z]/)){
        upper++;
      }
      else if(char.match(/[0-9]/)){
        number++;
      }
      else{
        symbol++;
      }
    }
    if(lower < $scope.requirements.MinLowerCase){
      $scope.passwordError = 'Requires at least ' + $scope.requirements.MinLowerCase +' lowercase characters';
      return false;
    }
    if(upper < $scope.requirements.MinUpperCase){
      $scope.passwordError =  'Requires at least ' + $scope.requirements.MinUpperCase +' uppercase characters';
      return false;
    }
    if(number < $scope.requirements.MinNumbers){
      $scope.passwordError =  'Requires at least ' + $scope.requirements.MinNumbers +' numbers';
      return false;
    }
    if(symbol < $scope.requirements.MinSymbols){
      $scope.passwordError =  'Requires at least ' + $scope.requirements.MinSymbols +' symbols';
      return false;
    }
    $scope.passwordError=null;
    return true;
  };


  $scope.reset=function(){
    $http.post('/api/auth/reset', $scope.creds).then(function(res){
      var data = res.data;
      if(data.Success){
        $location.path('/login');
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
