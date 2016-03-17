app.controller('DBCtrl', function($http, $scope, $cookies, $cookieStore, $location, toastr, tabService){
  $scope.searchResults = [];
  $scope.database = {};
  tabService.setTab(3);

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
  };

  $scope.refreshSearch=function(){
    $http.post('/api/databases/search/', {Info:''}).success(function(data){
      if(data.Success){
        $scope.isEditing = false;
        $scope.isSearching = true;
        $scope.searchResults = data.Results;
      }
    });
  };

  $scope.edit=function(index){
    $scope.isSearching=false;
    $scope.isEditing = true;
    $scope.database = $scope.searchResults[index];
    $scope.dbRef = JSON.stringify($scope.searchResults[index]);
  };

  $scope.change_pass=function(){
    $scope.editing_pass = true;
  };

  $scope.cancel_change_pass=function(){
    $scope.editing_pass = false;
    delete $scope.database.SAPass;
  };

  $scope.nochange=function(){
    if($scope.dbRef){
      return ($scope.dbRef===JSON.stringify($scope.database));
    }
    else{
      return false;
    }
  };

  $scope.addDB=function(){
    $scope.database = {ForceSSL:0};
    $scope.dbRef=null;
    $scope.isEditing = true;
    $scope.isSearching = false;
  };

  $scope.test_db=function(){
    var dbdata = JSON.parse(JSON.stringify($scope.database));
    $http.post('/api/databases/test', dbdata).then(function(res){
      var data = res.data;
      if(data.Success){
        toastr.success("Connection established!");
      }
      else{
        toastr.error('Invalid connection credentials');
      }
    });
  };

  $scope.saveDB=function(force){
    var dbdata = JSON.parse(JSON.stringify($scope.database));
    dbdata.Force = force || false;
    $http.post('/api/databases', dbdata).then(function(res){
      var data = res.data;
      if(data.Success){
        $scope.editing_pass=false;
        $scope.refreshSearch();
        toastr.success("Database updated successfuly!");
      }
      else{
        toastr.error(data.Error);
      }
    });
  };

  $scope.removeDB=function(force){
    var dbid = $scope.database.ID;
    var endpoint = '/api/databases/' + dbid;
    if(force){
      endpoint+='?force=1';
    }
    $http.delete(endpoint).then(function(res){
      var data = res.data;
      $scope.isEditing=false;
      $scope.refreshSearch();
      $scope.isSearching = true;
      $scope.database = {};
      toastr.success("Database removed");
    }, function(err){
      toastr.error(err);
    });
  };

  });
