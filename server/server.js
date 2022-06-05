/**
 * kTron game server
 */

var WebSocketServer = require('websocket').server
var http = require('http')
var ServerEngine = require('./server_engine')
var config = require('./config')
var common_config = require('../common')
var winston = require('winston')
var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({ 'timestamp': true, 'colorize': true })
    ]
})

var client_state = {
    LOBBY: 0,
    COUNTDOWN: 1,
    GAME: 2,
    WAIT: 3,
    READY: 4
};

var packet = {
    COUNTDOWN: 0,
    GAME: 1,
    UPDATE: 2,
    LOBBY: 3,
    LOCATION: 4,
    READY: 5,
    COLLIDE: 6,
    WAIT: 7,
    SCORE: 8
};

var server = http.createServer(function (req, res) {
    logger.info("Received request for %s", req.url)
})

server.listen(config.PORT, function() {
    logger.info("Server is listening on port %s", config.PORT)
})

wsServer = new WebSocketServer({
    httpServer: server,
    autoAcceptConnections: false
})

var clients = []
var lobby = []
var _last_clients_count = 0;
var lobby_need_update = false;

function originIsAllowed(request, origin) {
    if (common_config.allowed_origin.indexOf(origin) !== -1) {
        logger.info("%s %s %s %s", request.socket.remoteAddress, 'Client', 'user-agent:', request.httpRequest.headers['user-agent']);
        logger.info("%s %s %s %s", request.socket.remoteAddress, 'Client', 'accept-language:', request.httpRequest.headers['accept-language']);
        
        return true;
    }
    
    logger.warn("%s %s %s", request.socket.remoteAddress, 'Client refused:\n', request.httpRequest.rawHeaders);

    return false
}

wsServer.on('request', function(request) {
    if (!originIsAllowed(request, request.origin)) {
        request.reject()
        logger.warn("Connection from origin %s rejected.", request.origin)

        return
    }

    var connection = request.accept(null, request.origin)

    // the client object
    var client = {
        socket: connection,
        id: clients.length,
        state: client_state.LOBBY,
        countdown: process.hrtime(),
        cube_side: 0,
        direction: 0,
        opponent: null,
        score: 0,
        game_ready: false,
        ready: false,
        delta: 0,
        collided: false,
        vel: common_config.velocity,
        position: {
            x: 0,
            y: 0,
            z: 0
        },
        direction_vec3: {
            x: 0,
            y: 0,
            z: 0
        },
        location: {
            latitude: 0,
            longitude: 0
        }
    }

    clients.push(client)

    if (clients.length > 1) {
        ServerEngine.updateState('processing')
    }

    logger.info("Connection accepted. Clients connected: %s", clients.length)

    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            logger.info("Received Message: %s", message.utf8Data)
            connection.sendUTF(message.utf8Data)
        }
        else if (message.type === 'binary') {
            //console.log('Received Binary Message of ' + message.binaryData.length + ' bytes')
            //connection.sendBytes(message.binaryData)

            try {
                var id = message.binaryData.readUInt8(0)

                if (client.state === client_state.GAME || client.state === client_state.WAIT) {
                    if (id === packet.UPDATE) {
                        client.collided = false;

                        client.delta = message.binaryData.readFloatLE(4)
                        client.position.x = message.binaryData.readFloatLE(8)
                        client.position.y = message.binaryData.readFloatLE(12)
                        client.position.z = message.binaryData.readFloatLE(16)
                        client.direction_vec3.x = message.binaryData.readFloatLE(20)
                        client.direction_vec3.y = message.binaryData.readFloatLE(24)
                        client.direction_vec3.z = message.binaryData.readFloatLE(28)
                        client.cube_side.x = message.binaryData.readFloatLE(32)
                        client.cube_side.y = message.binaryData.readFloatLE(36)
                        client.cube_side.z = message.binaryData.readFloatLE(40)

                        var buffer = Buffer.alloc(4 + 4 * 10)
                        buffer.writeFloatLE(packet.UPDATE, 0)
                        buffer.writeFloatLE(client.delta, 4)
                        buffer.writeFloatLE(client.position.x, 4 * 2)
                        buffer.writeFloatLE(client.position.y, 4 * 3)
                        buffer.writeFloatLE(client.position.z, 4 * 4)
                        buffer.writeFloatLE(client.direction_vec3.x, 4 * 5)
                        buffer.writeFloatLE(client.direction_vec3.y, 4 * 6)
                        buffer.writeFloatLE(client.direction_vec3.z, 4 * 7)
                        buffer.writeFloatLE(client.cube_side.x, 4 * 8)
                        buffer.writeFloatLE(client.cube_side.y, 4 * 9)
                        buffer.writeFloatLE(client.cube_side.z, 4 * 10)

                        client.opponent.socket.sendBytes(buffer);
                    } else if (id === packet.COUNTDOWN) {
                        newDirection([0, 0, -1], client)
                        newDirection([0, 0, 1], client.opponent)

                        newRound(client)
                        newRound(client.opponent)
                    } else if (id === packet.COLLIDE) {
                        if (!client.opponent.collided && !client.collided) {
                            client.collided = true;

                            var type = message.binaryData.readFloatLE(4)

                            var buffer = Buffer.alloc(8)
                            buffer.writeFloatLE(packet.COLLIDE, 0)
                            buffer.writeFloatLE(type, 4)
                            client.opponent.socket.sendBytes(buffer);

                            logger.info("Client %s collided with client %s or a trail.", client.id, client.opponent.id)

                            if (type === 2) {
                                var buffer = Buffer.alloc(8)
                                buffer.writeFloatLE(packet.SCORE, 0)
                                buffer.writeFloatLE(1, 4)
                                client.opponent.socket.sendBytes(buffer);
                                buffer.writeFloatLE(0, 4)
                                client.socket.sendBytes(buffer);
                            }
                        }
                    } else if (id === packet.WAIT) {
                        client.state = client_state.WAIT
                        client.opponent.state = client_state.WAIT

                        logger.info("Client %s and client %s waiting for new round.", client.id, client.opponent.id)
                    } else if (id === packet.READY) {
                        //if (client.state === client_state.WAIT) {
                            client.collided = false;

                            client.state = client_state.READY

                            logger.info("Client %s is ready.", client.id)

                            if (client.opponent.state === client_state.READY) {
                                newDirection([0, 0, -1], client)
                                newDirection([0, 0, 1], client.opponent)
    
                                newRound(client)
                                newRound(client.opponent)
                            }
                        //}
                    }
                } else if (client.state !== client_state.READY) {
                    if (id === packet.LOCATION) {
                        client.location.latitude = message.binaryData.readFloatLE(4)
                        client.location.longitude = message.binaryData.readFloatLE(8)

                        logger.info("Client %s sent location.", client.id)

                        client.ready = true;

                        lobby.push(client)

                        lobby_need_update = true
                    } else if (id === packet.READY) {
                        client.ready = true;

                        lobby.push(client)

                        lobby_need_update = true
                    }
                }
            } catch (e) {
                console.log(e);
            }
        }
    })

    connection.on('close', function(reasonCode, description) {
        logger.info("Peer %s disconnected.", connection.remoteAddress)

        try {
            if (client.opponent) {
                var buffer = Buffer.alloc(4)
                buffer.writeFloatLE(packet.LOBBY, 0)
                client.opponent.socket.sendBytes(buffer);
            }
        } catch (e) {
            console.log(e);
        }

        clients.splice(client.id, 1)

        if (clients.length <= 1) {
            ServerEngine.updateState('wait')
        }

        lobby = []

        if (client.opponent) {
            client.opponent.state = client_state.LOBBY
        }

        clients.forEach(function (client, index) {
            client.id = index

            if (client.state === client_state.LOBBY) {
                lobby.push(client)

                lobby_need_update = true;
            }
        });
    })
})

function sendMessage(client, id, data) {
    var data_len = 0
    if (data) {
        data_len = data.length
    }

    var buffer = Buffer.alloc(4 + data_len * 4)
    buffer.writeFloatLE(id, 0)

    if (data) {
        data.forEach(function (value, index) {
            buffer.writeFloatLE(value, index * 4 + 4)
        })
    }

    client.sendBytes(buffer)
}

function newDirection(cube_side, client) {
    var random_dir = [0, 0]
    random_dir[Math.round(Math.random())] = client.vel * (Math.ceil((Math.random() - 0.5) * 2) < 1 ? -1 : 1)

    client.direction = random_dir
    client.cube_side = cube_side
}

function newRound(client) {
    var data = client.cube_side.concat(client.direction).concat(client.opponent.cube_side).concat(client.opponent.direction);
    sendMessage(client.socket, packet.COUNTDOWN, data)

    client.state = client_state.COUNTDOWN

    client.countdown = process.hrtime()
}

setInterval(function () {
    if (clients.length > 0 && clients.length !== _last_clients_count) {
        logger.info("Clients connected: %s", clients.length)

        _last_clients_count = clients.length;
    }
}, 1000 * 30);

function deg2rad(deg) {
    return deg * (Math.PI/180)
}

function getDistanceFromLatLonInKm(lat1,lon1,lat2,lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2-lat1);  // deg2rad below
    var dLon = deg2rad(lon2-lon1); 
    var a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2)
      ; 
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c; // Distance in km
    return d;
}

ServerEngine.updateables.push({ 
    update: function (delta) {
        var i = 0,
            client,
            client2;
        
        if (lobby_need_update) {
            lobby.sort(function (a, b) {
                return getDistanceFromLatLonInKm(0, 0, a.location.latitude, a.location.longitude) - getDistanceFromLatLonInKm(0, 0, b.location.latitude, b.location.longitude);
            });
        }

        for (i = lobby.length - 2; i >= 0; i -= 2) {
            client = lobby[lobby.length - 1]
            client2 = lobby[i]

            lobby.splice(lobby.length - 1, 1)
            lobby.splice(lobby.length - 1, 1)

            logger.info("Client %s and %s joined a game.", client.id, client2.id)

            client.opponent = client2
            client2.opponent = client

            newDirection([0, 0, -1], client)
            newDirection([0, 0, 1], client2)

            newRound(client)
            newRound(client2)
        }

        for (i = 0; i < clients.length; i += 1) {
            var client = clients[i]

            if (client.state === client_state.COUNTDOWN) {
                var elapsed = process.hrtime(client.countdown)

                if (elapsed[0] >= 3) {
                    sendMessage(client.socket, packet.GAME)

                    client.state = client_state.GAME
                }
            }
        }  
    }
})


ServerEngine.loop()