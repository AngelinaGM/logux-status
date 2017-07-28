var attention = require('../attention')
var confirm = require('../confirm')
var favicon = require('../favicon')
var status = require('../status')
var badge = require('../badge')
var index = require('../')
var log = require('../log')

it('has attention function', function () {
  expect(index.attention).toBe(attention)
})

it('has confirm function', function () {
  expect(index.confirm).toBe(confirm)
})

it('has log function', function () {
  expect(index.log).toBe(log)
})

it('has status function', function () {
  expect(index.status).toBe(status)
})

it('has badge function', function () {
  expect(index.badge).toBe(badge)
})

it('has favicon function', function () {
  expect(index.favicon).toBe(favicon)
})
