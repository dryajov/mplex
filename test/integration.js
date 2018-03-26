/* eslint-env mocha */
/* eslint max-nested-callbacks: ["error", 5] */
'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const expect = chai.expect
chai.use(dirtyChai)

const pull = require('pull-stream')
const shake = require('pull-handshake')

const Mplex = require('../src')

describe('should create channel', () => {
  it('should create channel on both ends', (done) => {
    const stream = shake()

    const m1 = new Mplex(stream)
    const m2 = new Mplex(m1._stream)

    const strm1 = m1.newStream()
    m2.on('stream', (_strm) => {
      const strm2 = _strm

      pull(strm2, strm1, strm2)

      pull(
        pull.values([Buffer.from('hello')]),
        strm1,
        pull.collect((err, data) => {
          expect(err).to.not.exist()
          console.dir(data)
          expect(data).to.eql(Buffer.from('hello'))
          done()
        })
      )
    })

    strm1.open((err) => {
      expect(err).to.not.exist()
      m1._readNext()
      m2._readNext()
    })
  })
})