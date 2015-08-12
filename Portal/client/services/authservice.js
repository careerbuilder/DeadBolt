'use strict';

app.factory('authService', ['$q', '$http','$cookies', function($q, $http, $cookies){

  var session;
  var auth_cookie = $cookies.get('rdsapit');
	if(auth_cookie){
	   session = auth_cookie;
	}

  return {
    getSession: function(){
      return session;
    },
    hasAccess: function(){
      var deferred = $q.defer();
      if(!!session){
        deferred.resolve(true);
      }
      else{
        deferred.reject({authenticated: false});
      }
      return deferred.promise;
    },
    logIn: function(creds){
      var deferred = $q.defer();
      if(creds && creds.Email && creds.Password){
        $http.post('/api/login', creds)
        .then(function(res){
          var data = res.data;
          if(data.Success){
            session = data.Session;
            deferred.resolve(session);
          }
          else{
            deferred.reject(data.Error);
          }
        }, function(){
          deferred.reject('Could not reach Authentication Service');
        });
      }
      else{
        deferred.reject('No Credentials provided');
      }
      return deferred.promise;
    },
    signUp: function(creds){
      var deferred = $q.defer();
      if(creds && creds.Email && creds.Password){
        $http.post('/api/signup', creds)
        .then(function(res){
          var data = res.data;
          if(data.Success){
            deferred.resolve(data.Success);
          }
          else{
            deferred.reject(data.Error);
          }
        }, function (){
          deferred.reject('Failed to reach Authentication Service');
        });
      }
      else{
        deferred.reject('No Credentials Provided!');
      }
      return deferred.promise;
    },

    logOut: function(){
      $cookies.remove('rdsapit');
      auth_cookie = null;
      session = null;
    }
  }
}]);
