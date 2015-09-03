var mssql = require('mssql');

module.exports = {
  query: function(conn, sql, callback){
    var trans = new mssql.Transaction(conn);
    trans.begin(function(err){
      if(err){
        return callback(err);
      }
      var rolledBack = false;
      trans.on('rollback', function(aborted) {
        rolledBack = true;
      });
      var request = new mssql.Request(trans);
      request.query(sql, function(err, records){
        if(err){
          var sql_error = err;
          if(!rolledBack){
            trans.rollback(function(error){
              if(error){
                console.log('Error rolling back transaction: ',error);
              }
              return callback(sql_error);
            });
          }
        }
        else{
          trans.commit(function(err) {
              if(err){
                return callback(err);
              }
              return callback(null, records);
          });
        }
      });
    });
  }
}
