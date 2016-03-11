var crypto = require('crypto');

function mysql_hash(password){
  var h1 = crypto.createHash('sha1');
  var h2 = crypto.createHash('sha1');
  h1.update(password);
  h2.update(h1.digest('binary'));
  return '*'+h2.digest('hex').toUpperCase();
}

function mssql_hash(password){
  var h1 = crypto.createHash('sha512');
  var salt = crypto.randomBytes(4).toString('hex');
  var enc_pass = new Buffer(password, 'ucs2').toString('hex');
  h1.update(enc_pass, 'hex');
  h1.update(salt, 'hex');
  var hash = salt+h1.digest('hex');
  return '0x0200'+hash.toUpperCase();
}

function portal_hash(password){
  var salt = crypto.randomBytes(16).toString('hex');
  hash = crypto.createHash('sha512');
  hash.update(salt);
  hash.update(password);
  return {Salt: salt, Password: hash.digest('hex')};
}

module.exports={
  get_mysql_pass:function(password){
    return mysql_hash(password);
  },
  get_mssql_pass:function(password){
    return mssql_hash(password);
  },
  get_portal_creds:function(password){
    return portal_hash(password);
  },
  get_all:function(password, callback){
    var hash_obj = {
      mysql: mysql_hash(password),
      mssql: mssql_hash(password),
      portal: portal_hash(password)
    };
    return callback(hash_obj);
  }
};
