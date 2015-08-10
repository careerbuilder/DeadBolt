'use strict';

app.controller('GroupCtrl', function($http, $scope, $cookies, $cookieStore, $location, $filter, toastr, tabService){
  tabService.setTab(2);
  $scope.searchResults = [];
  $scope.group = {};
  $scope.databases = [];
  $scope.filtered_dbs = []
  $scope.allCheck=false;
  $scope.show_db_text = "Edit Databases";
  $scope.db_edit = false;

  $http.post('/api/groups/search/', {Info:''}).success(function(data){
    if(data.Success){
      $scope.isEditing = false;
      $scope.isSearching = true;
      $scope.searchResults = data.Results;
    }
  });

  $http.get('/api/databases').success(function(data){
    if(data.Success){
      for(var i=0; i<data.Results.length; i++){
        data.Results[i].Checked = false;
      }
      $scope.databases = data.Results;
      $scope.filtered_dbs = $scope.databases;
    }
  });

  $scope.selectAll=function(){
    $scope.filtered_dbs.forEach(function(db,i){
      db.Checked = $scope.allCheck;
    });
  }

  $scope.evalAll=function(){
    for(var i=0; i< $scope.filtered_dbs.length; i++){
      var db = $scope.filtered_dbs[i];
      if(!db.Checked){
          $scope.allCheck = false;
          return;
      }
    }
    $scope.allCheck=true;
    return
  }

  $scope.toggle_show_databases = function(){
    $scope.db_edit = !$scope.db_edit;
    if($scope.db_edit){
      $scope.show_db_text = "View Databases";
    }
    else{
      $scope.show_db_text = "Edit Databases";
    }
  }

  $scope.search=function(){
    $http.post('/api/groups/search/', $scope.searchCreds).success(function(data){
      if(data.Success){
        $scope.isEditing = false;
        $scope.isSearching = true;
        $scope.searchResults = data.Results;
      }
    });
  }

  $scope.refreshSearch=function(){
    $http.post('/api/groups/search/', {Info:''}).success(function(data){
      if(data.Success){
        $scope.isEditing = false;
        $scope.isSearching = true;
        $scope.searchResults = data.Results;
      }
    });
  }

  $scope.view_edit=function(value){
    return ($scope.db_edit | value.Checked);
  }

  $scope.filter_dbs=function(){
    $scope.filtered_dbs = $filter('filter')($scope.databases, $scope.dbfilter);
    $scope.evalAll();
  }

  $scope.edit=function(index){
    $scope.db_edit = false;
    $scope.show_db_text = "Edit Databases";
    var groupinfo = $scope.searchResults[index];
    var group_dbs = [];
    $http.get('/api/databases/'+groupinfo.Name).success(function(data){
      if(data.Success){
        group_dbs= data.Results;
        var all_checked = true;
        for(var i=0; i<$scope.databases.length; i++){
          var db = $scope.databases[i];
          if(group_dbs.indexOf(db.Name) >=0){
            $scope.databases[i].Checked = true;
          }
          else{
            $scope.databases[i].Checked = false;
            all_checked = false;
          }
        }
        $scope.allCheck = all_checked;
        $scope.dbRef = JSON.stringify($scope.databases);
      }
    });
    $http.get('/api/users/'+groupinfo.ID).success(function(data){
      if(data.Success){
        groupinfo.Users = data.Results;
        $scope.groupRef = JSON.stringify(groupinfo);
      }
    });
    $scope.group = groupinfo;
    $scope.isSearching=false;
    $scope.isEditing = true;
  }

  $scope.nochange=function(){
    if($scope.groupRef && $scope.dbRef){
      return (($scope.groupRef===JSON.stringify($scope.group))&&($scope.dbRef === JSON.stringify($scope.databases)));
    }
    else{
      return false;
    }
  }

  $scope.addGroup=function(){
    $scope.group = {};
    $scope.groupRef=null;
    $scope.dbRef = null;
    $scope.db_edit = true;
    $scope.show_db_text = "View Databases";
    $scope.databases.forEach(function(db, i){
      db.Checked=false;
    });
    $scope.isEditing = true;
    $scope.isSearching = false;
  }

  $scope.saveGroup=function(){
    var groupdata = JSON.parse(JSON.stringify($scope.group));
    groupdata.Databases = [];
    for(var i=0; i<$scope.databases.length; i++){
      if($scope.databases[i].Checked){
        groupdata.Databases.push($scope.databases[i].Name);
      }
    }
    $http.post('/api/groups', groupdata).success(function(data){
      if(data.Success){
        $scope.group.ID = data.ID;
        $scope.refreshSearch();
        $scope.groupRef=null;
        $scope.dbRef = null;
        toastr.success("Group updated successfuly!");
      }
    });
  }

  $scope.removeGroup=function(){
    var gid = $scope.group.ID;
    $http.delete('/api/groups/' + gid).success(function(data){
      $scope.isEditing=false;
      $scope.refreshSearch();
      $scope.isSearching = true;
      $scope.db_edit = false;
      $scope.show_db_text = "Edit Databases";
      $scope.group = {};
      $scope.groupRef=null;
      $scope.dbRef = null;
      toastr.success("Group removed");
    });
  }

});
