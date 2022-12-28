var it = require('it'),
  assert = require('assert'),
  _ = require('lodash');

var index = require('./index'),
  packageJson = index.package.json,

  _defaults = index.defaults,
  _units = index.units,

  sizeToBytes = index._sizeToBytes,
  bytesToSize = index._bytesToSize,

  getDisks = index._getDisks,
  checkDiskExists = index._checkDiskExists,
  getDiskInfo = index._getDiskInfo,
  prepareData = index._prepareData,

  setupLogger = index._setupLogger,

  renderTemplate = index._renderTemplate,

  getSendMailOptions = index._getSendMailOptions,
  sendEmail = index._sendEmail,
  sendMessage = index._sendMessage,

  start = index.start,

  defaults = {
    recipients: [],
    json: false,
    debug: false,
    detect: 'free',
    modifier: 'less',
    amount: '10GB',
    service: 'host'
  };

it.describe('package.json', function(it) {
  it.should('have valid package.json', function () {
    assert.deepEqual({
      name: packageJson.name,
      version: packageJson.version,
      main: packageJson.main,
      bin: packageJson.bin,
      scripts: packageJson.scripts,
      repository: packageJson.repository,
      keywords: packageJson.keywords,
      author: packageJson.author,
      license: packageJson.license,
      bugs: packageJson.bugs,
      homepage: packageJson.homepage,
      dependencies: packageJson.dependencies,
      devDependencies: packageJson.devDependencies
    }, {
      name: 'notify-used-or-free',
      version: "0.0.4",
      main: 'index.js',
      bin: {
        'notify-used-or-free': './index.js'
      },
      scripts: {
        test: "./test.sh"
      },
      repository: {
        type: "git",
        url: "git@github.com:FlatEarthTruth/notify-used-or-free.git"
      },
      keywords: [
        "server",
        "disk",
        "usage",
        "notification",
        "by",
        "email",
        "sms"
      ],
      author: 'Alex Goretoy <alex@goretoy.com>',
      license: 'MIT',
      bugs: {
        url: "https://github.com/FlatEarthTruth/notify-used-or-free/issues"
      },
      homepage: "https://github.com/FlatEarthTruth/notify-used-or-free",
      dependencies: {
        "async": "^2.5.0",
        "commander": "^2.11.0",
        "hogan.js": "^3.0.2",
        "lodash": "^4.17.4",
        "nodemailer": "^2.7.2",
        "nsutil": "^0.1.4",
        "twilio": "^3.8.1",
        "winston": "^2.4.0"
      },
      devDependencies: {
        "assert": "^1.4.1",
        "it": "^1.1.1"
      }
    });
  })
});

it.describe('::defaults', function(it) {
  it.should('have defaults set', function () {
    assert.deepEqual(_defaults, defaults);
  })
});
it.describe('::units', function(it) {
  it.should('have units', function () {
    assert.deepEqual(_units, ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']);
  })
});

function checkDataType(i) {
  assert.equal(typeof i.freeByte, 'number');
  assert.equal(typeof i.usedByte, 'number');
  assert.equal(typeof i.freeSize, 'string');
  assert.equal(typeof i.usedSize, 'string');
  assert.equal(typeof i.amountOut, 'number');
  assert.equal(typeof i.unitOut, 'string');
  assert.equal(typeof i.out, 'string');
  assert.equal(typeof i.amountIn, 'number');
  assert.equal(typeof i.unitIn, 'string');
  assert.equal(typeof i.in, 'string');
  assert.equal(typeof i.inByte, 'number');
  assert.equal(typeof i.hostname, 'string');
  assert.equal(typeof i.name, 'string');
  assert.equal(i.name, packageJson.name);
  assert.equal(typeof i.disk, 'string');
  assert.equal(typeof i.detect, 'string');
  assert.equal(typeof i.modifier, 'string');
}
function checkAdditionalDataType(i) {
  assert.equal(typeof i.notify, 'boolean');
  assert.equal(typeof i.sending_email, 'boolean');
  assert.equal(typeof i.sending_sms, 'boolean');
}

function checkDefaultDataValues(i, except) {
  _.map(i, function (val, key) {
    if(_defaults[key]) {
      if(except && except.length > 0) {
        if(_.indexOf(except, key) == -1) {
          assert.equal(_defaults[key], val);
        }
      } else {
        assert.equal(_defaults[key], val);
      }
    } else {
      if(key === 'in') {
        assert.equal(_defaults['amount'], val);
      }
      if(key === 'unitIn'){
        assert.equal(/KB|MB|GB|TB|PB|EB|ZB|YB/.test(val), true)
      }
      if(key === 'amountIn') {
        assert.equal(parseFloat(i['in'].replace(/KB|MB|GB|TB|PB|EB|ZB|YB/, '')), val)
      }
    }

  });
}
it.describe('::start(cmd, disk, callback)', function (it) {
  it.should('fail when /invalid disk', function () {
    assert.deepEqual(start({}, '/invalid'), {
      disk: '/invalid',
      error: {message: '/invalid disk does not exist'},
      notify: false,
      sending_email: false,
      sending_sms: false
    });
  });
  it.should('use default values when no params given', function () {
    var i = start({}, '/');
    console.log(i);
    checkDataType(i);
    checkAdditionalDataType(i);
    checkDefaultDataValues(i);
    assert.equal(i.sending_email, false); // shouldn't send email because no email settings given
    assert.equal(i.sending_sms, false);  // shouldn't send sms because no sms settings given
  });
  it.should('invoke callback with results', function () {
    var i = start({}, '/', function(err, results) {
      assert.equal(err, null);
      checkDataType(results);
      checkAdditionalDataType(results);
      checkDefaultDataValues(results);
      assert.equal(results.sending_email, false); // shouldn't send email because no email settings given
      assert.equal(results.sending_sms, false);  // shouldn't send sms because no sms settings given
    });
    checkDataType(i);
    checkAdditionalDataType(i);
    checkDefaultDataValues(i);
    assert.equal(i.sending_email, false); // shouldn't send email because no email settings given
    assert.equal(i.sending_sms, false);  // shouldn't send sms because no sms settings given
  });
  it.should('use amount param to set the amount to 100TB free, should notify', function () {
    var i = start({amount: '100TB'}, '/');
    checkDataType(i);
    checkAdditionalDataType(i);
    checkDefaultDataValues(i);
    assert.equal(i.notify, true); // there's no way you have 100TB free; and it should notify you
    assert.equal(i.sending_email, false); // shouldn't send email because no email settings given
    assert.equal(i.sending_sms, false);  // shouldn't send sms because no sms settings given
    assert.equal(typeof i.template, 'object');
    assert.equal(typeof i.template.text, 'string');
    assert.equal(typeof i.template.html, 'string');
    assert.equal(i.template.text.indexOf('100TB') > -1, true);
    assert.equal(i.template.html.indexOf('100TB') > -1, true);
  })
});

it.describe('::_getDisks()', function (it) {
  it.should('return array list of mounted disks', function () {
    var disks = getDisks();
    assert.equal(disks.length > 0, true);
    assert.equal(_.indexOf(disks, '/') > -1, true);
  });
});

it.describe('::_checkDiskExists(mount_point)', function (it) {
  it.should('return true when giving / disk', function () {
    assert.equal(checkDiskExists('/'), true);
  });
  it.should('return false when giving /invalid disk', function () {
    assert.equal(checkDiskExists('/invalid'), false);
  });
});
it.describe('::_getDiskInfo(disk)', function (it) {
  it.should('return object with freeByte, usedByte, freeSize and usedSize values', function () {
    var info = getDiskInfo('/');
    assert.equal(typeof info, 'object');
    assert.equal(typeof info.freeByte, 'number');
    assert.equal(typeof info.usedByte, 'number');
    assert.equal(typeof info.freeSize, 'string');
    assert.equal(typeof info.usedSize, 'string');
  });
});

it.describe('::_prepareData(cmd, disk)', function (it) {
  it.should('_getDiskInfo for / disk, process the values and return valid object', function () {
    var i = prepareData({detect: 'free', amount: '10TB', modifier: 'less'}, '/');
    checkDataType(i);
  });
  it.should('_getDiskInfo and return error object', function () {
    var i = prepareData({detect: 'free', amount: '10TB', modifier: 'less'}, '/invalid');
    assert.deepEqual(i, {disk: '/invalid', error: {message: '/invalid disk does not exist'}});
  });
});

it.describe('::_renderTemplate(data, template, options)', function (it) {
  it.should('render default template', function () {
    assert.deepEqual(renderTemplate({
      name:'name',
      disk: 'disk',
      out: 'out',
      detect: 'detect',
      hostname: 'hostname',
      modifier: 'modifier',
      in: 'in'
    }), {
      text: 'name detected disk has out detect on hostname, which is modifier than in',
      html: 'name detected disk has out detect on hostname, which is modifier than in'
    })
  });
});

it.describe('::_bytesToSize(bytes)', function(it) {
  it.should('1024 bytes equal 1.00KB KiloBytes', function () {
    assert.equal(bytesToSize(1024), '1.00KB');
  });
  it.should('10240 bytes equal 10.00KB', function () {
    assert.equal(bytesToSize(10240), '10.00KB');
  });
  it.should('102400 bytes equal 100.00KB', function () {
    assert.equal(bytesToSize(102400), '100.00KB');
  });
  it.should('1024000 bytes equal 1000.00KB', function () {
    assert.equal(bytesToSize(1024000), '1000.00KB');
  });
  it.should('10240000 bytes equal 9.77MB MegaBytes', function () {
    assert.equal(bytesToSize(10240000), '9.77MB');
  });
  it.should('102400000 bytes equal 97.66MB', function () {
    assert.equal(bytesToSize(102400000), '97.66MB');
  });
  it.should('1024000000 bytes equal 976.56MB', function () {
    assert.equal(bytesToSize(1024000000), '976.56MB');
  });
  it.should('10240000000 bytes equal 9.54GB GigaBytes', function () {
    assert.equal(bytesToSize(10240000000), '9.54GB');
  });
  it.should('102400000000 bytes equal 95.37GB', function () {
    assert.equal(bytesToSize(102400000000), '95.37GB');
  });
  it.should('1024000000000 bytes equal 953.67GB', function () {
    assert.equal(bytesToSize(1024000000000), '953.67GB');
  });
  it.should('10240000000000 bytes equal 9.31TB TeraBytes', function () {
    assert.equal(bytesToSize(10240000000000), '9.31TB');
  });
  it.should('102400000000000 bytes equal 93.13TB', function () {
    assert.equal(bytesToSize(102400000000000), '93.13TB');
  });
  it.should('1024000000000000 bytes equal 931.32TB', function () {
    assert.equal(bytesToSize(1024000000000000), '931.32TB');
  });
  it.should('10240000000000000 bytes equal 9.09PB PetaBytes', function () {
    assert.equal(bytesToSize(10240000000000000), '9.09PB');
  });
  it.should('102400000000000000 bytes equal 90.95PB', function () {
    assert.equal(bytesToSize(102400000000000000), '90.95PB');
  });
  it.should('1024000000000000000 bytes equal 909.49PB', function () {
    assert.equal(bytesToSize(1024000000000000000), '909.49PB');
  });
  it.should('10240000000000000000 bytes equal 8.88EB ExaBytes', function () {
    assert.equal(bytesToSize(10240000000000000000), '8.88EB');
  });
  it.should('102400000000000000000 bytes equal 88.82EB', function () {
    assert.equal(bytesToSize(102400000000000000000), '88.82EB');
  });
  it.should('1024000000000000000000 bytes equal 888.18EB', function () {
    assert.equal(bytesToSize(1024000000000000000000), '888.18EB');
  });
  it.should('10240000000000000000000 bytes equal 8.67ZB ZettaBytes', function () {
    assert.equal(bytesToSize(10240000000000000000000), '8.67ZB');
  });
  it.should('102400000000000000000000 bytes equal 86.74ZB', function () {
    assert.equal(bytesToSize(102400000000000000000000), '86.74ZB');
  });
  it.should('1024000000000000000000000 bytes equal 867.36ZB', function () {
    assert.equal(bytesToSize(1024000000000000000000000), '867.36ZB');
  });
  it.should('10240000000000000000000000 bytes equal 8.47YB YottaBytes', function () {
    assert.equal(bytesToSize(10240000000000000000000000), '8.47YB');
  });
  it.should('102400000000000000000000000 bytes equal 84.70YB', function () {
    assert.equal(bytesToSize(102400000000000000000000000), '84.70YB');
  });
  it.should('1024000000000000000000000000 bytes equal 847.03YB', function () {
    assert.equal(bytesToSize(1024000000000000000000000000), '847.03YB');
  });
});

it.describe('::_sizeToBytes(size)', function(it) {
  it.should('1024 bytes', function () {
    var val = 1024;
    assert.equal(sizeToBytes(bytesToSize(val)) - (sizeToBytes(bytesToSize(val)) - val), val)
  });
  it.should('10240 bytes', function () {
    var val = 10240;
    assert.equal(sizeToBytes(bytesToSize(val)) - (sizeToBytes(bytesToSize(val)) - val), val)
  });
  it.should('102400 bytes', function () {
    var val = 102400;
    assert.equal(sizeToBytes(bytesToSize(val)) - (sizeToBytes(bytesToSize(val)) - val), val)
  });
  it.should('1024000 bytes', function () {
    var val = 1024000;
    assert.equal(sizeToBytes(bytesToSize(val)) - (sizeToBytes(bytesToSize(val)) - val), val)
  });
  it.should('10240000 bytes', function () {
    var val = 10240000;
    assert.equal(sizeToBytes(bytesToSize(val)) - (sizeToBytes(bytesToSize(val)) - val), val)
  });
  it.should('102400000 bytes', function () {
    var val = 102400000;
    assert.equal(sizeToBytes(bytesToSize(val)) - (sizeToBytes(bytesToSize(val)) - val), val)
  });
  it.should('1024000000 bytes', function () {
    var val = 1024000000;
    assert.equal(sizeToBytes(bytesToSize(val)) - (sizeToBytes(bytesToSize(val)) - val), val)
  });
  it.should('10240000000 bytes', function () {
    var val = 10240000000;
    assert.equal(sizeToBytes(bytesToSize(val)) - (sizeToBytes(bytesToSize(val)) - val), val)
  });
  it.should('102400000000 bytes', function () {
    var val = 102400000000;
    assert.equal(sizeToBytes(bytesToSize(val)) - (sizeToBytes(bytesToSize(val)) - val), val)
  });
  it.should('1024000000000 bytes', function () {
    var val = 1024000000000;
    assert.equal(sizeToBytes(bytesToSize(val)) - (sizeToBytes(bytesToSize(val)) - val), val)
  });
  it.should('10240000000000 bytes', function () {
    var val = 10240000000000;
    assert.equal(sizeToBytes(bytesToSize(val)) - (sizeToBytes(bytesToSize(val)) - val), val)
  });
  it.should('102400000000000 bytes', function () {
    var val = 102400000000000;
    assert.equal(sizeToBytes(bytesToSize(val)) - (sizeToBytes(bytesToSize(val)) - val), val)
  });
  it.should('1024000000000000 bytes', function () {
    var val = 1024000000000000;
    assert.equal(sizeToBytes(bytesToSize(val)) - (sizeToBytes(bytesToSize(val)) - val), val)
  });
  it.should('10240000000000000 bytes', function () {
    var val = 10240000000000000;
    assert.equal(sizeToBytes(bytesToSize(val)) - (sizeToBytes(bytesToSize(val)) - val), val)
  });
  it.should('102400000000000000 bytes', function () {
    var val = 102400000000000000;
    assert.equal(sizeToBytes(bytesToSize(val)) - (sizeToBytes(bytesToSize(val)) - val), val)
  });
  it.should('1024000000000000000 bytes', function () {
    var val = 1024000000000000000;
    assert.equal(sizeToBytes(bytesToSize(val)) - (sizeToBytes(bytesToSize(val)) - val), val)
  });
  it.should('10240000000000000000 bytes', function () {
    var val = 10240000000000000000;
    assert.equal(sizeToBytes(bytesToSize(val)) - (sizeToBytes(bytesToSize(val)) - val), val)
  });
  it.should('102400000000000000000 bytes', function () {
    var val = 102400000000000000000;
    assert.equal(sizeToBytes(bytesToSize(val)) - (sizeToBytes(bytesToSize(val)) - val), val)
  });
  it.should('1024000000000000000000 bytes', function () {
    var val = 1024000000000000000000;
    assert.equal(sizeToBytes(bytesToSize(val)) - (sizeToBytes(bytesToSize(val)) - val), val)
  });
  it.should('10240000000000000000000 bytes', function () {
    var val = 10240000000000000000000;
    assert.equal(sizeToBytes(bytesToSize(val)) - (sizeToBytes(bytesToSize(val)) - val), val)
  });
  it.should('102400000000000000000000 bytes', function () {
    var val = 102400000000000000000000;
    assert.equal(sizeToBytes(bytesToSize(val)) - (sizeToBytes(bytesToSize(val)) - val), val)
  });
  it.should('1024000000000000000000000 bytes', function () {
    var val = 1024000000000000000000000;
    assert.equal(sizeToBytes(bytesToSize(val)) - (sizeToBytes(bytesToSize(val)) - val), val)
  });
  it.should('10240000000000000000000000 bytes', function () {
    var val = 10240000000000000000000000;
    assert.equal(sizeToBytes(bytesToSize(val)) - (sizeToBytes(bytesToSize(val)) - val), val)
  });
  it.should('102400000000000000000000000 bytes', function () {
    var val = 102400000000000000000000000;
    assert.equal(sizeToBytes(bytesToSize(val)) - (sizeToBytes(bytesToSize(val)) - val), val)
  });
  it.should('1024000000000000000000000000 bytes', function () {
    var val = 1024000000000000000000000000;
    assert.equal(sizeToBytes(bytesToSize(val)) - (sizeToBytes(bytesToSize(val)) - val), val)
  });
});
