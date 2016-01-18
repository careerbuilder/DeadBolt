'use strict';

app.factory('authService', ['$q', '$http','$cookies', function($q, $http, $cookies){

  var session;
  var auth_cookie = $cookies.get('rdsapit');
  var admins = [];
  var fullAdmin = false;

  function getAdmin(callback){
    $http.post('/api/auth').then(function(res){
      var data = res.data;
      if(data.Success){
        if(data.FullAdmin){
          fullAdmin = data.FullAdmin;
        }
        if(data.Admins){
          admins = data.Admins;
        }
        return callback(null, admins);
      }
      else{
        return callback({authenticated: false});
      }
    }, function(err){
      return callback({authenticated: false});
    });
  }

  if(auth_cookie){
     session = auth_cookie;
     getAdmin(function(err, admins){
       if(err){
         console.log('Invalid Session');
       }
       else{
         console.log('resuming session');
       }
     });
  }

  return {
    getSession: function(){
      return session;
    },
    isAdmin: function(){
      return fullAdmin;
    },
    getAdmins: function(){
      return admins;
    },
    hasAdminAccess: function(){
      var deferred = $q.defer();
      if(session){
        getAdmin(function(err, admins){
          if(err){
            deferred.reject(err);
          }
          else{
            if(admins.indexOf(-1)>-1){
              deferred.resolve(admins);
            }
            else{
              deferred.reject({AdminAuth: false});
            }
          }
        });
      }
      else{
        deferred.reject({AdminAuth: false});
      }
      return deferred.promise;
    },
    hasAccess: function(){
      var deferred = $q.defer();
      if(session){
        getAdmin(function(err, admins){
          if(err){
            deferred.reject(err);
          }
          else{
            deferred.resolve(admins);
          }
        });
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
            getAdmin(function(err, admins){
              if(err){
                deferred.reject(err);
              }
              else{
                deferred.resolve(admins);
              }
            });
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
      admins = [];
      fullAdmin = false;
    }
  }
}]);
