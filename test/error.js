var rimraf  = require('rimraf')
var levelup = require('levelup')

var Hooks   = require('../')

var assert  = require('assert')
var mac     = require('macgyver')().autoValidate()

var dir ='/tmp/map-reduce-prehook-test'

rimraf(dir, function () {
  levelup(dir, function (err, db) {
    if(err) throw err

    Hooks(db)

    db.hooks.pre({min: 'a', max:'z'}, function (ch, add) {
      add(ch) //this should cause an error
    })

    db.put('c', 'whatever', mac(function (err) {
      
      assert.ok(err)
      console.log('expect error:', err)
    }).once())

  })
})
