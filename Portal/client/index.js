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
			auth: ["authService", function(authService) {return authService.hasAccess();}]
		}
	})
	.when('/groups', {
		controller: 'GroupCtrl',
		templateUrl: 'views/groups.html',
		resolve:{
			auth: ["authService", function(authService) {return authService.hasAccess();}]
		}
	})
	.when('/databases', {
		controller: 'DBCtrl',
		templateUrl: 'views/databases.html',
		resolve:{
			auth: ["authService", function(authService) {return authService.hasAccess();}]
		}
	})
  .when('/users', {
		controller: 'UserCtrl',
		templateUrl: 'views/users.html',
		resolve:{
			auth: ["authService", function(authService) {return authService.hasAccess();}]
		}
	})
	.when('/errors', {
		controller: 'ErrorCtrl',
		templateUrl: 'views/errors.html',
		resolve:{
			auth: ["authService", function(authService) {return authService.hasAccess();}]
		}
	})
	.otherwise({redirectTo: '/'});
  $httpProvider.interceptors.push('httpRequestInterceptor');
}]);

app.controller('PageController', function($http, $scope, $location, authService, tabService, toastr){

	$scope.setTab = function(num){
		tabService.setTab(num);
	}

	$scope.getTab = function(){
		return tabService.getTab();
	}

	$scope.logOut = function(){
		authService.logOut();
		$location.path('/');
	}

	$scope.isLoggedIn = function(){
		return !!authService.getSession();
	}

	$scope.isAdmin = function(){
		return !!authService.isAdmin();
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

app.run(["$rootScope", "$location", "toastr", "tabService", function($rootScope, $location, toastr, tabService) {
  $rootScope.$on("$routeChangeError", function(event, current, previous, eventObj) {
    if (eventObj.authenticated === false) {
      toastr.error('Please Log in First');
			tabService.setTab(-1);
      $location.path("/login");
    }
  });
}]);
