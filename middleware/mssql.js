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
var mssql = require('mssql');

module.exports = {
  connect: function(config, callback){
    var connection = new mssql.Connection(config, function(err){
      if(err){
        return callback(err);
      }
      return callback(null, connection);
    });
  },
  query: function(conn, sql, callback){
    var trans = conn.transaction();
    trans.begin(function(err){
      if(err){
        console.log('Error beginning transaction');
        return callback(err);
      }
      var request = trans.request();
      request.query(sql, function(err, records){
        if(err){
          var sql_error = err;
          trans.rollback(function(error){
            if(error){
              console.log('Error rolling back transaction: ',error);
            }
            console.log('Transaction rolled back');
            return callback(sql_error);
          });
        }
        else{
          trans.commit(function(err) {
              if(err){
                console.log('Error committing transaction');
                return callback(err);
              }
              return callback(null, records);
          });
        }
      });
    });
  }
};
