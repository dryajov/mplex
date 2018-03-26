'use strict'

const type = require('./consts')

class Channel {
  constructor (id, name, plex, initiator) {
    this._id = id
    this._name = name
    this._plex = plex
    this._open = false
    this._msgs = []
    this._initiator = initiator
  }

  isOpen () {
    return this._open
  }

  open (cb) {
    const header = this._id << 3 | type.NEW
    if (this._name.length <= 0) {
      this._name = this._id.toString()
    }

    this._plex.send(header, Buffer.from(this._name), (err) => {
      if (err) { return cb(err) }
      this._open = true
      cb(null, this)
    })
  }

  send (data, cb) {
    if (!this.isOpen()) {
      return this.open(() => {
        this.send(data, cb)
      })
    }

    const header = this._id << 3 | type.MESSAGE + this._initiator ? 0 : 1
    if (this._name.length <= 0) {
      this._name = this._id.toString()
    }

    this._plex.send(header, Buffer.from(data), (err) => {
      if (err) { return cb(err) }
      cb()
    })
  }

  source () {
    return (end, cb) => {
      if (end) { return cb(end) }
      cb(null, this.read())
    }
  }

  sink () {
    return (read) => {
      read(null, function next (end, data) {
        if (end === true) { return }
        if (end) throw end

        this.send(data, (err) => {
          read(err, next)
        })
      })
    }
  }

  read () {
    return this._msgs.shift()
  }
}

module.exports = Channel
