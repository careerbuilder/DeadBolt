'use strict';

app.controller('ErrorCtrl', function($http, $scope, toastr){
  $scope.results=[];
  $scope.$emit('tabChanged', 4);
  $http.get('https://deadbolt.cbsitedb.net/api/errors/').success(function(data){
    if(data.Success){
      $scope.results = data.Results;
    }
    else{
      console.log(data.Error);
    }
  });

  $scope.dismiss=function(i){
    var chopid = $scope.results[i].ID
    $scope.results.splice(i, 1);
    $http.delete('https://deadbolt.cbsitedb.net/api/errors/'+chopid).success(function(data){
      if(!data.Success){
        console.log(data.Error);
      }
    });
  }

  $scope.dismissAll=function(){
    console.log("Dismissing");
    for(var i=$scope.results.length-1; i>=0; i--){
      $scope.dismiss(i);
    }
  }
});
