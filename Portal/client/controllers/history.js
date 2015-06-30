'use strict';

app.controller('HistoryCtrl', function($http, $scope, $cookies, $cookieStore, toastr){
  $scope.history=[];
  $scope.$emit('tabChanged', 0);
  $http.get('https://deadbolt.cbsitedb.net/api/history/7').success(function(data){
    if(data.Success){
      $scope.history = data.History;
    }
    else{
      console.log(data.Error);
    }
  });
});
