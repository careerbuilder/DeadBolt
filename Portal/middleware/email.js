var uuid = require('node-uuid');
var nodemailer  = require('nodemailer');
var sesTransport= require('nodemailer-ses-transport');
var connection = require('./mysql.js');
var transporter = nodemailer.createTransport(sesTransport());

module.exports={
  send_reset_email: function(emailinfo, callback){
    var resetid = uuid.v4();
    connection.query('Update Users Set Reset_ID=? where Email=?;',[resetid, emailinfo.To], function(err, result){
      if(err){
        return callback(err);
      }
      var plaintext, html, inithtml, resethtml;
      var url = emailinfo.Site+'/#/reset/'+resetid;
      var initText = "An account has been created for you in the Deadbolt user management system. To activate this account, please go to "+ url;
      var resetText = 'A user has requested a password reset for an account tied to this email. ' +
        '<br />If this was not you, please ignore this email. Otherwise, to reset your password go to '+
        '<a href="'+url+'">'+url+'</a>'; //your link here
      if('Email' in global.config){
        if('InitText' in global.config.Email){
          initText = global.config.Email.InitText;
        }
        if('ResetText' in global.config.Email){
          resetText = global.config.Email.ResetText;
        }
        if('InitHtml' in global.config.Email){
          inithtml = global.config.Email.InitHtml;
        }
        if('ResetHtml' in global.config.Email){
          resethtml = global.config.Email.ResetHtml;
        }
      }
      if(emailinfo.Init){
        plaintext = initText;
        if(inithtml){
          html = inithtml;
        }
        else{
          html = '<p>'+initText+'</p>';
        }
      }
      else{
        plaintext = resetText;
        if(resethtml){
          html = resethtml;
        }
        else{
          html = '<p>'+resetText+'</p>';
        }
      }
      transporter.sendMail({
        from: global.config.Email.From || "Deadbolt@yoursite.com",
        to: emailinfo.To,
        subject: emailinfo.Init ? 'Account created for you' : 'Password reset',
        text: plaintext,
        html: html
      }, function(err, info){
        if(err){
          return callback(err);
        }
        return callback();
      });
    });
  }
}
