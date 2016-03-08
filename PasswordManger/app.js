var express    	= require('express');
var bodyParser 	= require('body-parser');
var ejs         = require('ejs');
var path        = require('path');

var app        	= express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
global.config = require('./config.json');
var port = 3000;

/*
*----------------Handle Client-----------
*/
app.set('view engine','html');
app.engine('html', ejs.renderFile);
app.use(express.static(path.join(__dirname, 'client')));


// ROUTES FOR THE API
// =============================================================================
app.use('/api', require('./routes/api'));

app.get('/ping', function(req,res){
	return res.send('Pong!');
});

//keep this last, as it will return 404
app.use(function(req, res, next){
  res.status(404);
  if (req.accepts('json')) {
    return res.send({Success:false, Error: 'Not a valid endpoint'});
  }
  return res.type('txt').send('Not found');
});

if(global.config.SSL){
  var fs = require('fs');
  var https = require('https');
  https.createServer({
    key: fs.readFileSync(global.config.SSL.keyfile),
    cert: fs.readFileSync(global.config.SSL.certfile)
  },app).listen(port);
}
else{
  app.listen(port);
}
console.log('Magic happens on port ' + port);
