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
var mysql = require('mysql');

var pool = mysql.createPool(global.config.DB);

module.exports = {
	query: function(){
		var sql_args = [];
		var args = [];
		for(var i=0; i<arguments.length; i++){
			args.push(arguments[i]);
		}
		var callback = args[args.length-1]; //last arg is callback
		pool.getConnection(function(err, connection) {
    	if(err) {
				console.log(err);
				callback(err);
				return;
			}
			if(args.length > 2){
				sql_args = args[1];
			}
	    connection.query(args[0], sql_args, function(err, results) {
	      connection.release(); // always put connection back in pool after last query
	      if(err){
					console.log(err);
					callback(err);
					return;
				}
	      callback(null, results);
	    });
		});
	},
	escape: function(value){
		return mysql.escape(value);
	}
};
