

//this will be used by queue.

module.exports = function (db) {
  if(db) return hooks(db)

  function hooks (db) {

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

    db.hooks = {
      post: function (hook) {
        db.on('hooks:post', hook)
        return db
      },
      pre: function (prefix, hook) {
        if(!hook) hook = prefix, prefix = ''
        prehooks.push({prefix: getPrefix(prefix), hook: hook})
        return db
      },
      posthooks: posthooks,
      prehooks: prehooks
    }

    //POST HOOKS

    function each (e) {
      if(e && e.type)
        db.emit('hooks:post', e)
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

      b.forEach(function hook(e, i) {
        prehooks.forEach(function (h) {
          if(e.key.indexOf(h.prefix) == 0)
            h.hook(e, function (ch, db) {
              if(ch === false)
                return delete b[i]
              var prefix = getPrefix(db) || h.prefix || ''
              ch.key = prefix + ch.key
              console.log('batch - add', ch)
              b.push(ch)
              hook(ch, b.length - 1)            
            })
        })
      })

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

  return hooks
}
