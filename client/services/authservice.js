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
app.factory('authService', ['$q', '$http','$cookies', function($q, $http, $cookies){

  var session;
  var user;
  var auth_cookie = $cookies.get('rdsapit');
  var admins = [];
  var fullAdmin = false;
  var isGod = false;

  var requirements = {
    Forbidden:  [/p[a@][$s]{2}/i, '123', /t[e3][s$]t/i, /^admin/i, /^guest$/i, /\s+/, /[,\\]/],
    MinLength: 8,
    MinLowerCase: 1,
    MinUpperCase: 1,
    MinNumbers:2,
    MinSymbols:1
  };

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
        if(data.God){
          isGod = data.God;
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

  function getGod(callback){
    $http.post('/api/auth').then(function(res){
      var data = res.data;
      if(data.Success){
        if(data.God){
          isGod = true;
          return callback(null, {God: true});
        }
      }
      else{
        return callback({God: false});
      }
    }, function(err){
      return callback({God: false});
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
      return admins.length>0;
    },
    isFullAdmin: function(){
      return fullAdmin;
    },
    isGod: function(){
      return isGod;
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
    hasGodAccess: function(){
      var deferred = $q.defer();
      if(session){
        getGod(function(err, god){
          if(err){
            deferred.reject(err);
          }
          else{
            if(god){
              deferred.resolve({GodAuth: true});
            }
            else{
              deferred.reject({GodAuth: false});
            }
          }
        });
      }
      else{
        deferred.reject({GodAuth: false});
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
            if(admins.length>0){
              deferred.resolve(admins);
            }
            else{
              deferred.reject({authenticated: false});
            }
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
    forgotPassword:function(email){
      var deferred = $q.defer();
      $http.post('/api/auth/forgot', {Email: email})
      .then(function(res){
        var data = res.data;
        if(data.Success){
          deferred.resolve(true);
        }
        else{
          deferred.reject(data.Error);
        }
      }, function(){
        deferred.reject('Could not reach Authentication Service');
      });
      return deferred.promise;
    },
    changePassword: function(creds){
      var deferred = $q.defer();
      if(creds && creds.Password){
        $http.post('/api/auth/changePassword/', creds)
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
      isGod = false;
    },
    validatePassword: function(creds){
      if(!creds || !creds.Password || creds.Password.length<1){
        return {Valid:true};
      }
      if(creds.Password.length<requirements.MinLength){
        return {Valid:false, Error:'Password must be at least ' + requirements.MinLength + ' characters'};
      }
      for(var i=0; i<requirements.Forbidden.length; i++){
        var f = requirements.Forbidden[i];
        if(creds.Password.search(f)>-1){
          return {Valid: false, Error: 'Forbidden password pattern'};
        }
      }
      var upper=0, lower=0, number=0, symbol=0;
      for(var j=0; j<creds.Password.length; j++){
        var char = creds.Password[j];
        if(char.match(/[a-z]/)){
          lower++;
        }
        else if(char.match(/[A-Z]/)){
          upper++;
        }
        else if(char.match(/[0-9]/)){
          number++;
        }
        else{
          symbol++;
        }
      }
      if(lower < requirements.MinLowerCase){
        return {Valid: false, Error: 'Requires at least ' + requirements.MinLowerCase +' lowercase characters'};
      }
      if(upper < requirements.MinUpperCase){
        return {Valid: false, Error: 'Requires at least ' + requirements.MinUpperCase +' uppercase characters'};
      }
      if(number < requirements.MinNumbers){
        return {Valid: false, Error: 'Requires at least ' + requirements.MinNumbers +' numbers'};
      }
      if(symbol < requirements.MinSymbols){
        return {Valid: false, Error: 'Requires at least ' + requirements.MinSymbols +' symbols'};
      }
      return {Valid: true};
    }
  };
}]);
