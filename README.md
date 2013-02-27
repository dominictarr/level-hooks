# Pre/Post hooks for leveldb

Intercept put/delete/batch operations on levelup.

## Warning - Breaking Changes

The API for implementing pre hooks has changed.
Instead of mutating an array at once, the prehook
is called on each change `hook(change, add)`
and may call `add(_change)` to add a new item into the batch.

## Examlpe

``` js
var levelup   = require('levelup')
var timestamp = require('monotonic-timestamp')
var hooks     = require('level-hooks')

levelup(file, {createIfMissing: true}, function (err, db) {

  //install hooks onto db.
  hooks()(db)

  db.hooks.pre(function (change, add) {

    //batch is the same format as the arguments to db.batch.
    //it may be mutated like this to atomically add operations.
    
    //example, add a log to record every put operation.
      if(!/~log-/.test(e.key.toString())
        add({type: 'put', key: '~log-'+timestamp()+'-'+e.type, value: e.key})

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
