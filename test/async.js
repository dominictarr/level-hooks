
var rimraf  = require('rimraf')
var levelup = require('levelup')

var Hooks   = require('../')

var assert  = require('assert')
var mac     = require('macgyver')().autoValidate()

var Bucket  = require('range-bucket')

var dir ='/tmp/map-reduce-prehook-test'

rimraf(dir, function () {
  levelup(dir, function (err, db) {
    if(err) throw err

    var SEQ = 0
    var bucket = Bucket('prehook')

    Hooks(db)

    db.hooks.async(/^\w/, mac(function (op, cb) {
      //iterate backwards so you can push without breaking stuff.
      db.get(op.key, function (err, val) {
        op.value = Number(op.value || 0) + Number(val || 0)
        console.log('POST LOCK', op)
        cb()
      })
    }).atLeast(1))

    db.put('a', 1, mac(function (err) {
      db.put('a', 2, mac(function (err) {
        db.get('a', mac(function (err, val) {
          assert.equal(val, 3)
          console.log(val)
        }).once())
      }).once())
    }).once())
  })
})
