'use strict';

app.controller('UserCtrl', function($http, $scope, $cookies, $cookieStore, $location, toastr, tabService){
  tabService.setTab(1);
  $scope.searchResults = [];
  $scope.user = {};
  $scope.groups = [];
  $scope.searchCreds = {Info: ""};
  $scope.numpages = 1;
  $scope.pages = [];
  $scope.currpage = 1;

  $http.post('/api/users/search/0', {Info: ""}).success(function(data){
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
      $scope.page_change(1);
    }
  });

  $http.get('/api/groups').success(function(data){
    if(data.Success){
      for(var i=0; i<data.Results.length; i++){
        $scope.groups.push({Checked:false, Name:data.Results[i].Name, ID:data.Results[i].ID});
      }
    }
  });

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
    $scope.pages = [];
    $scope.currpage = newpage;
    if(newpage < 2){
      for(var i=1; i<4; i++){
        if(i<= $scope.numpages){
          $scope.pages.push(i);
        }
      }
    }
    else if(newpage == $scope.numpages){
      for(var i=newpage; i>newpage-3; i--){
        if(i>0){
          $scope.pages.unshift(i);
        }
      }
    }
    else{
      $scope.pages=[newpage-1,newpage,newpage+1];
    }
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
    if(userinfo.User_ID){
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
  }

  $scope.edit=function(index){
    var userinfo = $scope.searchResults[index];
    var usergroups = [];
    $scope.userRef = null;
    if(userinfo.User_ID){
      $scope.userRef = JSON.stringify(userinfo);
    }
    $scope.applyGroups(userinfo, function(err, results){
      if(err){
        toastr.error('err','Something went wrong');
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
  }

  $scope.nochange=function(){
    if($scope.userRef){
      return ($scope.userRef===JSON.stringify($scope.user) && ($scope.groupsRef === JSON.stringify($scope.groups)));
    }
    else{
      return false;
    }
  }

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
        $scope.user.User_ID = data.ID;
        $scope.refreshSearch();
        toastr.success("User updated successfuly!");
      }
    });
  }

  $scope.removeUser=function(){
    var uid = $scope.user.User_ID;
    $http.delete('/api/users/' + uid).success(function(data){
      $scope.user = {};
      $scope.refreshSearch();
    });
  }

});
