'use strict';
var app = angular.module('DeadBolt', ['ngRoute', 'ngCookies', 'toastr']);

app.config(['$routeProvider', '$httpProvider', function($routeProvider, $httpProvider) {
	$routeProvider.when('/', {
		controller: 'PageController',
		templateUrl: 'views/welcome.html'
	})
	.when('/login', {
		controller: 'AuthCtrl',
		templateUrl: 'views/auth.html',
		resolve:{
			isLoggingin: function(){
				return true;
			}
		}
	})
	.when('/signup', {
		controller: 'AuthCtrl',
		templateUrl: 'views/auth.html',
		resolve:{
			isLoggingin: function(){
				return false;
			}
		}
	})
	.when('/history', {
		controller: 'HistoryCtrl',
		templateUrl: 'views/history.html',
		resolve:{
			auth: 'accessService'
		}
	})
	.when('/groups', {
		controller: 'GroupCtrl',
		templateUrl: 'views/groups.html',
		resolve:{
			auth: 'accessService'
		}
	})
	.when('/databases', {
		controller: 'DBCtrl',
		templateUrl: 'views/databases.html',
		resolve:{
			auth: 'accessService'
		}
	})
  .when('/users', {
		controller: 'UserCtrl',
		templateUrl: 'views/users.html',
		resolve:{
			auth: 'accessService'
		}
	})
	.when('/errors', {
		controller: 'ErrorCtrl',
		templateUrl: 'views/errors.html',
		resolve:{
			auth: 'accessService'
		}
	})
	.otherwise({redirectTo: '/'});
  $httpProvider.interceptors.push('httpRequestInterceptor');
}]);

app.controller('PageController', function($http, $scope, $location, authService, toastr){
  $scope.tab=-1;

	$scope.$on('tabChanged', function(event, arg) {
		$scope.tab = arg;
	});

	$scope.logOut = function(){
		authService.logOut();
		$location.path('/');
	}

	$scope.isLoggedIn = function(){
		return !!authService.getSession();
	}
});

app.factory('httpRequestInterceptor', function ($cookies) {
  return {
    request: function (config) {
      config.headers['Authorization'] = $cookies.get('rdsapit');
      return config;
    }
  };
});

app.factory('accessService', ["$q", "authService", function($q, authService) {
  var userInfo = authService.getSession();
  if (userInfo) {
    return $q.when(userInfo);
  } else {
    return $q.reject({ authenticated: false });
  }
}]);

app.run(["$rootScope", "$location", "toastr", function($rootScope, $location, toastr) {
  $rootScope.$on("$routeChangeError", function(event, current, previous, eventObj) {
    if (eventObj.authenticated === false) {
      toastr.error('Please Log in First');
      $location.path("/login");
    }
  });
}]);
