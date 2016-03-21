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
var express = require('express');
var router = express.Router();
var async = require('async');
var connection = require('../middleware/mysql');
var encryption = require('../middleware/encryption');
var db_tools = require('../tools/db_tools');

function test_connection(db, callback){
  if(db.Force){
    return callback(null, true);
  }
  else{
    db_tools.test_connection(db, function(err, success){
      return callback(err, success);
    });
  }
}


function add_database(body, callback){
  test_connection(body, function(err, success){
    if(err || !success){
      if(err){
        console.log(err);
      }
      return callback('Unable to Connect');
    }
    encryption.encrypt(body.SAPass, function(err, data){
      if(err){
        return callback(err);
      }
      var sacreds = data;
      var args = [body.Name, body.Type, body.Host, body.Port, body.SAUser, sacreds, body.ForceSSL];
      var query = 'Insert into `databases` (Name, Type, Host, Port, SAUser, SAPass, ForceSSL) values (?, ?, ?, ?, ?, ?, ?) On Duplicate key Update Name=Values(Name), Host=Values(Host), Port=Values(Port), Type=Values(Type), SAUser=Values(SAUser), SAPass=Values(SAPass), ForceSSL=Values(ForceSSL);';
      connection.query(query, args, function(err, result){
        if(err){
          return callback(err);
        }
        connection.query('Select ID from `databases` where Host=? and Port=? and Name=?', [body.Host, body.Port, body.Name], function(err, results){
          if(err){
            return callback(err);
          }
          if(results.length<1){
            return callback('No such server!');
          }
          var DB_ID = results[0].ID;
          body.ID = DB_ID;
          connection.query("Insert into groups_databases (Group_ID, Database_ID) Values(-1, ?) ON DUPLICATE KEY UPDATE Database_ID=Database_ID;", [DB_ID], function(err, result){
            if(err){
              return callback(err);
            }
            var dbinfo = {Name: body.Name, Type: body.Type, Host: body.Host, Port: body.Port, SAUser: body.SAUser, SAPass: sacreds, ForceSSL:body.ForceSSL, ID:DB_ID};
            db_tools.update_all_users(dbinfo, function(err, results){});
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
  });
}

function update_database(body, callback){
  var DB_ID = body.ID;
  var args = [body.Name, body.Type, body.Host, body.Port, body.SAUser, body.ForceSSL];
  var query = 'Update `databases` SET Name = ?, Type = ?, Host = ?, Port = ?, SAUser = ?, ForceSSL=?';
  var sacreds;
  async.series([
    function(cb){
      if(body.SAPass && body.SAPass.length > 0){
        encryption.encrypt(body.SAPass, function(err, data){
          if(err){
            return cb(err);
          }
          sacreds = data;
          return cb();
        });
      }
      else{
        connection.query('Select SAPass from `databases` where ID=?', [DB_ID], function(err, results){
          if(err){
            return cb(err);
          }
          sacreds = results[0].SAPass;
          return cb();
        });
      }
    },
    function(cb){
      if(body.SAPass && body.SAPass.length > 0){
        query += ", SAPass = ?";
        args.push(sacreds);
      }
      query += ' Where ID = ?';
      args.push(DB_ID);
      connection.query(query, args, function(err, result){
        if(err){
          console.log(err);
          return cb(err);
        }
        var dbinfo = {Name: body.Name, Type: body.Type, Host: body.Host, Port: body.Port, SAUser: body.SAUser, SAPass: sacreds, ForceSSL:body.ForceSSL, ID:DB_ID};
        db_tools.update_all_users(dbinfo, function(err, results){});
        connection.query('Insert into History (Activity) Value("Edited Database: ?")', [body.Name], function(err, result){
          if(err){
            console.log(err);
          }
          return cb(null, DB_ID);
        });
      });
    }
  ],
  function(err, results){
    if(err){
      return callback(err);
    }
    return callback(null, DB_ID);
  });
}

router.post('/test', function(req, res){
  var body = req.body;
  test_connection(body, function(err, success){
    if(err){
      console.log(err);
    }
    return res.send({Success: success, Error: err});
  });
});

router.post('/', function(req, res){
  var body = req.body;
  if(body.ID){
    update_database(body, function(err, result){
      if(err){
        console.log(err);
        return res.send({Success: false, Error:err});
      }
      return res.send({Success:true, ID: result});
    });
  }
  else{
    add_database(body, function(err, result){
      if(err){
        console.log(err);
        return res.send({Success: false, Error:err});
      }
      return res.send({Success:true, ID: result});
    });
  }
});

router.get('/', function(req, res){
  connection.query('Select ID, Name, Type, Host, Port, ForceSSL from `databases`;', function(err, results){
    if(err){
      console.log(err);
      return res.send({Success:false, Error:err});
    }
    return res.send({Success:true, Results: results});
  });
});

router.post('/search', function(req, res){
  var body = req.body;
  var query = "";
  var args = [];
  if(body && body.Info && body.Info.trim().length > 0){
    var info = "%"+body.Info.toString()+"%";
    query = 'Select `ID`, `Name`, `Type`, `Host`, `Port`, `SAUser`, `ForceSSL` from `databases` where (`Name` like ? OR `Type` like ? OR `Host` like ? OR `Port` like ? OR `SAUser` like ?);';
    args = [info, info, info, info, info];
  }
  else{
    query = 'Select ID, Name, Type, Host, Port, SAUser, ForceSSL from `databases`;';
  }
  connection.query(query, args,  function(err, results){
    if(err){
      console.log(err);
      return res.send({Success: false, Error: err});
    }
    return res.send({Success: true,  Results: results});
  });
});

router.get('/:groupname', function(req, res){
  var groupname = req.params.groupname;
  var query = 'Select Name from `databases` where ID in (Select Database_ID from groups_databases where Group_ID=(Select groups.ID from groups where groups.Name=? LIMIT 1));';
  connection.query(query, [groupname], function(err, results){
    if(err){
      console.log(err);
      return res.send({Success:false, Error:err});
    }
    var dbnames = [];
    for(var i=0; i<results.length; i++){
      dbnames.push(results[i].Name);
    }
    return res.send({Success:true, Results:dbnames});
  });
});

router.delete('/:id', function(req,res){
  var db_id = req.params.id;
  var force = false;
  if(req.query && req.query.force){
    force = !!req.query.force;
  }
  var dbinfo;
  async.series([
    function(cb){
      connection.query("Select * from `databases` where ID = ? LIMIT 1;", [db_id], function(err, data){
        if(err){
          return cb(err);
        }
        if(data.length<1){
          return cb('No such Database');
        }
        dbinfo = data[0];
        return cb();
      });
    },
    function(cb){
      var query = "Delete from groups_databases where Database_ID = ?";
      connection.query(query, [db_id], function(err, result){
        if(err){
          return cb(err);
        }
        return cb();
      });
    },
    function(cb){
      if(force){
        return cb();
      }
      else{
        db_tools.update_all_users(dbinfo, function(errors){
          return cb();
        });
      }
    },
    function(cb){
      connection.query('Delete from `databases` where ID = ?', [db_id], function(err, result){
        if(err){
          return cb(err);
        }
        return cb();
      });
    },
    function(cb){
      connection.query('insert into history (Activity) Value("Deleted db : ?")', [dbinfo.Name], function(err, result){
        if(err){
          console.log(err);
        }
        return cb();
      });
    }
  ], function(err, out){
    if(err){
      return res.send({Success: false, Error:err});
    }
    return res.send({Success: true});
  });
});

module.exports = router;
