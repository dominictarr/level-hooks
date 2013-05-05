var ranges = require('string-range')
var locker = require('lock')

module.exports = function (db) {
  var lock = locker()
  if(db.hooks) {
    return     
  }

  var posthooks  = []
  var prehooks   = []
  var asynchooks = []

  function getPrefix (p) {
    return p && (
        'string' ===   typeof p        ? p
      : 'string' ===   typeof p.prefix ? p.prefix
      : 'function' === typeof p.prefix ? p.prefix()
      :                                  ''
      )
  }

  function remover (array, item) {
    return function () {
      var i = array.indexOf(item)
      if(!~i) return false        
      array.splice(i, 1)
      return true
    }
  }

  db.hooks = {
    post: function (prefix, hook) {
      if(!hook) hook = prefix, prefix = ''
      var h = {test: ranges.checker(prefix), hook: hook}
      posthooks.push(h)
      return remover(posthooks, h)
    },
    pre: function (prefix, hook) {
      if(!hook) hook = prefix, prefix = ''
      var h = {test: ranges.checker(prefix), hook: hook}
      prehooks.push(h)
      return remover(prehooks, h)
    },
    async: function (prefix, hook) {
      if(!hook) hook = prefix, prefix = ''
      var h = {test: ranges.checker(prefix), hook: hook, async: true}
      asynchooks.push(h)
      return remover(asynchooks, h)      
    },
    posthooks : posthooks,
    prehooks  : prehooks,
    asynchooks: asynchooks
  }

  //POST HOOKS

  function each (e) {
    if(e && e.type) {
      posthooks.forEach(function (h) {
        if(h.test(e.key)) h.hook(e)
      })
    }
  }

  db.on('put', function (key, val) {
    each({type: 'put', key: key, value: val})
  })
  db.on('del', function (key, val) {
    each({type: 'del', key: key, value: val})
  })
  db.on('batch', function onBatch (ary) {
    ary.forEach(each)
  })

  //PRE HOOKS

  var put = db.put
  var del = db.del
  var batch = db.batch

  function callHooks (isBatch, b, opts, cb) {
    if(!cb)
      cb = opts, opts = {}

    //ASYNC HOOKS
    var toHook = [], toLock = [], n = 0, locked = false

    //skip this if there are no async hooks.
    if(!asynchooks.length)
      return n=1, sync()

    b.forEach(function (e) {
      asynchooks.forEach(function (h) {
        if(h.test(String(e.key))) {
          locked = true
          // should I lock the whole batch?
          // or just the keys that have asynchooks?
          // just locking the hooked keys for now...
          toLock.push(e.key)
          toHook.push(function (cb) {
            h.hook(e, cb)
          })
          n++
        }
      })
    })

    if(toLock.length)
      lock(toLock, function (release) {
        //release the lock when the callback is called
        //after the batch is processed!
        cb = release(cb)
        toHook.forEach(function (f) { f(sync) })
      })
    else
      n=1, sync()

    //SYNC HOOKS

    function sync () {
      if(--n) return

      try {
      b.forEach(function hook(e, i) {
        prehooks.forEach(function (h) {
          if(h.test(String(e.key))) {
            //optimize this?
            //maybe faster to not create a new object each time?
            //have one object and expose scope to it?
            var context = {
              add: function (ch, db) {
                if(typeof ch === 'undefined') {
                  return this
                }
                if(ch === false)
                  return delete b[i]
                var prefix = (
                  getPrefix(ch.prefix) || 
                  getPrefix(db) || 
                  h.prefix || ''
                )
                ch.key = prefix + ch.key
                if(h.test(String(ch.key))) {
                  //this usually means a stack overflow.
                  throw new Error('prehook cannot insert into own range')
                }
                b.push(ch)
                hook(ch, b.length - 1)
                return this
              },
              put: function (ch, db) {
                if('object' === typeof ch) ch.type = 'put'
                return this.add(ch, db)
              },
              del: function (ch, db) {
                if('object' === typeof ch) ch.type = 'del'
                return this.add(ch, db)
              },
              veto: function () {
                return this.add(false)
              }
            }
            h.hook.call(context, e, context.add)
          }
        })
      })
      } catch (err) {
        return (cb || opts)(err)
      }
      b = b.filter(function (e) {
        return e && e.type //filter out empty items
      })

      if(b.length == 1 && !isBatch) {
        var change = b[0]
        return change.type == 'put' 
          ? put.call(db, change.key, change.value, opts, cb) 
          : del.call(db, change.key, opts, cb)  
      }
      return batch.call(db, b, opts, cb)
    }
  }

  db.put = function (key, value, opts, cb ) {
    var batch = [{key: key, value: value, type: 'put'}]
    return callHooks(false, batch, opts, cb)
  }

  db.del = function (key, opts, cb) {
    var batch = [{key: key, type: 'del'}]
    return callHooks(false, batch, opts, cb)
  }

  db.batch = function (batch, opts, cb) {
    return callHooks(true, batch, opts, cb)
  }
}
