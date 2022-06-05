var config = require('./config')

var ServerEngine = {}
ServerEngine.previousTick = Date.now()
ServerEngine.UPDATE_RATE = config.UPDATE_RATE
ServerEngine.tick = 0
ServerEngine.state = 'wait'
ServerEngine.timeout = null
ServerEngine.immediate = null

ServerEngine.updateables = [] 

ServerEngine.loop = function() {
  clearImmediate(ServerEngine.immediate)
  clearTimeout(ServerEngine.timeout)

  var now = Date.now()
  if (ServerEngine.previousTick + 1000 / ServerEngine.UPDATE_RATE <= now) {
    var delta = (now - ServerEngine.previousTick) / 1000
    ServerEngine.previousTick = now
    ServerEngine.tick++

    // update
    ServerEngine.update(delta)
  }

  if (ServerEngine.state === 'wait') {
    // make it slower
    ServerEngine.timeout = setTimeout(ServerEngine.loop, 2000)
  } else {
    if (Date.now() - ServerEngine.previousTick < 1000 / ServerEngine.UPDATE_RATE - 16) {
      // if more than 16 ms until next update, use setTimeout to
      // schedule the next iteration (which can take up to 16 ms)
      ServerEngine.timeout = setTimeout(ServerEngine.loop)
    } else {
      // if less than 16 ms until next update, use setTimeout
      // which runs ASAP
      ServerEngine.immediate = setImmediate(ServerEngine.loop)
    }
  }
}

ServerEngine.updateState = function (state) {
  if (state === 'wait') {
    ServerEngine.state = 'wait'
  } else {
    ServerEngine.state = 'processing'
  }

  console.log('State: ' + state)
}

ServerEngine.update = function(delta) {
  for (var i = 0; i < ServerEngine.updateables.length; i++) {
    ServerEngine.updateables[i].update(delta)
  }
}

module.exports = ServerEngine