var CrossTabClient = require('logux-client').CrossTabClient
var SyncError = require('logux-sync').SyncError
var TestTime = require('logux-core').TestTime
var TestPair = require('logux-sync').TestPair
var BaseSync = require('logux-sync').BaseSync
var delay = require('nanodelay')

var status = require('../status')

function createTest (options) {
  var pair = new TestPair()
  var client = new CrossTabClient({
    subprotocol: '1.0.0',
    server: pair.left,
    userId: 10,
    time: new TestTime()
  })

  client.role = 'leader'
  client.sync.catch(function () { })

  pair.client = client
  pair.leftSync = client.sync

  return pair.left.connect().then(function () {
    pair.calls = []
    pair.args = []
    status(client, function (state, details) {
      pair.calls.push(state)
      pair.args.push(details)
    }, options)
    return pair
  })
}

it('notifies about states', function () {
  return createTest().then(function (test) {
    test.leftSync.connected = false
    test.leftSync.setState('disconnected')
    test.leftSync.setState('connecting')
    return delay(105, test)
  }).then(function (test) {
    test.leftSync.connected = true
    test.leftSync.setState('synchronized')
    expect(test.calls).toEqual([
      'disconnected', 'connecting', 'synchronized'
    ])
  })
})

it('notifies about other tab states', function () {
  return createTest().then(function (test) {
    test.client.state = 'disconnected'
    test.client.emitter.emit('state')
    expect(test.calls).toEqual(['disconnected'])
  })
})

it('notifies only about wait for sync actions', function () {
  return createTest({ duration: 10 }).then(function (test) {
    test.leftSync.connected = false
    test.leftSync.setState('disconnected')
    expect(test.calls).toEqual(['disconnected'])
    test.leftSync.log.add({ type: 'A' }, { sync: true, reasons: ['t'] })
    test.leftSync.setState('connecting')
    return delay(105, test)
  }).then(function (test) {
    test.leftSync.setState('disconnected')
    test.leftSync.setState('connecting')
    return delay(105, test)
  }).then(function (test) {
    test.leftSync.setState('sending')
    test.leftSync.setState('synchronized')
    expect(test.calls).toEqual([
      'disconnected',
      'wait',
      'connectingAfterWait',
      'wait',
      'connectingAfterWait',
      'sendingAfterWait',
      'synchronizedAfterWait'
    ])
    return delay(15, test)
  }).then(function (test) {
    expect(test.calls).toEqual([
      'disconnected',
      'wait',
      'connectingAfterWait',
      'wait',
      'connectingAfterWait',
      'sendingAfterWait',
      'synchronizedAfterWait',
      'synchronized'
    ])
  })
})

it('skips connecting notification if it took less than 100ms', function () {
  return createTest().then(function (test) {
    test.leftSync.connected = false
    test.leftSync.setState('disconnected')
    test.leftSync.setState('connecting')
    test.leftSync.connected = true
    test.leftSync.setState('synchronized')
    expect(test.calls).toEqual(['disconnected', 'synchronized'])
  })
})

it('notifies about synchronization error', function () {
  return createTest().then(function (test) {
    var error1 = { type: 'any error' }
    test.leftSync.emitter.emit('error', error1)

    var error2 = new SyncError(test.leftSync, 'test', 'type', true)
    test.leftSync.emitter.emit('clientError', error2)

    expect(test.calls).toEqual(['syncError', 'syncError'])
    expect(test.args).toEqual([{ error: error1 }, { error: error2 }])
  })
})

it('ignores timeout error', function () {
  return createTest().then(function (test) {
    var error1 = { type: 'timeout' }
    test.leftSync.emitter.emit('error', error1)
    expect(test.calls).toEqual([])
  })
})

it('notifies about old client', function () {
  return createTest().then(function (test) {
    var protocol = new SyncError(test.leftSync, 'wrong-protocol', { })
    test.leftSync.emitter.emit('error', protocol)

    var subprotocol = new SyncError(test.leftSync, 'wrong-subprotocol', { })
    test.leftSync.emitter.emit('error', subprotocol)

    test.leftSync.setState('disconnected')

    expect(test.calls).toEqual(['protocolError', 'protocolError'])
  })
})

it('notifies about server error', function () {
  return createTest().then(function (test) {
    test.leftSync.log.add({ type: 'logux/undo', reason: 'error' })
    expect(test.calls).toEqual(['error'])
    expect(test.args[0].action.type).toEqual('logux/undo')
    expect(test.args[0].meta.time).toEqual(1)
  })
})

it('notifies about problem with access', function () {
  return createTest().then(function (test) {
    test.leftSync.log.add({ type: 'logux/undo', reason: 'denied' })
    expect(test.calls).toEqual(['denied'])
    expect(test.args[0].action.type).toEqual('logux/undo')
    expect(test.args[0].meta.time).toEqual(1)
  })
})

it('works with syncable', function () {
  var pair = new TestPair()
  pair.leftSync = new BaseSync('client', TestTime.getLog(), pair.left)

  var calls = []
  status({ sync: pair.leftSync, log: pair.leftSync.log }, function (state) {
    calls.push(state)
  })

  pair.leftSync.setState('synchronized')
  expect(calls).toEqual(['synchronized'])
})

it('removes listeners', function () {
  var pair = new TestPair()
  var client = new CrossTabClient({
    subprotocol: '1.0.0',
    server: pair.left,
    userId: 10,
    time: new TestTime()
  })

  var calls = 0
  var unbind = status(client, function (state) {
    if (state === 'denied') {
      calls += 1
    }
  })

  client.log.add({ type: 'logux/undo', reason: 'denied' })
  unbind()
  client.log.add({ type: 'logux/undo', reason: 'denied' })

  expect(calls).toEqual(1)
})
