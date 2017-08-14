const extend = require('xtend');
const levelPromisify = require('level-promise')
const Readable = require('stream').Readable

module.exports = (db, indexSpecs) => {
  // modernize the api
  levelPromisify(db)

  // add indexes
  var indexes = {}
  indexSpecs.forEach(spec => {
    const name = normalizeIndexName(spec)
    indexes[name] = createIndex(db, db.sublevel(name), spec)
  })

  async function addIndexes (key, value) {
    await Promise.all(Object.keys(indexes).map(i => indexes[i].addIndex(key, value)))
  }

  async function removeIndexes (key, value) {
    await Promise.all(Object.keys(indexes).map(i => indexes[i].removeIndex(key, value)))
  }

  // return wrapped API
  return {
    indexes,

    get: db.get.bind(db),
    createReadStream: db.createReadStream.bind(db),
    createKeyStream: db.createKeyStream.bind(db),
    createValueStream: db.createValueStream.bind(db),

    async put (key, value, opts) {
      try {
        var oldValue = await this.get(key)
        await removeIndexes(key, oldValue)
      } catch (e) {}
      await db.put(key, value, opts)
      await addIndexes(key, value)
    },

    async del (key, opts) {
      try {
        var oldValue = await this.get(key)
        await removeIndexes(key, oldValue)
      } catch (e) {}
      await db.del(key, opts)
    }
  }
}

function createIndex (db, sublevel, spec) {
  const isMultiEntry = spec.startsWith('*')
  const keyPath = normalizeIndexName(spec).split('+')

  var index = {
    addIndex: indexUpdater('add'),
    removeIndex: indexUpdater('remove'),

    async get (key, opts) {
      var recordKey = await sublevel.get(toKey(key))
      return db.get(recordKey[0], opts)
    },

    createValueStream (opts = {}) {
      opts.keys = false
      return this.createReadStream(opts)
    },

    createKeyStream (opts = {}) {
      opts.values = false
      return this.createReadStream(opts)
    },

    createReadStream (opts = {}) {
      // start read stream
      var opts2  = extend({}, opts)
      opts2.keys = opts2.values = true
      opts2.lt   = toKey(opts2.lt)
      opts2.lte  = toKey(opts2.lte)
      opts2.gt   = toKey(opts2.gt)
      opts2.gte  = toKey(opts2.gte)
      var rs = sublevel.createReadStream(opts2)

      // start our output stream
      var outs = new Readable({ objectMode: true, read() {} });

      // handle new datas
      var inFlight = 0
      rs.on('data', ({key, value}) => {
        value.forEach(async recordKey => {
          if (opts.values === false) {
            return outs.push(recordKey)
          }

          try {
            inFlight++
            let value = await db.get(recordKey)
            inFlight--
            if (opts.keys === false) {
              outs.push(value)
            } else {
              outs.push({key: recordKey, value})
            }
          } catch (e) {
            if (err.notFound) {
              await sublevel.del(key)
            } else {
              outs.destroy(err)
            }
          }

          checkDone()
        })
      })
      rs.on('error', err => outs.destroy(err))
      rs.on('end', checkDone)

      function checkDone () {
        if (inFlight === 0) {
          outs.push(null)
        }
      }

      return outs
    }
  }

  function toKey (key) {
    if (typeof key === 'undefined') return undefined
    if (Array.isArray(key)) return key.join('!')
    return key
  }

  function createKeysFromRecord (record) {
    if (isMultiEntry) {
      var values = record[keyPath[0]]
      return Array.isArray(values) ? values : [values]
    } else {
      var path = keyPath.map(key => record[key])
      return [path.join('!')]
    }
  }

  function indexUpdater (op) {
    return (key, record, cb) => {
      return Promise.all(createKeysFromRecord(record).map(async indexKey => {
        // fetch the current index value
        try {
          var recordKeys = await sublevel.get(indexKey)
        } catch (e) {}
        recordKeys = recordKeys || []

        if (op === 'add') {
          // add the new record key
          if (recordKeys.indexOf(key) === -1) {
            recordKeys.push(key)
          }
        } else {
          // remove the old record key
          let i = recordKeys.indexOf(key)
          if (i !== -1) {
            recordKeys.splice(i, 1)
          }          
        }

        // write/del
        if (recordKeys.length > 0) {
          await sublevel.put(indexKey, recordKeys)
        } else {
          await sublevel.del(indexKey)
        }
      }))
    }
  }

  return index
}


function normalizeIndexName (index) {
  if (index.startsWith('*')) return index.slice(1)
  return index
}