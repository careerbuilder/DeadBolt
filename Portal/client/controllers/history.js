/*
* Copyright 2016 CareerBuilder, LLC
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
* 
*     http://www.apache.org/licenses/LICENSE-2.0
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and limitations under the License.
*/
'use strict';

app.controller('HistoryCtrl', function($http, $scope, $cookies, $cookieStore, toastr, tabService){
  $scope.history=[];
  tabService.setTab(0);
  $http.get('/api/history/7').success(function(data){
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
