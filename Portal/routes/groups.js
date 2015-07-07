var express = require('express');
var router = express.Router();
var async = require('async');
var connection = require('./mysql');
var encryption = require('../tools/encryption');
var db_tools = require('../tools/db_tools');


function add_group(body, callback){
  var query = 'Insert into groups (Name) value (?) ON Duplicate KEY UPDATE Name=Name';
  connection.query(query, [body.Name], function(err, result){
    if(err){
      console.log(err);
      callback(err);
    }
    body.ID = result.insertId;
    return callback(null, body);
  });
}

function update_group(body, callback){
  var Group_ID = body.ID;
  connection.query("Select * from `databases` where ID in (Select Database_ID from groups_databases where Group_ID = ?) ORDER BY ID ASC", [Group_ID], function(err, results){
    if(err){
      console.log(err);
      callback(err);
    }
    var old_dbs = results || [];
    if(old_dbs.length==0 && body.Databases.length==0){
      console.log("No DB Changes");
      callback(null, body);
    }
    var del_group_query ="";
    var add_group_query = "";
    if(body.Databases.length>0){
      var db_where = 'where (';
      for(var i =0; i<body.Databases.length; i++){
        db_where += '`databases`.Name = ?';
        if(i<body.Databases.length-1){
          db_where += ' OR ';
        }
      }
      db_where+=')';
      del_group_query = 'Delete from groups_databases where Group_ID= ? and Database_ID not in (Select ID from `databases` '+db_where+');';
      add_group_query = 'Insert into groups_databases (Group_ID, Database_ID) Select ?, `databases`.ID from `databases` ' + db_where +' ON DUPLICATE KEY UPDATE Group_ID=Group_ID;';
    }
    else{
      del_group_query = 'Delete from groups_databases where Group_ID= ?;';
      add_group_query = 'Set @dummy=?;';
    }
    connection.query(del_group_query, [Group_ID].concat(body.Databases), function(err, results){
      if(err){
        console.log(err);
        callback(err);
      }
      connection.query(add_group_query, [Group_ID].concat(body.Databases), function(err, results){
        if(err){
          console.log(err);
          callback(err);
        }
        connection.query("Select * from `databases` where ID in (Select Database_ID from groups_databases where Group_ID = ?) ORDER BY ID ASC", [Group_ID], function(err, results){
          if(err){
            console.log(err);
            callback(err);
          }
          var new_dbs = results;
          var lim = Math.max(old_dbs.length, new_dbs.length);
          var affected_dbs = [];
          for(var i=0; i<lim; i++){
            if(i < new_dbs.length){
              if(old_dbs.indexOf(new_dbs[i])<0){
                affected_dbs.push(new_dbs[i]);
              }
            }
            if(i < old_dbs.length){
              if(new_dbs.indexOf(old_dbs[i])<0){
                affected_dbs.push(old_dbs[i]);
              }
            }
          }
          connection.query("Select * from users where ID in (Select User_ID from users_groups where Group_ID=?)", [Group_ID], function(err, results){
            if(err){
              console.log(err);
              callback(err);
            }
            async.each(affected_dbs, function(db, inner_callback){
              db_tools.update_users(db, results, function(errs){
                inner_callback();
              });
              }, function(err, results){
                console.log("Group updated");
                callback(null, body);
              });
            });
          });
        });
      });
    });
  });
}

router.get('/', function(req, res){
  connection.query('Select ID, Name from groups;', function(err, results){
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
  if(body.Info && body.Info.length > 0){
    var info = "%"+body.Info+"%";
    query = 'Select ID, Name from groups where Name like ?';
    args = [info];
  }
  else{
    query = 'Select ID, Name from groups;';
  }
  connection.query(query, args, function(err, results){
    if(err){
      console.log(err);
      return res.send({Success: false, Error: err});
    }
    return res.send({Success: true, Results: results});
  });
});

router.get('/:username', function(req, res){
  var username = req.params.username;
  var query = 'Select Name from groups where ID in (Select Group_ID from users_groups where User_ID=(Select Users.ID from Users where Username=? LIMIT 1));'
  connection.query(query, [username], function(err, results){
    if(err){
      console.log(err);
      return res.send({Success:false, Error:err});
    }
    var gnames = [];
    for(var i=0; i<results.length; i++){
      gnames.push(results[i].Name)
    }
    return res.send({Success:true, Results:gnames});
  });
});

router.post('/', function(req, res){
  var body = req.body;
  if(!body.ID){
    async.waterfall([
      function(callback){
        add_group(body, callback);
      },
      function(new_body, callback){
        update_group(new_body, callback);
      },
      function(info, callback){
        connection.query('Insert into History (Activity) Value("Added group: ?")', [info.Name], function(err, result){
          if(err){
            console.log(err);
            callback(err);
          }
          callback(null, info);
        });
      }
    ], function(err, results){
      if(err){
        return res.send({Success: false, Error: err});
      }
      return res.send({Success: true, ID: results.ID})
    });
  }
  else{
    async.waterfall([
      function(callback){
        update_group(body, callback);
      },
      function(info, callback){
        connection.query('Insert into History (Activity) Value("Edited Databases for group: ?")', [info.Name], function(err, result){
          if(err){
            console.log(err);
            callback(err);
          }
          callback(null, info);
        });
      }
    ], function(err, results){
      if(err){
        return res.send({Success: false, Error: err});
      }
      return res.send({Success: true, ID: results.ID})
    });
  }
});

router.delete('/:id', function(req,res){
  var group_id = req.params.id;
  connection.query("Select * from `databases` where ID in (Select Database_ID from groups_databases where Group_ID = ?);", [group_id], function(err, results){
    if(err){
      console.log(err);
      return res.send({Success:false, Error: err});
    }
    var databases = results;
    connection.query("Select * from users where ID in (Select User_ID from users_groups where Group_ID=?)", [group_id], function(err, results){
      if(err){
        console.log(err);
        return res.send({Success:false, Error: err});
      }
      var users = results;
      console.log("removing group " + group_id);
      var query = "Delete from groups_databases where Group_ID = ?";
      connection.query(query, [group_id], function(err, result){
        if(err){
          console.log(err);
          return res.send({Success:false, Error: err});
        }
        connection.query("Delete from users_groups where Group_ID = ?", [group_id], function(err, results){
          if(err){
            console.log(err);
            return res.send({Success:false, Error: err});
          }
          connection.query('Delete from groups where ID = ?', [group_id], function(err, result){
            if(err){
              console.log(err);
              return res.send({Success:false, Error: err});
            }
            databases.forEach(function(db, i){
              db_tools.update_users(db, users, function(errors){
                //console.log(errors);
              });
            });
            connection.query('Insert into History (Activity) Value("Deleted group with ID: ?")', [group_id], function(err, result){
              if(err){
                console.log(err);
                return res.send({Success: true, Error: "History error: " + err.toString(), });
              }
              return res.send({Success: true});
            });
          });
        });
      });
    });
  });
});


module.exports = router;
