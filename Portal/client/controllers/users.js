'use strict';

app.controller('UserCtrl', function($http, $scope, $cookies, $cookieStore, $location, toastr){
  $scope.searchResults = [];
  $scope.user = {};
  $scope.groups = [];
  $scope.searchCreds = {Info: ""};
  $scope.$emit('tabChanged', 1);

  $http.post('https://deadbolt.cbsitedb.net/api/users/search/0', {Info: ""}).success(function(data){
    if(data.Success){
      $scope.isEditing = false;
      $scope.isSearching = true;
      $scope.searchResults = data.Results;
    }
  });

  $http.get('https://deadbolt.cbsitedb.net/api/groups').success(function(data){
    if(data.Success){
      for(var i=0; i<data.Results.length; i++){
        $scope.groups.push({Checked:false, Name:data.Results[i].Name});
      }
    }
  });

  $scope.exists=function(user){
    if(user.User_ID){
      return true;
    }
    return false;
  }

  $scope.notexists=function(user){
    if(user.User_ID){
      return false;
    }
    return true;
  }

  $scope.search=function(pagenum){
    $http.post('https://deadbolt.cbsitedb.net/api/users/search/'+pagenum, $scope.searchCreds).success(function(data){
      if(data.Success){
        $scope.isEditing = false;
        $scope.isSearching = true;
        $scope.searchResults = data.Results;
      }
    });
  }

  $scope.refreshSearch = function(){
    $http.post('https://deadbolt.cbsitedb.net/api/users/search/0', $scope.searchCreds).success(function(data){
      if(data.Success){
        $scope.isEditing = false;
        $scope.isSearching = true;
        $scope.searchResults = data.Results;
      }
    });
  }

  $scope.page_array=function(){
    var quick_pages = [];
    var bottom = Math.max($scope.page-2, 0);
    var top = Math.min($scope.pages, $scope.page+2);
    var length = Math.max(top-bottom, 5);
    for(var i=bottom; i<bottom+length; i++){
      quick_pages.push(i);
    }
    return quick_pages;
  }

  $scope.edit=function(index){
    $scope.isSearching=false;
    $scope.isEditing = true;
    var userinfo = $scope.searchResults[index];
    var usergroups = [];
    if(userinfo.User_ID){
      $scope.userRef = JSON.stringify(userinfo);
      $http.get('https://deadbolt.cbsitedb.net/api/groups/'+userinfo.Username).success(function(data){
        if(data.Success){
          usergroups = data.Results;
          for(var i=0; i<$scope.groups.length; i++){
            var g = $scope.groups[i];
            if(usergroups.indexOf(g.Name)>=0){
              $scope.groups[i].Checked = true;
            }
            else{
              $scope.groups[i].Checked = false;
            }
          }
        }
      });
    }
    else{
      $scope.userRef = null;
      for(var i=0; i<$scope.groups.length; i++){
        $scope.groups[i].Checked = false;
      }
    }
    $scope.user = userinfo;
  }

  $scope.nochange=function(){
    if($scope.userRef){
      return ($scope.userRef===JSON.stringify($scope.user));
    }
    else{
      return false;
    }
  }

  $scope.saveUser=function(){
    var userdata = JSON.parse(JSON.stringify($scope.user));
    userdata.Groups = [];
    for(var i=0; i<$scope.groups.length; i++){
      if($scope.groups[i].Checked){
        userdata.Groups.push($scope.groups[i].Name);
      }
    }
    $http.post('https://deadbolt.cbsitedb.net/api/users', userdata).success(function(data){
      if(data.Success){
        $scope.user.User_ID = data.ID;
        $scope.refreshSearch();
        toastr.success("User updated successfuly!");
      }
    });
  }

  $scope.removeUser=function(){
    var uid = $scope.user.User_ID;
    $http.delete('https://deadbolt.cbsitedb.net/api/users/' + uid).success(function(data){
      $scope.user = {};
      $scope.refreshSearch();
    });
  }

});
