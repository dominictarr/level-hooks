# Pre/Post hooks for leveldb

Intercept put/delete/batch operations on levelup.

``` js
var levelup   = require('levelup')
var timestamp = require('monotonic-timestamp')
var hooks     = require('level-hooks')

levelup(file, {createIfMissing: true}, function (err, db) {

  //install hooks onto db.
  hooks()(db)

  db.hooks.pre(function (batch) {

    //batch is the same format as the arguments to db.batch.
    //it may be mutated like this to atomically add operations.
    
    //example, add a log to record every put operation.
    batch.forEach(function (e) {

      if(!/~log-/.test(e.key.toString())
        batch.push({type: 'put', key: '~log-'+timestamp()+'-'+e.type, value: e.key})

    })

    //you can also remove elements.
    //if there is only one element,
    //hooks will turn it into an put/del operation, 
    //not use the batch function.

  })

  //add a hook that responds after an operation has completed.

  //same pattern as the an element in the batch array.
  db.hooks.post(function (err, ch) {
    console.log(ch)
    //{type: 'put'|'del', key: ..., value: ...}
  })


})

```

Used by [map-reduce](https://github.com/dominictarr/map-reduce) 
to make map-reduce durable across crashes!
