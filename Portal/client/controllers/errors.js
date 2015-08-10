'use strict';

app.controller('ErrorCtrl', function($http, $scope, toastr, tabService){
  $scope.results=[];
  tabService.setTab(4);
  $http.get('/api/errors/').success(function(data){
    if(data.Success){
      $scope.results = data.Results;
    }
    else{
      console.log(data.Error);
    }
  });

  $scope.dismiss=function(i){
    var chopid = $scope.results[i].ID;
    $scope.results.splice(i, 1);
    $http.delete('/api/errors/'+chopid).success(function(data){
      if(!data.Success){
        console.log(data.Error);
      }
    });
  }

  $scope.retry = function(i){
    var id = $scope.results[i].ID;
    $scope.results.splice(i, 1);
    $http.post('/api/errors/retry/'+id).success(function(data){
      if(!data.Success){
        console.log(data.Error);
      }
    });
  }

  $scope.dismissAll=function(){
    for(var i=$scope.results.length-1; i>=0; i--){
      $scope.dismiss(i);
    }
  }

  $scope.retryAll=function(){
    $http.post('/api/errors/retry/').success(function(data){
      if(data.Success){
        $scope.results = [];
      }
    });
  }
});
