

//this will be used by queue.

module.exports = function () {

  return function (db) {

    if(db.hooks) {
      //if(listener) db.hooks.post(listener)
      return     
    }

    var posthooks = []
    var prehooks  = []

    db.hooks = {
      post: function (posthook) {
        db.on('hooks:post', posthook)
        return db
      },
      pre: function (hook) {
        prehooks.push(hook)
        return db
      },
      posthooks: posthooks,
      prehooks: prehooks
    }
    //POST HOOKS

    function each (e) {
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

    function callHooks (isBatch, ch, opts, cb) {
      for (var i in prehooks) {
        ch = prehooks[i](ch)
        if(!ch) return cb(new Error('vetoed'))
      }
      if(ch.length == 1 && !isBatch) {
        var change = ch.shift()
        return change.type == 'put' 
          ? put.call(db, change.key, change.value, opts, cb) 
          : del.call(db, change.key, opts, cb)  
      }
      return batch.call(db, ch, opts, cb)
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
}
