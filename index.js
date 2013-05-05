var ranges = require('string-range')

function paraEach(ary, iter, cb) {
  var n = ary.length, ended

  try {
    for(var i in ary) {
      var item = ary[i]
      console.log('paraEach', item, i)
      iter(item, i, done)
    }
  } catch (err) {
    if(ended) return
    cb(ended = err)
  }

  function done(err, val) {
    console.log('-- done?', err, n)
    if(ended) return
    if(err)   return cb(ended = err)
    if(--n)   return

    ended = true
    cb()
  }
}


module.exports = function (db) {

  if(db.hooks) {
    return     
  }

  var posthooks = []
  var prehooks  = []

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
    posthooks: posthooks,
    prehooks: prehooks
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
    //iterate over the batch in parallel
    //WHERE TO PUT LOCKS?
    //THIS ATTEMPT IS FAIL BECAUSE IT
    //CAN'T DO LOCKS WELL.
    paraEach(b, function (e, i, done) {
      var n = 0, hooked = false
      ;(function hook (e, i) {
        //but do each hook in series...
        prehooks.forEach(function (h) {
          if(h.test(String(e.key))) {
            n ++; hooked = true

            var async = false, _async = false, once = false
            function add (ch, db) {
              if(once) throw new Error('*must not* call add more than once')
              once = true

              if(async != _async)
                throw new Error('must return false if async')

              if(typeof ch === 'undefined')
                return next()

              function addOne (ch) {
                if(ch === false)
                  return delete b[i]

                var prefix = (
                  getPrefix(ch.prefix) || 
                  getPrefix(db) || 
                  h.prefix || ''
                )

                ch.key = prefix + ch.key
                if(h.test(String(ch.key))) {
                  // This usually means a stack overflow.
                  // so lets just prevent it all-together
                  // if you want to alter the current item,
                  // just mutate it.
                  throw new Error('prehook cannot insert into own range')
                }

                b.push(ch)
                hook(ch, b.length - 1)
              }

              if(Array.isArray(ch)) ch.forEach(addOne)
              else                  addOne(ch)

              next()
            }

            async = h.hook.call(null, e, add)
            _async = true
            if(!async) next()
          }
        })
        console.log('DONE', i)
      })(e, i)
      if(!hooked) node()
      
      function next() {
        if(--n) return
        done()
      }

    }, function (err) {
      if(err)
        return (cb || opts)(err)

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
    })
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
