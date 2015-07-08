'use strict';

app.controller('HistoryCtrl', function($http, $scope, $cookies, $cookieStore, toastr){
  $scope.history=[];
  $scope.$emit('tabChanged', 0);
  $http.get('https://deadbolt.cbsitedb.net/api/history/7').success(function(data){
    if(data.Success){
      data.History.forEach(function(hist, i){
        var timestring = hist.Time.toString();
        var parts = timestring.split('T');
        var dateparts = parts[0].split('-');
        var timeparts = parts[1].split('.')[0];
        var date = dateparts[1]+"/"+dateparts[2]+"/"+dateparts[0];
        var ftime = timeparts+" UTC";
        $scope.history.push({
                            Date: date,
                            Time: ftime,
                            Activity: hist.Activity
                            });
      });
    }
    else{
      console.log(data.Error);
    }
  });
});
