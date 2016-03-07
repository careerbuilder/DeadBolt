var router = require('express').Router();
var hashes = require('../middleware/passwordhash');

router.use('/auth/', require('./auth'));



module.exports=router;
