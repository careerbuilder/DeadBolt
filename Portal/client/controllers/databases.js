'use strict';

app.controller('DBCtrl', function($http, $scope, $cookies, $cookieStore, $location, toastr){
  $scope.searchResults = [];
  $scope.database = {};
  $scope.$emit('tabChanged', 3);

  $http.post('/api/databases/search/', {Info:''}).success(function(data){
    if(data.Success){
      $scope.isEditing = false;
      $scope.isSearching = true;
      $scope.searchResults = data.Results;
    }
  });

  $scope.search=function(){
    $http.post('/api/databases/search/', $scope.searchCreds).success(function(data){
      if(data.Success){
        $scope.isEditing = false;
        $scope.isSearching = true;
        $scope.searchResults = data.Results;
      }
    });
  }

  $scope.refreshSearch=function(){
    $http.post('/api/databases/search/', {Info:''}).success(function(data){
      if(data.Success){
        $scope.isEditing = false;
        $scope.isSearching = true;
        $scope.searchResults = data.Results;
      }
    });
  }

  $scope.edit=function(index){
    $scope.isSearching=false;
    $scope.isEditing = true;
    $scope.database = $scope.searchResults[index];
    $scope.dbRef = JSON.stringify($scope.searchResults[index]);
  }

  $scope.change_pass=function(){
    $scope.editing_pass = true;
  }

  $scope.cancel_change_pass=function(){
    $scope.editing_pass = false;
    delete $scope.database.SAPass;
  }

  $scope.nochange=function(){
    if($scope.dbRef){
      return ($scope.dbRef===JSON.stringify($scope.database));
    }
    else{
      return false;
    }
  }

  $scope.addDB=function(){
    $scope.database = {};
    $scope.dbRef=null;
    $scope.isEditing = true;
    $scope.isSearching = false;
  }

  $scope.saveDB=function(){
    var dbdata = JSON.parse(JSON.stringify($scope.database));
    $http.post('/api/databases', dbdata).success(function(data){
      if(data.Success){
        $scope.database.ID = data.ID;
        $scope.refreshSearch();
        toastr.success("Database updated successfuly!");
      }
    });
  }

  $scope.removeDB=function(){
    var dbid = $scope.database.ID;
    $http.delete('/api/databases/' + dbid).success(function(data){
      $scope.isEditing=false;
      $scope.refreshSearch();
      $scope.isSearching = true;
      $scope.database = {};
      toastr.success("Database removed");
    });
  }

  });
