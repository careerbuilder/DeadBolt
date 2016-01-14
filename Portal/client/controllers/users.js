'use strict';

app.controller('UserCtrl', function($http, $scope, $cookies, $cookieStore, $location, toastr, authService, tabService){
  tabService.setTab(1);

  $scope.searchResults = [];
  $scope.user = {};
  $scope.groups = [];
  $scope.searchCreds = {Info: ""};
  $scope.numpages = 1;
  $scope.pages = [];
  $scope.currpage = 1;

  $http.get('/api/groups').success(function(data){
    if(data.Success){
      for(var i=0; i<data.Results.length; i++){
        $scope.groups.push({Checked:false, Name:data.Results[i].Name, ID:data.Results[i].ID});
      }
    }
  });

  $scope.isAdmin=function(groupid){
    return authService.isAdmin() || (authService.getAdmins().indexOf(groupid)>-1);
  };

  $scope.search=function(pagenum){
    $http.post('/api/users/search/'+pagenum, $scope.searchCreds).success(function(data){
      if(data.Success){
        $scope.isEditing = false;
        $scope.isSearching = true;
        $scope.searchResults = data.Results;
        var records = data.Total;
        var numpages = ~~(records/50);
        if(records%50 >0){
          numpages +=1;
        }
        $scope.numpages = numpages;
        $scope.currpage = 1;
        $scope.page_change(pagenum+1);
      }
    });
  }

  $scope.page_change=function(newpage){
    $scope.currpage = newpage;
    var pages = [];
    var i = newpage-2;
    var topped = false;
    while(pages.length<$scope.numpages && pages.length<5){
      if(i>0 && i<=$scope.numpages){
        if(topped){
          pages.unshift(i);
        }
        else{
          pages.push(i);
        }
      }
      if(i >= $scope.numpages){
        topped = true;
        i = pages[0];
      }
      if(topped){
        i--;
      }
      else{
        i++;
      }
    }
    $scope.pages = pages;
  }

  $scope.refreshSearch = function(){
    $http.post('/api/users/search/0', $scope.searchCreds).success(function(data){
      if(data.Success){
        $scope.isEditing = false;
        $scope.isSearching = true;
        $scope.searchResults = data.Results;
        var records = data.Total;
        var numpages = records/50;
        if(records%50 >0){
          numpages +=1;
        }
        $scope.numpages = numpages;
      }
    });
  }

  $scope.groupChanged=function(group){
    if(!group.Checked){
      group.Permissions='';
    }
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

  $scope.applyGroups = function(userinfo, callback){
    if(userinfo.Active){
      $http.get('/api/groups/'+userinfo.Username).success(function(data){
        if(data.Success){
          callback(null, data.Results);
        }
        else{
          callback(data);
        }
      });
    }
    else{
      callback(null, {});
    }
  };

  $scope.edit=function(index){
    var userinfo = $scope.searchResults[index];
    var usergroups = [];
    $scope.userRef = null;
    if(userinfo.Active){
      $scope.userRef = JSON.stringify(userinfo);
    }
    $scope.applyGroups(userinfo, function(err, results){
      if(err){
        toastr.error(err,'Something went wrong');
      }
      else{
        var usergroups = results;
        $scope.groups.forEach(function(g){
          if(g.Name in usergroups){
            g.Checked = true;
            g.Permissions = usergroups[g.Name];
          }
          else{
            g.Checked = false;
            g.Permissions = "";
          }
        });
        $scope.groupsRef = JSON.stringify($scope.groups);
        $scope.isSearching=false;
        $scope.isEditing = true;
        $scope.user = userinfo;
      }
    });
  };

  $scope.nochange=function(){
    if($scope.userRef){
      return ($scope.userRef===JSON.stringify($scope.user) && ($scope.groupsRef === JSON.stringify($scope.groups)));
    }
    else{
      return false;
    }
  };

  $scope.saveUser=function(){
    var userdata = JSON.parse(JSON.stringify($scope.user));
    userdata.Groups = {};
    $scope.groups.forEach(function(group, i){
      if(group.Checked){
        userdata.Groups[group.ID]=group.Permissions;
      }
    });
    $http.post('/api/users', userdata).success(function(data){
      if(data.Success){
        $scope.user.Active = data.Active;
        $scope.refreshSearch();
        toastr.success("User updated successfuly!");
      }
      else{
        toastr.error(data.Error, "User failed to updated");
      }
    }, function(err){
      toastr.error(err);
    });
  };

  $scope.removeUser=function(){
    var uid = $scope.user.ID;
    $http.delete('/api/users/' + uid).success(function(data){
      $scope.user = {};
      $scope.refreshSearch();
    });
  }

  $scope.search(0);

});
