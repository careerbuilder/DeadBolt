'use strict';

app.controller('ErrorCtrl', function($http, $scope, toastr){
  $scope.results=[
                  /*
                  {User: {Username: "ayost"}, Database:{Name:"Testdb"}, Error:{Title: "Testing Error Page", Details:"This is only a test"}, Retryable: false, Class:"Info"},
                  {User: {Username: "ayost"}, Database:{Name:"Testdb"}, Error:{Title: "Testing Error Page", Details:"This is only a test"}, Retryable: false, Class:"Warning"},
                  {User: {Username: "ayost"}, Database:{Name:"Testdb"}, Error:{Title: "Testing Error Page", Details:"This is only a test"}, Retryable: false, Class:"Error"},
                  {User: {Username: "ayost"}, Database:{Name:"Testdb"}, Error:{Title: "Testing Error Page", Details:"This is only a test"}, Retryable: false, Class:"Success"}
                  */
                  ];
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
});
