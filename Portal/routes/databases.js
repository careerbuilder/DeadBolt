var express = require('express');
var router = express.Router();
var async = require('async');
var connection = require('../middleware/mysql');
var encryption = require('../tools/encryption');
var db_tools = require('../tools/db_tools');

function add_database(body, callback){
  encryption.encrypt(body.SAPass, function(err, data){
    if(err){
      return callback(err);
    }
    var sacreds = data;
    var args = [body.Name, body.Type, body.Host, body.Port, body.SAUser, sacreds];
    var query = 'Insert into `databases` (Name, Type, Host, Port, SAUser, SAPass) values (?, ?, ?, ?, ?, ?) On Duplicate key Update Name=Values(name), Host=Values(Host), Port=Values(Port), Type=Values(Type), SAUser=Values(SAUser), SAPass=Values(SAPass);';
    connection.query(query, args, function(err, result){
      if(err){
        return callback(err);
      }
      var DB_ID = result.insertId;
      body.ID = DB_ID;
      connection.query("Insert into groups_databases (Group_ID, Database_ID) Values(-1, ?) ON DUPLICATE KEY UPDATE Database_ID=Database_ID;", [DB_ID], function(err, result){
        if(err){
          return callback(err);
        }
        var dbinfo = {Name: body.Name, Type: body.Type, Host: body.Host, Port: body.Port, SAUser: body.SAUser, SAPass: sacreds, ID:DB_ID};
        db_tools.update_all_users(dbinfo, function(errs){
          connection.query('Insert into History (Activity) Value("Added Database: ?")', [body.Name], function(err, result){
            if(err){
              console.log(err);
            }
            return callback(null, DB_ID);
          });
        });
      });
    });
  });
}

function update_database(body, callback){
  var DB_ID = body.ID;
  var args = [body.Name, body.Type, body.Host, body.Port, body.SAUser];
  var query = 'Insert into `databases` (Name, Type, Host, Port, SAUser) values (?, ?, ?, ?, ?) On Duplicate key Update Name=Values(name), Host=Values(Host), Port=Values(Port), Type=Values(Type), SAUser=Values(SAUser), SAPass=SAPass;';
  connection.query(query, args, function(err, result){
    if(err){
      console.log(err);
      return callback(err);
    }
    connection.query('Insert into History (Activity) Value("Edited Database: ?")', [body.Name], function(err, result){
      if(err){
        console.log(err);
      }
      return callback(null, DB_ID);
    });
  });
}

router.post('/', function(req, res){
  var body = req.body;
  async.series([
    function(callback){
      if(body.ID){
        return callback(null, body.ID);
      }
      add_database(body, callback);
    },
    function(callback){
      update_database(body, callback);
    }
  ],function(err, results){
    if(err){
      console.log(err);
      return res.send({Success: false, Error:err});
    }
    return res.send({Success:true, ID: results[0]});
  });
});

router.get('/', function(req, res){
  connection.query('Select ID, Name, Type, Host, Port from `databases`;', function(err, results){
    if(err){
      console.log(err);
      return res.send({Success:false, Error:err});
    }
    return res.send({Success:true, Results:results});
  });
});

router.post('/search', function(req, res){
  var body = req.body;
  var query = "";
  var args = [];
  if(body && body.Info && body.Info.trim().length > 0){
    var info = "%"+body.Info+"%";
    query = 'Select ID, Name, Type, Host, Port, SAUser from `databases` where (Name like ? OR Type like ? OR Host like ? OR Port like ? OR SAUser like ?);';
    args = [info, info, info, info, info];
  }
  else{
    query = 'Select ID, Name, Type, Host, Port, SAUser from `databases`;';
  }
  connection.query(query, args, function(err, results){
    if(err){
      console.log(err);
      return res.send({Success: false, Error: err});
    }
    return res.send({Success: true, Results: results});
  });
});

router.get('/:groupname', function(req, res){
  var groupname = req.params.groupname;
  var query = 'Select Name from `databases` where ID in (Select Database_ID from groups_databases where Group_ID=(Select groups.ID from groups where groups.Name=? LIMIT 1));'
  connection.query(query, [groupname], function(err, results){
    if(err){
      console.log(err);
      return res.send({Success:false, Error:err});
    }
    var dbnames = [];
    for(var i=0; i<results.length; i++){
      dbnames.push(results[i].Name)
    }
    return res.send({Success:true, Results:dbnames});
  });
});

router.delete('/:id', function(req,res){
  var db_id = req.params.id;
  connection.query("Select * from `databases` where ID = ? LIMIT 1;", [db_id], function(err, data){
    if(err){
      console.log(err);
      return res.send({Success: false, Error: err});
    }
    var dbinfo = data[0];
    db_tools.update_all_users(dbinfo, function(errors){
      var query = "Delete from groups_databases where Database_ID = ?";
      connection.query(query, [db_id], function(err, result){
        if(err){
          return res.send({Success:false, Error: err});
        }
        connection.query('Delete from `databases` where ID = ?', [db_id], function(err, result){
          if(err){
            return res.send({Success:false, Error: err});
          }
          connection.query('insert into history (Activity) Value("Deleted db : ?")', [dbinfo.Name], function(err, result){
            if(err){
              return res.send({Success: true, Error: "History error: " + err.toString()});
            }
            return res.send({Success: true});
          });
        });
      });
    });
  });
});

module.exports = router;
