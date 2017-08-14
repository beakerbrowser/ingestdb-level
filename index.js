var extend = require('xtend');
var Readable = require('stream').Readable

module.exports = Secondary;

function Secondary(db, name, reduce) {
  var sub = db.sublevel(name);

  if (!reduce) {
    reduce = function(value) {
      return value[name];
    };
  }

  var secondary = {};
  
  secondary.updateIndex = indexUpdater('update')
  secondary.removeIndex = indexUpdater('remove')

  function indexUpdater (op) {
    return (key, record, cb) => {
      var subKey = reduce(record)
      sub.get(subKey, (err, value) => {
        value = value || []
        if (op === 'update') {
          if (value.indexOf(key) === -1) {
            value.push(key)
          }
        } else {
          let i = value.indexOf(key)
          if (i !== -1) {
            value.splice(i, 1)
          }          
        }
        sub.put(subKey, value, cb)
      })
    }
  }

  secondary.get = op('get');
  secondary.del = op('del');

  function op(type) {
    return function (key, opts, fn) {
      if (typeof opts == 'function') {
        fn = opts;
        opts = {};
      }

      sub.get(key, function(err, value) {
        if (err) return fn(err);
        db[type](value[0], opts, fn);
      });
    };
  }

  secondary.createValueStream = function(opts) {
    (opts && opts || (opts = {})).keys = false;
    return secondary.createReadStream(opts);
  }

  secondary.createKeyStream = function(opts) {
    (opts && opts || (opts = {})).values = false;
    return secondary.createReadStream(opts);
  }

  secondary.createReadStream = function(opts = {}) {
    // start read stream
    var opts2 = extend({}, opts);
    opts2.keys = opts2.values = true;
    var rs = sub.createReadStream(opts2)

    // start our output stream
    var outs = new Readable({ objectMode: true, read() {} });

    // handle new datas
    rs.on('data', ({key, value}) => {
      value.forEach(key => {
        if (opts.values === false) {
          return outs.push(key)
        }

        db.get(key, (err, value) => {
          if (err && err.notFound) {
            sub.del(key)
          } else if (err) {
            outs.destroy(err)
          } else {
            emit()
          }

          function emit() {
            if (opts.keys === false) {
              outs.push(value)
            } else {
              outs.push({key, value})
            }
          }
        })
      })
    })
    rs.on('error', err => outs.destroy(err))
    rs.on('end', () => {
      outs.push(null)
    })

    return outs
  }

  return secondary;
}
