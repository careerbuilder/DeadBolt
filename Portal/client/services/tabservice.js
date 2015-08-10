'use strict';

app.factory('tabService', [function(){

  var tab = -1;

  return {
    getTab: function(){
      return tab;
    },
    setTab: function(num){
      tab = num;
    }
  }
}]);
