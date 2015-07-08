var express = require('express');
var router = express.Router();
var connection = require('./mysql');
var db_tools = require('../tools/db_tools.js');

router.get('/', function(req, res){
  connection.query("Select * from Errors where Acknowledged=0 Order by ID DESC", function(err, results){
    if(err){
      console.log(err);
      return res.send({Success: false, Error: err});
    }
    return res.send({Success:true, Results: results});
  })
});

router.delete('/:id', function(req, res){
  var id = req.params.id;
  connection.query("Update Errors Set Acknowledged=1 where ID=?", [id], function(err, result){
    if(err){
      console.log(err);
      return res.send({Success: false, Error: err});
    }
    return res.send({Success:true});
  });
});

router.post('/retry/:id', function(req, res){
  var id = req.params.id;
  var query = "Select users.*, `databases`.*, `errors`.Retryable from Errors Join Users ON Users.Username = errors.Username Join `Databases` ON `Databases`.Name = Errors.`Database` Where Errors.ID=?;"
  connection.query(query, [id], function(err, results){
    if(err){
      console.log(err);
      return res.send({Success:false, Error:err});
    }
    if(results[0].Retryable == 0){
      return res.send({Success:false, Error:err});
    }
    var data = results;
    connection.query("Update Errors set Acknowledged=1 where id=?", [id], function(err, results){
      if(err){
        console.log(err);
        return res.send({Success:false, Error:err});
      }
      db_tools.update_users(data[0], data, function(errs){});
    });
  });
});

router.post('/retry/', function(req, res){
  var id = req.params.id;
  var query = "Select users.*, `databases`.*, `errors`.Retryable from Errors Join Users ON Users.Username = errors.Username Join `Databases` ON `Databases`.Name = Errors.`Database` Where Errors.Acknowledged=0 AND Errors.Retryable=1;"
  connection.query(query, [id], function(err, results){
    if(err){
      console.log(err);
      return res.send({Success:false, Error:err});
    }
    var databases = {};
    results.forEach(function(res, i){
      if(!res.Name in databases){
        databases[res.Name] = [];
      }
      databases[res.Name].push(res);
    });
    connection.query("Update Errors set Acknowledged=1 where ID>0", function(err, results){
      if(err){
        console.log(err);
        return res.send({Success:false, Error:err});
      }
      for (var db in databases) {
        if (databases.hasOwnProperty(db)){
          console.log("Retrying operations for " + databases[db][0].Name);
          db_tools.update_users(databases[db][0], databases[db], function(errs){});
        }
      }
      return res.send({Success:true});
    });
  });
});

module.exports=router;
