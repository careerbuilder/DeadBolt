app.factory('authService', ['$q', '$http','$cookies', function($q, $http, $cookies){
  var session;
  var user;
  var auth_cookie = $cookies.get('dbpp_sc');
  var IsAdmin = false;

  function getAdmin(callback){
    $http.post('/api/auth').then(function(res){
      var data = res.data;
      if(data.Success){
        if(data.User.IsAdmin){
          IsAdmin = data.User.IsAdmin;
        }
        user = data.User;
        return callback(null, IsAdmin);
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
         cookies.remove('dbpp_sc');
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
    getUser: function(){
      return user;
    },
    isAdmin: function(){
      return IsAdmin;
    },
    hasAdminAccess: function(){
      var deferred = $q.defer();
      if(session){
        getAdmin(function(err, isadmin){
          if(err){
            deferred.reject(err);
          }
          else{
            if(admins.indexOf(-1)>-1){
              deferred.resolve(isadmin);
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
        getAdmin(function(err, isAdmin){
          if(err){
            deferred.reject(err);
          }
          else{
            deferred.resolve(user);
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
      if(creds && creds.Username && creds.Password){
        $http.post('/api/auth/login', creds)
        .then(function(res){
          var data = res.data;
          if(data.Success){
            session = data.Session;
            deferred.resolve(data.User);
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
    logOut: function(){
      $cookies.remove('dbpp_sc');
      auth_cookie = null;
      session = null;
      IsAdmin = false;
    }
  };
}]);
