app.controller('ResetCtrl', function($http, $scope, $location, toastr, ResetID){
  $scope.creds = {
    ResetID: ResetID
  };

  $scope.passwordError = null;

  $scope.validatePassword=function(){
    var res = authService.validatePassword($scope.creds);
    if(res.Valid){
      $scope.passwordError = null;
      return true;
    }
    else{
      $scope.passwordError = res.Error;
      return false;
    }
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
