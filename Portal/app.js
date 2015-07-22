var express = require('express');
var app = express();
var https = require('https');
var fs = require('fs');
var ejs = require('ejs');
var path = require('path');
var bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

global.config = require('./config.json');
var port = 3000;

/*
*----------------Handle Client-----------
*/
app.set('view engine','html');
app.engine('html', ejs.renderFile);
app.use(express.static(path.join(__dirname, 'client')));

/*
*---------------------API----------------
*/

var api = require('./routes/api.js');
app.use('/api/', api);

app.get('/', function(req,res){
  return res.send('Hello World!');
});

app.use(function(req, res, next){
  res.status(404);
  // respond with json
  if (req.accepts('json')) {
    return res.send({error: 'Not a valid endpoint'});
  }
  // default to plain-text. send()
  return res.type('txt').send('Not found');
});

if('SSL' in global.config){
  var key_file = global.config.SSL.keyfile;
  var cert_file = global.config.SSL.certfile;

  var config = {
    key: fs.readFileSync(key_file),
   cert: fs.readFileSync(cert_file)
  };
  https.createServer(config, app).listen(port);
}
else{
  app.listen(port);
}

console.log('App Started on port ' + port);
