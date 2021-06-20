/***********************************************************
    Fields.
************************************************************/

var _ws,
    
    _connected = false,

    _last_time_sent,
    _close_reason = null,

    _packet = {
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

/***********************************************************
    Functions.
************************************************************/

var _serverConnect = function () {
    if (_connected) {
        return;
    }

    //_ws = new WebSocket('ws://localhost:2891');
    _ws = new WebSocket('wss://www.onirom.fr:2891');
    
    _ws.binaryType = 'arraybuffer';

    _ws.onopen = function (event) {
        _connected = true;

        _last_time_sent = null;

        _getGeoLocation(function (pos) {
            _sendLocation(pos.latitude, pos.longitude);
        }, function () {
            _send(_packet.READY);
        });
    };

    _ws.onmessage = function (message) {
        try {
            var buffer = new Float32Array(message.data);
            if (buffer[0] === _packet.COUNTDOWN) {
                _last_time_sent = null;
                
                // player: cube side in 1 2 3
                // player: direction in 4 5
                // second player : cube side in 6 7 8
                // second player : direction in 9 10
                _switchGameState(_states.COUNTDOWN, {
                    cube_side: new THREE.Vector3(buffer[1], buffer[2], buffer[3]),
                    direction: new THREE.Vector3(buffer[4], buffer[5], 0),
                    cube_side2: new THREE.Vector3(buffer[6], buffer[7], buffer[8]),
                    direction2: new THREE.Vector3(buffer[9], buffer[10], 0)
                });
            } else if (buffer[0] === _packet.GAME) {
                _last_time_sent = null;

                _switchGameState(_states.GAME);

                _addCountdown(_countdown_content[_countdown_content.length - 1]);
            } else if (buffer[0] === _packet.SCORE) {
                var who = buffer[1];
                if (who === 1) {
                    _player_bike.score += 1;
                } else if (who === 0) {
                    _players[0].score += 1;
                }

                _updateScore();

                if (_players[0].score >= _MAX_ROUND_SCORE || _player_bike.score >= _MAX_ROUND_SCORE) {
                    _switchGameState(_states.WIN_LOSE);

                    _send(_packet.WAIT);

                    _player_bike.stop();
                }
            } else if (buffer[0] === _packet.COLLIDE) {
                _collision_type = buffer[1];
                _game_state = _states.FINISH_MOVE;
            } else if (buffer[0] === _packet.UPDATE) {
                var pos = new Float32Array(message.data);
                _players[0].pushPosition(pos[1],
                    new THREE.Vector3(pos[2], pos[3], pos[4]),
                    new THREE.Vector3(pos[5], pos[6], pos[7]),
                    new THREE.Vector3(pos[8], pos[9], pos[10]));
            } else if (buffer[0] === _packet.LOBBY) {
                _notification("Player 2 left the game");

                _close_reason = "leave";

                _ws.close();
            }
        } catch (e) {
            console.log(e);
        }
    };

    _ws.onerror = function (e) {
        console.log(e);
    };

    _ws.onclose = function (ev) {
        if (_close_reason === null) {
            if (_connected) {
                _notification("Disconnected from server");
            } else {
                _notification("Could not connect to the server");
            }
        } else {
            _close_reason = null;
        }

        _ws = null;

        //setTimeout(_serverConnect, 2000);

        _connected = false;

        _switchGameState(_states.MENU);
    };
};

var _sendPosition = function (position, direction, cube_side) {
    if (!_ws) {
        return;
    }

    if (_last_time_sent === null) {
        _last_time_sent = performance.now();
    }

    var buffer = new ArrayBuffer(4 * 11);
    var uint8_view = new Uint8Array(buffer);
    var float_view = new Float32Array(buffer);
    uint8_view[0] = _packet.UPDATE;
    float_view[1] = performance.now() - _last_time_sent;
    float_view[2] = position.x;
    float_view[3] = position.y;
    float_view[4] = position.z;
    float_view[5] = direction.x;
    float_view[6] = direction.y;
    float_view[7] = direction.z;
    float_view[8] = cube_side.x;
    float_view[9] = cube_side.y;
    float_view[10] = cube_side.z;

    _ws.send(buffer);

    _last_time_sent = performance.now();
};

var _send = function (id, arr) {
    if (!_ws) {
        return;
    }

    if (arr === undefined) {
        arr = [];
    }

    var buffer = new ArrayBuffer(4 + arr.length * 4);
    var uint8_view = new Uint8Array(buffer);
    uint8_view[0] = id;
    var float_view = new Float32Array(buffer);

    for (var i = 0; i < arr.length; i += 1) {
        float_view[i + 1] = arr[i];
    }

    _ws.send(buffer);
};

var _sendCollide = function (type) {
    _send(_packet.COLLIDE, [type]);
};

var _sendLocation = function (lat, lon) {
    if (!_ws) {
        return;
    }

    var buffer = new ArrayBuffer(4 + 4 + 4);

    var float_view = new Float32Array(buffer);
    float_view[1] = lat;
    float_view[2] = lon;

    var uint8_view = new Uint8Array(buffer);
    uint8_view[0] = _packet.LOCATION;

    _ws.send(buffer);
};
