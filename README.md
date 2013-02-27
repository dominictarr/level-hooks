# Pre/Post hooks for leveldb

Intercept put/delete/batch operations on levelup.

## Warning - Breaking Changes
 
The API for implementing pre hooks has changed.
Instead of mutating an array at once, the prehook
is called on each change `hook(change, add)`
and may call `add(_change)` to add a new item into the batch.

Also, attaching hooks to leveldb is now simpler
``` js
var Hooks = require('level-hooks')
Hooks(db) //previously: Hooks()(db)
```

## Example

``` js
var levelup   = require('levelup')
var timestamp = require('monotonic-timestamp')
var hooks     = require('level-hooks')

levelup(file, {createIfMissing: true}, function (err, db) {

  //install hooks onto db.
  hooks(db)

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

## API

### db.hooks.pre (range?, hook(change, add(change, prefix?)))

If `prefix` is a `string` or `object` that defines the range the pre-hook triggers on.
If `prefix' is a string, then the hook only triggers on keys that _start_ with that 
string. If the hook is an object it must be of form `{start: START, end: END}`

`hook` is a function, and will be called on each item in the batch 
(if it was a `put` or `del`, it will be called on the change)
`change` is always of the form `{key: key, value: value, type:'put' | 'del'}`

Pass additional changes to `add` to add them to the batch.
If add is passed a string as the second argument it will prepend that prefix
to any keys you add.

To veto (remove) the current change call `add(false)`.

### db.hooks.post (range?, hook)

Post hooks do not offer any chance to change the value.
but do take a range option, just like `pre`

## License

MIT
