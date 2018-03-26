'use strict'

const pull = require('pull-stream')
const shake = require('pull-handshake')
const varint = require('varint')
const EE = require('events')

const Channel = require('./channel')
const consts = require('./consts')

class Mplex extends EE {
  constructor (stream) {
    super()
    this._stream = shake()
    this._sh = this._stream.handshake
    this._chanId = 0
    this._channels = {}
    this._abort = false

    pull(this._stream, stream, this._stream)
  }

  _readNext (cb) {
    this._sh.read(1, (err, data) => {
      this._decodeMsg(data)
    })
  }

  _nextChanId (initiator) {
    let incr = 0
    if (initiator) { incr += 1 }
    this._chanId += incr + 1
    return this._chanId
  }

  newStream () {
    const chanId = this._nextChanId(true)
    const chan = new Channel(chanId, '', this, true)
    this._channels[chanId] = chan
    return chan
  }

  send (header, data, cb) {
    const len = data ? data.length : 0
    const pool = Buffer.alloc(1024 * 10)
    let used = 0

    varint.encode(header, pool, used)
    used += varint.encode.bytes
    varint.encode(len, pool, used)
    used += varint.encode.bytes

    this._sh.write(pool.slice(0, used))
    if (len) {
      this._sh.write(data)
    }

    cb()
  }

  _decodeMsg (header, cb) {
    if (!cb) {
      cb = (() => {})
    }

    header = varint.decode(header)
    // get channel ID
    const id = header >> 3
    const tag = header & 7

    switch (tag) {
      case consts.type.NEW: {
        const chan = new Channel(id, '', this, false)
        this._channels[id] = chan
        this.emit('stream', chan)
        return cb(null, chan)
      }

      case consts.type.MESSAGE: {
        const chan = this._channels[id]
        if (!chan) { return cb(new Error(`no channel with id: ${id} !`)) }
        this._sh.read(1, (err, data) => {
          if (err) {return cb(err)}
          const len = varint.decode(data)
          this._sh.read(len, (err, data) => {
            if (err) {
              chan.write(data)
              cb(null, data)
            }
          })
        })
      }

      case consts.type.CLOSE: {
        return cb()
      }

      case consts.type.RESET: {
        return cb()
      }
    }
  }

  source () {
    return (end, cb) => {
      if (end) { return cb(end)}
      this._readNext((err, thing) => {
        if (err) { return cb(err) }
        return cb(null, thing)
      })
    }
  }

  sink () {
    return (read) => {
      read(null, function next (end, data) {
        if (end === true) { return }
        if (end) throw end

        this.send.appy(this, data)
      })
    }
  }
}

module.exports = Mplex
