app.controller('ResetCtrl', function($http, $scope, $location, toastr, ResetID){
  $scope.creds = {
    ResetID: ResetID
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
