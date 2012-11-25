var rimraf  = require('rimraf')
var levelup = require('levelup')

var hooks   = require('..')

var assert  = require('assert')
var mac     = require('macgyver')().autoValidate()

var dir ='/tmp/map-reduce-intercept-test'

rimraf(dir, function () {
  levelup(dir, {createIfMissing: true}, function (err, db) {
    
    hooks()(db)
    var _batch
    db.hooks.pre(mac(function (batch) {
      //iterate backwards so you can push without breaking stuff.
      batch.push({key: 'h', value: 'hello', type: 'put'})
      //turn this into a batch
      return _batch = batch
    }).once())

    //assert that it really became a batch
    db.on('batch', mac(function (batch) {
      console.log('batch', _batch)
      assert.deepEqual(_batch, batch.map(function (e) {
        return {key: ''+e.key, value: ''+ e.value, type: e.type}
      }))
    }).once())

  
    db.put('hello' , 'whatever' , mac(function (){

    }).once())

  })
})


