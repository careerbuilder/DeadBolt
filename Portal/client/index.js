'use strict';
var app = angular.module('DeadBolt', ['ngRoute', 'ngCookies', 'toastr']);

app.config(['$routeProvider', '$httpProvider', function($routeProvider, $httpProvider) {
	$routeProvider.when('/', {
		controller: 'PageController',
		templateUrl: 'views/welcome.html'
	})
  .when('/history', {
		controller: 'HistoryCtrl',
		templateUrl: 'views/history.html'
	})
	.when('/login', {
		controller: 'LoginCtrl',
		templateUrl: 'views/login.html'
	})
	.when('/signup', {
		controller: 'SignupCtrl',
		templateUrl: 'views/signup.html'
	})
	.when('/groups', {
		controller: 'GroupCtrl',
		templateUrl: 'views/groups.html'
	})
	.when('/databases', {
		controller: 'DBCtrl',
		templateUrl: 'views/databases.html'
	})
  .when('/users', {
		controller: 'UserCtrl',
		templateUrl: 'views/users.html'
	})
	.when('/errors', {
		controller: 'ErrorCtrl',
		templateUrl: 'views/results.html'
	})
	.otherwise({redirectTo: 'home'});
  $httpProvider.interceptors.push('httpRequestInterceptor');
}]);

app.controller('PageController', function($http, $scope, $cookies, $cookieStore, $location, toastr){
  $scope.tab=-1;
	var auth_cookie = $cookieStore.get('rds_ad');
	if(auth_cookie){
		$http.post('https://deadbolt.cbsitedb.net/api/auth',{Session: auth_cookie}).success(function(data){
			if(data.Success){
				$scope.authentication = data.valid;
			}
			else{
				$cookieStore.remove('rds_ad');
				toastr.warning('Please log in','Session Expired');
			}
		});
	}

	$scope.$on('tabChanged', function(event, arg) {
		$scope.tab = arg;
	});

	$scope.$on('loginSuccess', function(event, args) {
		$scope.authentication = args;
	});

	$scope.logOut = function(){
		$cookieStore.remove('rds_ad');
		$scope.authentication = false;
		$location.path('#/');
	}

	$scope.isLoggedIn = function(){
		return $scope.authentication;
	}
});

app.factory('httpRequestInterceptor', function ($cookieStore) {
  return {
    request: function (config) {
      config.headers['Authorization'] = $cookieStore.get('rds_ad') || "";
      return config;
    }
  };
});
