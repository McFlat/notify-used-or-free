#!/usr/bin/env node

var os = require('os');
var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var ns = require('nsutil');
var async = require('async');
var cmd = require('commander');
var winston = require('winston');
var hogan = require('hogan.js');
var nodemailer = require('nodemailer');

var packageJson = require('./package.json');

var logger, transporter;

var units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

function _collect(val, memo) {
  memo.push(val);
  return memo;
}

function _getDisks() {
  return _.filter(_.map(ns.diskPartitions(), function(partition) {
    if(partition.device.indexOf('/dev/') !== -1) {
      if(partition.mount_point !== path.sep) {  // path.sep is root / on linux, not sure this will behave the like on windows however
        return _.trimEnd(partition.mount_point)
      }
      return partition.mount_point;
    }
  }));
}

function _checkDiskExists(mount_point) {
  return _getDisks().indexOf(mount_point) !== -1;
}

function _getDiskInfo(disk){
  var info = ns.diskUsage(disk);
  if(info) {
    logger.debug('Getting disk size for', disk);

    return {
      freeByte: _sizeToBytes(_bytesToSize(info.free)) - (_sizeToBytes(_bytesToSize(info.free)) - info.free),
      usedByte: _sizeToBytes(_bytesToSize(info.used)) - (_sizeToBytes(_bytesToSize(info.used)) - info.used),
      freeSize: _bytesToSize(info.free),
      usedSize: _bytesToSize(info.used)
    };
  }
  return null;
}

function _bytesToSize(bytes) {
  var l = 0, n = parseFloat(bytes) || 0, m = false;
  while(n >= 1024){
    n = n/1024;
    l++;
  }

  return n.toFixed(2) + units[l];
}

function _sizeToBytes(size) {
  var powers =  _.map(units.slice(1), function (power, index) {
    var obj = {};
    obj[power[0]] = index + 1;
    return obj;
  });
  powers = _.merge.apply(_, _.flatten(powers));
  var regex = /(\d+(?:\.\d+)?)\s?(K|M|G|T|P|E|Z|Y)?B?/i;

  var res = regex.exec(size);
  return res[1] * Math.pow(1024, powers[res[2]]);
}

function _sendEmail(sendOptions, mailOptions, done) {
  if(sendOptions.auth.user && sendOptions.auth.pass &&
      ((sendOptions.host && sendOptions.port && sendOptions.service == 'host') || sendOptions.service != 'host')) {
    transporter = nodemailer.createTransport(sendOptions);

    transporter.verify(function(error, success) {
      if (error) {
        logger.error(error);
        return error;
      } else {
        logger.debug('Mail options:', mailOptions);
        transporter.sendMail(mailOptions, function(error, info) {
          if (error) {
            logger.error(error);
            done(error, {error: true});
          }
          logger.debug(info);
          var result = _.merge({
            subject: mailOptions.subject, text: mailOptions.text
          }, _.omit(info, ['response', 'accepted', 'rejected', 'messageId']));
          logger.info(info.response +' ' + JSON.stringify(result));
          done(null, _.merge({error: false}, result));
        });

      }
    });
  // } else {
  //   logger.error('Unable to send email. Missing params: -u, --user and -p --pass and (-S --service or -H, --host and -P, --port)')
  }
}

function _renderTemplate(data, template, options) {
  logger.debug('Compiling template data');
  var temp = hogan.compile(template || '{{name}} detected {{disk}} has {{out}} {{detect}} on {{hostname}}, which is {{modifier}} than {{in}}', options),
    output = temp.render(data),
    outputHtml = output.replace('\n', '<br />');
  return {text: output, html: outputHtml};
}

function _getSendMailOptions(cmd, template) {
  var sendOptions = {secure: cmd.secure || false, debug: cmd.debug || false, auth: {}};
  if(cmd.secure) {
    logger.debug('Secure email enabled');
    sendOptions.tls = {
      // do not fail on invalid certs
      rejectUnauthorized: false
    };
  }
  if(cmd.service != 'host') {
    logger.debug('Using service:', cmd.service);
    sendOptions.service = cmd.service;
  } else if(cmd.host && cmd.port) {
    logger.debug('Using host:port', cmd.host, cmd.port);
    sendOptions.host = cmd.host;
    sendOptions.port = cmd.port;
  }
  sendOptions.auth.user = cmd.user;
  sendOptions.auth.pass = cmd.pass;

  var mailOptions = {
    from: '"'+cmd.senderName+'" <'+cmd.senderEmail+'>', // sender address
    to: cmd.recipients, // list of receivers
    subject: cmd.subject, // Subject line
    text: template.text.toString(), // plain text body
    html: template.html.toString() // html body
  };
  return {send: sendOptions, mail: mailOptions};
}

function _sendMessage(cmd, data, done) {
  if(cmd.accountSid && cmd.authToken && cmd.senderPhone && cmd.phones) {
    logger.debug('Param phones:', cmd.phones.join(','));
    logger.debug('Param sender-phone:', cmd.senderPhone);

    var accountSid = cmd.accountSid; // Your Account SID from www.twilio.com/console
    var authToken = cmd.authToken;   // Your Auth Token from www.twilio.com/console

    var twilio = require('twilio');
    var client = new twilio(accountSid, authToken);
    var results = [], errors = [];
    _.each(cmd.phones, function(phone) {
      client.messages.create({
        body: data,
        to: phone,  // Text this number
        from: cmd.senderPhone // From a valid Twilio number
      }).then(function(message) { logger.info(message.sid); results.push(message.sid);})
        .catch(function(err){ logger.error(err); errors.push(err)});
    });
    done(errors.length == 0 ? null : errors, results);
  // } else {
  //   logger.error('Unable to send SMS. Missing params: -A, --account-sid and -T, --auth-token and -o, --sender-phone and -O, --phones')
  }
}

function _prepareData(cmd, disk) {
  if(disk && disk !== path.sep) {
    disk = _.trimEnd(path.normalize(disk), path.sep);
    if(!_checkDiskExists(disk)) {
      var message = disk + ' disk does not exist';
      logger.error(message);
      return {disk: disk, error: {message: message}};
    }
  }

  var data = _getDiskInfo(disk);

  data.amountOut = parseFloat(data[cmd.detect + 'Size']);
  data.unitOut = data[cmd.detect + 'Size'].replace(data.amountOut, '').replace('0', '').trim().toUpperCase();
  if(cmd.round){
    data.out = Math.round(data.amountOut) + data.unitOut;
  }else{
    data.out = data.amountOut + data.unitOut;
  }

  data.amountIn = parseFloat(cmd.amount) || -1;
  data.unitIn = cmd.amount.replace(data.amountIn, '').replace('0', '').trim().toUpperCase();
  data.in = data.amountIn + data.unitIn;
  data.inByte = _sizeToBytes(data.in);

  data.hostname = os.hostname();

  try{
    data.name = cmd.name();
  }catch(e) {
    data.name = 'notify-used-or-free';
  }

  data.disk = disk;
  data.detect = cmd.detect;
  data.modifier = cmd.modifier;

  if(isNaN(data.inByte)) {
    return _.merge(data, {error: 'Invalid value: -a, --amount <value>'});
  }

  return data;
}

function _setupLogger(cmd) {
  var loggerSettings = {};
  if(!cmd.quite || cmd.debug){

    loggerSettings = {
      transports: [
        new (winston.transports.Console)({
          colorize: true,
          json: typeof cmd.json !== 'undefined' && cmd.json
        })
      ],
      exitOnError: false
    };
  }
  if (cmd.log) {
    var logFilePath = path.join(cmd.log, '.notify-used-or-free.log');
    loggerSettings.transports.push(new winston.transports.File({
      filename: logFilePath,
      timestamp: true,
      maxsize: 5242880, //5MB
      maxFiles: 5,
      json: typeof cmd.json !== 'undefined' && cmd.json
    }));
  }

  logger = new (winston.Logger)(loggerSettings);
  logger.level = cmd.debug ? 'debug' : logger.level;
  return logger
}
var defaults = {
  recipients: [],
  json: false,
  debug: false,
  detect: 'free',
  modifier: 'less',
  amount: '10GB',
  service: 'host'

};
function start(cmd, disk, callback) {
  cmd = _.merge(defaults, cmd);
  disk = disk || path.sep;

  logger = _setupLogger(cmd);

  logger.debug('Checking if', disk, 'has', cmd.modifier, 'than', cmd.amount, cmd.detect);

  if(!cmd.subject) {
    if(cmd.modifier == 'less' && cmd.detect == 'free') {
      cmd.subject = 'LOW DISK SPACE';
    } else if(cmd.modifier == 'more' && cmd.detect == 'used') {
      cmd.subject = 'HIGH DISK SPACE';
    } else {
      cmd.subject = 'DISK SPACE - ' + cmd.modifier.toUpperCase() + ' ' + cmd.detect.toUpperCase()
    }
  }
  logger.debug('Param subject:', cmd.subject);

  var data = _prepareData(cmd, disk);

  data.notify = false;
  if(cmd.modifier == 'less') {
    data.notify = data[cmd.detect + 'Byte'] <= data.inByte;
  } else {
    data.notify = data[cmd.detect + 'Byte'] >= data.inByte;
  }
  data.sending_email = true;
  if(cmd.recipients.length == 0) {
    logger.debug('Missing param: -R, --recipients <email@receiver>');
    data.sending_email = false;
  }
  if(cmd.service == 'host' && (!cmd.host || !cmd.port)) {
    logger.debug('Missing param: -H, --host <server> and -P, --port <number>');
    data.sending_email = false;
  }
  if(!cmd.user || !cmd.pass) {
    logger.debug('Missing param: -u, --user <account> and -p, --pass <word>');
    data.sending_email = false;
  }
  if(!data.sending_email) logger.warn('No params given for sending email.');

  data.sending_sms = true;
  if(!cmd.phones || cmd.phones.length == 0) {
    logger.debug('Missing param: -O, --phones <+12345551234>');
    data.sending_sms = false;
  }
  if(!cmd.accountSid || !cmd.authToken || ! cmd.senderPhone) {
    logger.debug('Missing param: -A, --accountSid <id> and -T, --auth-token <token> and -o, --sender-phone <international-number>');
    data.sending_sms = false;
  }
  if(!data.sending_sms) logger.warn('No params given for sending SMS text message.');

  if (data.notify){
    data.template = _renderTemplate(data);
    logger.info(data.template.text);

    async.parallel([
      function (cb) {
        if(data.sending_email){
          var options = _getSendMailOptions(cmd, data.template);
          _sendEmail(options.send, options.mail, function (err, result) {
            cb(err, result);
          });
        // } else {
        //   logger.warn('Not sending email')
        }
      },
      function (cb) {
        if(data.sending_sms){
          _sendMessage(cmd, data.template.text, function (err, result) {
            cb(err, result);
          });
        // } else {
        //   logger.warn('Not sending SMS')
        }
      },
      function(cb) {
        cb(null, data);
      }
    ], callback);

  } else {
    logger.debug('Looks Good: ' + data.out + ' ' + data.detect);
    // return data;
  }
  if(typeof callback === 'function') callback(null, data);
  return data;
}
function _output(cmd, results) {
  var output = '';
  if(!cmd.json) {
    output = _.join(_.filter(_.map(results, function (item, key) {
      if(typeof item != 'object') return key + ': '+ item;
    })), '\n')
  } else {
    output = JSON.stringify(results, null, 2);
  }
  if(cmd.info) {
    process.stdout.write(output + '\n')
  } else {
    if(cmd.json) process.stdout.write(output + '\n');
    else process.stdout.write(results.template && results.template.text + '\n' || '');
  }
  return results;
}
function run(args) {
  cmd
    .version(packageJson.version)
    .usage('<disk> <options>\n\nnotify-used-or-free / -a 5GB -R user@email.example -u username -p password -S sendgrid')
    .arguments('<disk>')
    .option('-i, --info', 'print data info')
    .option('-r, --round', 'return integer instead of floating point number eg. 1GB not 1.23GB')
    .option('-d, --detect [<used>|<free>]', 'used or free space, free by default', /^(used|free)$/i, defaults.detect)
    .option('-m, --modifier [<less>|<more>]', 'less or more than detected amount, less by default', /^(less|more)$/i, defaults.modifier)
    .option('-a, --amount <'+defaults.amount+'>', 'amount of space used or free on disk, eg. 1024MB, 1TB; 5GB by default', defaults.amount)
    .option('-t, --template <{{name}} detected {{disk}} has {{out}} {{detect}} on {{hostname}}, which is {{modifier}} than {{in}}>')
    .option('-s, --subject <[LOW|HIGH] DISK SPACE>', 'send email with this subject title')
    .option('-R, --recipients [email@exam.ple, send@here.too]', 'email addresses to send message to', _collect, [])
    .option('-e, --sender-email <sender@exam.ple>', 'sender email address', 'noreply@notify.used.or.free')
    .option('-n, --sender-name <NotifyUsedOrFree>', 'sender name', 'NotifyUsedOrFree')
    .option('-S, --service <Mailgun|Mailjet|Postmark|SendGrid|SES|SES-US-EAST-1|SES-US-WEST-2|SES-EU-WEST-1|Sparkpost>', 'service to use, instead of using host:port', /^(Mailgun|Mailjet|Postmark|SendGrid|SES|SES-US-EAST-1|SES-US-WEST-2|SES-EU-WEST-1|Sparkpost)$/i, 'host')
    .option('-H, --host <host.server>', 'host of mail server, or provide service instead')
    .option('-P, --port <587>', 'port of mail server, or provide service instead')
    .option('-c, --secure', 'secure connection to send email, true by default')
    .option('-u, --user <name>', 'username on mail server')
    .option('-p, --pass <word>', 'password on mail server for username')
    .option('-L, --log <logDir>', 'save to logfile in <logDir>/.notify-used-or-free.log')
    .option('-X, --debug', 'show debug messages, false by default')
    .option('-j, --json', 'json log output, false by default')
    .option('-q, --quite', 'suppress logger output, false by default')
    .option('-A, --account-sid <ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX>', 'valid Twilio account sid')
    .option('-T, --auth-token <your_auth_token>', 'valid Twilio auth token')
    .option('-O, --phones [+13105551234, +12065551234]', 'phone numbers to send message to', _collect, [])
    .option('-o, --sender-phone <+13105551234>', 'valid Twilio phone number')
    .action(function(disk) {
      start(cmd, disk, function(err, results) {
        if(err) {
          process.stderr.write(err.message+'\n');
          return _.merge(results, {error: {message: err.message}});
        } else {
          return _output(cmd, results)
        }
      })
    })
    .parse(args);
  if(cmd.args.length < 1) {
    cmd.outputHelp();
    process.exit(1);
  }
}

if(process.argv.length > 1 && (process.argv[2] != 'test.js')) {
  run(process.argv);
}

module.exports = {
  package: {json: packageJson},

  units: units,
  defaults: defaults,

  _sizeToBytes: _sizeToBytes,
  _bytesToSize: _bytesToSize,

  _getDisks: _getDisks,
  _checkDiskExists: _checkDiskExists,
  _getDiskInfo: _getDiskInfo,
  _prepareData: _prepareData,

  _setupLogger: _setupLogger,

  _renderTemplate: _renderTemplate,

  _getSendMailOptions: _getSendMailOptions,
  _sendEmail: _sendEmail,
  _sendMessage: _sendMessage,

  start: start
};
