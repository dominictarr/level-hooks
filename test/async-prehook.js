var rimraf  = require('rimraf')
var levelup = require('levelup')

var Hooks   = require('../')

var assert  = require('assert')
var mac     = require('macgyver')().autoValidate()

var dir ='/tmp/map-reduce-prehook-test'

rimraf(dir, function () {
  levelup(dir, function (err, db) {
    if(err) throw err

    var SEQ = 0

    Hooks(db)


    db.hooks.pre(/^\w/, mac(function (ch, add) {
      //iterate backwards so you can push without breaking stuff.
      var key = ch.key

      db.get(ch.key, function (err, val) {
        ch.value = +(ch.value || 0) + +(val || 0)
        add()
      })
      return true //this is async
    }).atLeast(1))

    var n = 3

    db.put('a' , '1' , mac(function (err) {
      db.put('a' , '2' , mac(function (err) {
        db.get('a', mac(function (err, val) {
          assert.equal(+val, 3)
          console.log(val)
        }).once())
      }).once())
    }).once())
  })
})


