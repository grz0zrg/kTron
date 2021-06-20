/*#include tween/Tween.min.js*/
/*#include three/three.min.js*/
/*#include postprocessing/EffectComposer.js*/
/*#include postprocessing/RenderPass.js*/
/*#include postprocessing/ShaderPass.js*/
/*#include postprocessing/UnrealBloomPass.js*/

/*#include noise/SimplexNoise.js*/

/*#include shaders/NoiseShader.js*/
/*#include shaders/SuperShader.js*/
/*#include shaders/SpaceShader.js*/

/*#include shaders/CopyShader.js*/
/*#include shaders/LuminosityHighPassShader.js*/
/*#include loader/ColladaLoader.js*/

// https://github.com/goldfire/howler.js
/*#include howler.js/howler.min.js*/

// https://github.com/jfriend00/docReady/blob/master/docready.js
/*#include docready/docready.js*/

/*#include ../common.js*/

/*#include fullscreen.js*/

var kTron = function () {
    /***********************************************************
        Fields.
    ************************************************************/
    var _game_camera,
        _game_scene,
        _game_renderer,
        _game_composer,

        _game_stats,

        _states = {
            MENU: 0,
            WAIT: 1,
            COUNTDOWN: 2,
            GAME: 3,
            WIN_LOSE: 4,
            SOLO_GAME: 5,
            FINISH_MOVE: 6
        },

        _MAX_ROUND_SCORE = 7,

        _menu_elem = document.getElementById("menu"),
        _curtain = document.getElementById("curtain"),
        _play_btn = document.getElementById("play_btn"),
        _play2_btn = document.getElementById("play2_btn"),
        _settings_btn = document.getElementById("settings_btn"),
        _waiting_elem = document.getElementById("waiting"),
        _latency_elem = document.getElementById("latency"),
        _settings_elem = document.getElementById("settings"),
        _mute_mus_btn = document.getElementById("mute_mus"),
        _mute_sfx_btn = document.getElementById("mute_sfx"),
        _mute_vib_btn = document.getElementById("mute_vib"),
        _menu_btn = document.getElementById("menu_btn"),
        _result_elem = document.getElementById("result"),
        _notification_elem = null,

        _notification_timeout = null,

        _exit_flag = false,

        _single_player = false,

        _adsState = 0,

        _collision_type = -1,

        _countdown_elems = [],
        _countdown_content = ["3", "2", "1", "Go!"],
        _countdown_index = 0,

        _trail_palette = [
            "#FFFF00",
            "#00FF00",
            "#FF8000",
            "#0000FF"
        ],

        _vec3 = new THREE.Vector3(),

        _game_state = _states.MENU,

        _countdown_clock = new THREE.Clock(),
        _game_clock = new THREE.Clock(),
        _sync_clock = new THREE.Clock(),

        _game_delta = 0,
        _game_delta_ms = 0,

        _game_sync_rate = 1 / 30,

        _settings = {
            vibration: (localStorage.getItem("vibrate") === "off") ? false : true,
            music: (localStorage.getItem("music") === "off") ? false : true,
            sfx: (localStorage.getItem("sfx") === "off") ? false : true,
        },

        _music,
        _curr_music,
        _sfx,
        _countdown,
        _engine,
        _hit,

        _explosion_particles,

        // all postfx pass
        _postfx = {
            background: null,
            noise: null,
            bloom: null,
            post: null,
            time: 0
        },

        // maximum width for mobile version
        _mobile_width = 670,

        // player mesh
        _player_mesh,

        // player bike instance
        _player_bike,

        // car materials (for each _trail_palette); to distinguish players (color change)
        _remote_player_materials = [],

        _players = [],

        // global settings
        _game_camera_distance = 320,
        _cube_size = 200;

    /***********************************************************
        Includes.
    ************************************************************/

    /*#include network.js*/
    /*#include bike.js*/
    /*#include camera.js*/
    /*#include env.js*/
    /*#include tools.js*/
    /*#include explosion.js*/
    /*#include quad_particles.js*/

    /***********************************************************
        Functions.
    ************************************************************/
    
    var _vibrate = function (ms) {
        if (navigator.vibrate && _settings.vibration) {
            window.navigator.vibrate(ms);
        }
    };
    
    var _getGeoLocation = function (cb, cb_err) {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(cb, cb_err, { enableHighAccuracy: true, timeout: 4000, maximumAge: 0 });
        } else {
            cb_err();
        }
    };

    var _playSfx = function (sfx) {
        if (_settings.sfx) {
            sfx.play();
        }
    };

    var _updateScore = function () {
        var score_elem = document.getElementById("score");

        score_elem.innerHTML = '<span style="color: #ff0000">' + _player_bike.score + '</span> | <span style="color: #ffff00">' + _players[0].score + '</span>';
    };
    
    var _notification = function (text, top_px, no_background) {
        if (_notification_elem) {
            document.body.removeChild(_notification_elem);
            _notification_elem = null;
        }

        _notification_elem = document.createElement("div");
        _notification_elem.classList.add("notification");

        if (top_px !== undefined) {
            _notification_elem.style = "top: " + top_px + "px";
        }

        if (no_background) {
            _notification_elem.style.backgroundColor = "transparent;"
        }

        _notification_elem.innerHTML = text;

        document.body.appendChild(_notification_elem);
    };

    var _onWindowResize = function () {
        var screen_width = Math.min(window.innerWidth, window.outerWidth);
        var screen_height = Math.min(window.innerHeight, window.outerHeight);

        _game_renderer.setPixelRatio(window.devicePixelRatio);
        _game_camera.aspect = screen_width / screen_height;
        _game_camera.updateProjectionMatrix();
        _game_renderer.setSize(screen_width, screen_height);
        _game_composer.setSize(screen_width, screen_height);

        // mobile game
        if (screen_width < _mobile_width) {
            _game_camera_distance = 400;

            _game_scene.fog = new THREE.Fog(0x190033, _game_camera_distance - _cube_size / 2 + 2, 305); // + 6 near = sort of 3D tetris view
        } else {
            _game_camera_distance = 320;

            _game_scene.fog = new THREE.Fog(0x190033, _game_camera_distance - _cube_size / 2 + 2, 225);
        }
        
        if (_game_state === _states.MENU) {
            _switchGameState(_states.MENU);
        }

        //_game_camera.position.z = _game_camera_distance;
    };

    var _animate = function () {
        if (!_isDocumentHidden()) {
            _game_delta_ms = _game_clock.getDelta();
            _game_delta = _game_delta_ms / 0.016;
        }

        var i = 0;

        requestAnimationFrame(_animate);

        // update postfx uniforms
        _postfx.background.uniforms.time.value = _postfx.time * 4.;
        _postfx.noise.uniforms.time.value = Math.abs(Math.sin(_postfx.time));

        _postfx.time += 0.004 * _game_delta;
        //

        TWEEN.update();

        // update player
        if (_player_bike) {
            _player_bike.update(_game_camera, _game_camera_distance, _game_sync_rate);
        }

        // update players
        for (i = 0; i < _players.length; i += 1) {
            _players[i].update(_game_camera, _game_camera_distance, _game_sync_rate);
        }
        //

        if (_game_state === _states.COUNTDOWN) {
            if (_countdown_clock.getElapsedTime() >= 1 && _countdown_index < 3) {
                _addCountdown(_countdown_content[++_countdown_index]);

                _countdown_clock.start();

                if (_countdown_index === _countdown_content.length - 1 && _single_player) {
                    _switchGameState(_states.GAME);
                }
            }
        } else if (_game_state === _states.GAME) {
            var collision_type;

            if (_single_player) {
                _players[0].aiUpdate(_player_bike.trail.queue.concat([_player_bike.mesh]));

                collision_type = _players[0].detectCollision([_player_bike]);

                if (collision_type > 0) {
                    _playSfx(_hit);

                    _explosion_particles.start(_players[0].mesh.position, new THREE.Color(0xffff00));

                    if (collision_type === 2) {
                        _player_bike.score += 1;
                        _updateScore();
                    }

                    _players[0].stop();
                    _player_bike.stop();

                    if (_player_bike.score >= _MAX_ROUND_SCORE) {
                        _switchGameState(_states.WIN_LOSE);
                    } else {
                        _switchGameState(_states.COUNTDOWN);
                    }
                }
            }

            collision_type = _player_bike.detectCollision(_players);

            if (collision_type > 0 && _game_state === _states.GAME) {
                _vibrate(100);

                _explosion_particles.start(_player_bike.mesh.position, new THREE.Color(0xff0000));

                _playSfx(_hit);

                if (_single_player && collision_type === 2) {
                    _players[0].score += 1;
                    _updateScore();
                }

                _players[0].stop();
                _player_bike.stop();

                _sendCollide(collision_type);

                if (_single_player) {
                    if (_players[0].score >= _MAX_ROUND_SCORE) {
                        _switchGameState(_states.WIN_LOSE);
                    } else {
                        _switchGameState(_states.COUNTDOWN);
                    }
                } else {
                    _game_state = _states.WAIT;

                    _send(_packet.READY);
                }
            }
            
            if (_sync_clock.getElapsedTime() >= _game_sync_rate) {
                _sendPosition(_player_bike.mesh.position, _player_bike.curr_direction, _player_bike.curr_cube_side);
                
                _sync_clock.start();
            }
        } else if (_game_state === _states.FINISH_MOVE) {
            // we received that the other player collided so we just wait till all positions are played
            if (_players[0].positions.length <= 0) {
                _last_time_sent = null;

                _playSfx(_hit);

                _explosion_particles.start(_players[0].mesh.position, "#ffff00");

                _send(_packet.READY);

                _game_state = _states.WAIT;
            }
        } else if (_game_state === _states.WIN_LOSE) {
            _vec3 = _game_camera.rotation.toVector3();
            _vec3.add(_player_bike.curr_cube_side.clone().multiplyScalar(0.003 * _game_delta));
            _game_camera.rotation.setFromVector3(_vec3);
            //_game_camera.rotation.z += 0.003 * _game_delta;
        }

        _explosion_particles.update();

        _animateEnvironment(_game_camera, _player_bike);

        _game_composer.render();
    };

    var _singlePlayer = function () {
        _switchGameState(_states.COUNTDOWN);

        fullscreenRequest();

        window.addEventListener('touchstart', _onTouchStart, false);
        window.addEventListener('touchmove', _onTouchStart, false);

        _playSfx(_sfx);

        _single_player = true;
    };

    var _multiPlayer = function () {
        _serverConnect();

        _switchGameState(_states.WAIT);

        fullscreenRequest();

        window.addEventListener('touchstart', _onTouchStart, false);
        window.addEventListener('touchmove', _onTouchStart, false);

        _playSfx(_sfx);

        _single_player = false;
    };

    var _onPlay = function (ev) {
        //var result = _showFullAds(0.25);

        //if (!result) {
            _singlePlayer();
        //} else {
        //    _adsState = 2;
        //}
    };

    var _onPlay2 = function (ev) {
        //var result = _showFullAds(0.25);

        //if (!result) {
            _multiPlayer();
        //} else {
        //    _adsState = 3;
        //}
    };

    var _onSettings = function (ev) {
        _play_btn.style.display = "none";
        _play2_btn.style.display = "none";
        _settings_btn.style.display = "none";
        _settings_elem.style.display = "block";

        _playSfx(_sfx);
    };

    var _hideSettings = function () {
        _play_btn.style.display = "block";
        _play2_btn.style.display = "block";
        _settings_btn.style.display = "block";
        _settings_elem.style.display = "none";
    };

    var _onMenu = function (ev) {
        _hideSettings();

        _playSfx(_sfx);
    };

    var _updateSettingsView = function () {
        if (_settings.music) {
            _mute_mus_btn.firstElementChild.innerHTML = "On";
        } else {
            _mute_mus_btn.firstElementChild.innerHTML = "Off";
            _mute_mus_btn.firstElementChild.classList.toggle("on");
        }

        if (_settings.sfx) {
            _mute_sfx_btn.firstElementChild.innerHTML = "On";
        } else {
            _mute_sfx_btn.firstElementChild.innerHTML = "Off";
            _mute_sfx_btn.firstElementChild.classList.toggle("on");
        }
        
        if (_settings.vibration) {
            _mute_vib_btn.firstElementChild.innerHTML = "On";
        } else {
            _mute_vib_btn.firstElementChild.innerHTML = "Off";
            _mute_vib_btn.firstElementChild.classList.toggle("on");
        }
    };

    var _onMuteMus = function (ev) {
        _settings.music = !_settings.music;

        _mute_mus_btn.firstElementChild.classList.toggle("on");

        localStorage.setItem("music", _settings.music ? "on" : "off");

        if (_settings.music) {
            _curr_music = _music.play();

            _mute_mus_btn.firstElementChild.innerHTML = "On";
        } else {
            _music.stop(_curr_music);

            _mute_mus_btn.firstElementChild.innerHTML = "Off";
        }

        _playSfx(_sfx);
    };

    var _onMuteSfx = function (ev) {
        _settings.sfx = !_settings.sfx;

        _mute_sfx_btn.firstElementChild.classList.toggle("on");

        localStorage.setItem("sfx", _settings.sfx ? "on" : "off");

        if (_settings.sfx) {
            _mute_sfx_btn.firstElementChild.innerHTML = "On";
        } else {
            _mute_sfx_btn.firstElementChild.innerHTML = "Off";
        }

        _playSfx(_sfx);
    };

    var _onMuteVib = function (ev) {
        _settings.vibration = !_settings.vibration;

        _mute_vib_btn.firstElementChild.classList.toggle("on");

        localStorage.setItem("vibrate", _settings.vibration ? "on" : "off");

        if (_settings.vibration) {
            _mute_vib_btn.firstElementChild.innerHTML = "On";

            _vibrate(100);
        } else {
            _mute_vib_btn.firstElementChild.innerHTML = "Off";
        }

        _playSfx(_sfx);
    };

    var _resultClick = function () {
        if (_single_player) {
            _switchGameState(_states.COUNTDOWN);
        } else {
            _send(_packet.READY);

            clearInterval(_notification_timeout);
            _notification_timeout = setInterval(_notification, 2000, "waiting for player 2...", 66, true);
        }
    };
    
    var _onResult = function (ev) {
        //_showFullAds();

        _adsState = 1;

        if (typeof AdMob === 'undefined') {
            _resultClick();
        }
    };
    
    var _onKeyDown = function (ev) {
        if (_game_state === _states.GAME || _game_state === _states.FINISH_MOVE) {
            _player_bike.onKeyDown(ev);
        } else if (ev.key === "Escape") {
            _switchGameState(_states.MENU);
        }
    };

    var _onTouchStart = function (ev) {
        if (_game_state === _states.GAME || _game_state === _states.FINISH_MOVE) {
            var touch = ev.touches[0] || ev.changedTouches[0];
            var vector = _player_bike.mesh.position.clone().project(_game_camera);
            vector.x = (vector.x + 1) * window.innerWidth / 2;
            vector.y = -(vector.y - 1) * window.innerHeight / 2;
            vector.z = 0;

            var dx = vector.x - touch.pageX;
            var dy = vector.y - touch.pageY;

            if (Math.abs(dx) > Math.abs(dy)) {
                if (dx > 0) {
                    _player_bike.onKeyDown({ key: "ArrowLeft" });
                } else {
                    _player_bike.onKeyDown({ key: "ArrowRight" });
                }
            } else {
                if (dy > 0) {
                    _player_bike.onKeyDown({ key: "ArrowUp" });
                } else {
                    _player_bike.onKeyDown({ key: "ArrowDown" });
                }
            }
        }
    };

    var _addCountdown = function (text) {
        var countdown_elem = document.createElement("div");
        countdown_elem.classList.add("countdown");
        countdown_elem.innerHTML = text;
        document.body.appendChild(countdown_elem);

        _countdown_elems.push(countdown_elem);
    };

    var _stopCameraTweening = function () {
        if (_camera_pos_tween) {
            _camera_pos_tween.stop();
        }

        if (_camera_rot_tween) {
            _camera_rot_tween.stop();
        }
    };

    var _updateLatency = function () {
        if (_game_state === _states.GAME || _game_state === _states.COUNTDOWN) {
            latency = _players[0].getLatency(_game_sync_rate);
            _latency_elem.innerHTML = "latency : " + parseInt(latency, 10) + "ms";
        }
    };

    var _showBannerAds = function () {
        if (typeof AdMob !== 'undefined') {
            //AdMob.removeBanner();
            AdMob.createBanner({
                adId: 'ca-app-pub-1083766519120767/6732001213',
                position: AdMob.AD_POSITION.BOTTOM_CENTER,
                autoShow: true,
                overlap: true,
                adSize: 'SMART_BANNER'
            });
        }
    };

    var _hideBannerAds = function () {
        if (typeof AdMob !== 'undefined') {
            AdMob.removeBanner();
        }
    };

    var _prepareFullAds = function () {
        if (typeof AdMob !== 'undefined') {
            AdMob.prepareInterstitial({
                adId: 'ca-app-pub-1083766519120767/5887475792',
                autoShow: false
            });
        }
    };

    var _showFullAds = function (probability) {
        if (typeof AdMob !== 'undefined') {
            if (probability !== undefined) {
                if (Math.random() < probability) {
                    AdMob.showInterstitial();
                } else {
                    return false;
                }
            } else {
                AdMob.showInterstitial();
            }

            return true;
        } else {
            if (typeof gdsdk !== 'undefined' && gdsdk.showBanner !== 'undefined') {
                gdsdk.showBanner();

                return true;
            }
        }

        return false;
    };

    var _switchGameState = function (game_state, data) {
        _engine.stop();

        var i = 0;

        if (game_state === _states.MENU) {
            //_prepareFullAds();
            //_showBannerAds();

            clearInterval(_notification_timeout);

            _music.volume(1.0, _curr_music);

            document.getElementById("score").innerHTML = "";

            _hideSettings();

            _single_player = false;

            _stopCameraTweening();

            _countdown.stop();
            _engine.stop();

            if (_ws) {
                _ws.close();
            }

            if (_player_bike) {
                _player_bike.remove();
            }

            for (i = 0; i < _players.length; i += 1) {
                _players[i].remove();
                
            }
            _players = [];

            _menu_elem.style.display = "block";
            _play_btn.style.display = "block";
            _play2_btn.style.display = "block";
            _settings_btn.style.display = "block";
            _waiting_elem.style.display = "none";
            _latency_elem.style.display = "none";
            _result_elem.style.display = "none";

            // presentation car (above logo)
            //if (window.innerWidth >= _mobile_width) {
                _player_bike = new Bike(_game_scene, _player_mesh, _cube_size, false, false, 0xFF0000, new THREE.Vector3(0, 1, 0));
                var mats = [];
                for (i = 0; i < _player_bike.mesh.children[0].material.length; i += 1) {
                    var mat_tmp = _player_bike.mesh.children[0].material[i];

                    mat_tmp = new THREE.MeshBasicMaterial({ color: mat_tmp.color, fog: false, depthTest: false, transparent: true });

                    // hide useless car parts
                    if (i !== 0 && i !== 4) {
                        mat_tmp.opacity = 0;
                    }

                    mats.push(mat_tmp);
                }
                _player_bike.mesh.children[0].material = mats;

                _player_bike.stop();
                _player_bike.mesh.position.y = 70;
                _player_bike.curr_direction = new THREE.Vector3(0, 0, 0);
                _player_bike.updateOrientation();
                _player_bike.mesh.scale.multiplyScalar(12.4);
            //}

            _game_camera.position.copy((new THREE.Vector3(0, 0, 1)).multiplyScalar(_game_camera_distance));
            _game_camera.lookAt(new THREE.Vector3(0, 0, 0));

            _players[0] = new Bike(_game_scene, _player_mesh, _cube_size, false, true, 0xFF0000, new THREE.Vector3(0, 0, -1));
            _players[1] = new Bike(_game_scene, _player_mesh, _cube_size, false, true, _trail_palette[1], new THREE.Vector3(0, 1, 0));
            _players[1].mesh.children[0].material = _remote_player_materials[1];
        } else if (game_state === _states.WAIT) {
            //_showBannerAds();

            _music.volume(1.0, _curr_music);

            _waiting_elem.style.display = "block";
            _play_btn.style.display = "none";
            _play2_btn.style.display = "none";
            _settings_btn.style.display = "none";
            _latency_elem.style.display = "none";
            _result_elem.style.display = "none";

            //_prepareFullAds();
        } else if (game_state === _states.COUNTDOWN) {
            //_hideBannerAds();

            clearInterval(_notification_timeout);

            _music.volume(0.25, _curr_music);

            _menu_elem.style.display = "none";
            _result_elem.style.display = "none";

            var score1, score2;

            for (i = 0; i < _players.length; i += 1) {
                _players[i].remove();

                score1 = _players[0].score;
            }
            _players = [];

            if (_player_bike) {
                _player_bike.remove();

                score2 = _player_bike.score;
            }

            _stopCameraTweening();

            var p1_cube_side,
                p2_cube_side;

            if (!data) {
                p1_cube_side = new THREE.Vector3(0, 0, 1);
                p2_cube_side = new THREE.Vector3(0, 0, -1);
            } else {
                p1_cube_side = data.cube_side;
                p2_cube_side = data.cube_side2;
            }

            _players[0] = new Bike(_game_scene, _player_mesh, _cube_size, false, true, _trail_palette[0], p2_cube_side);
            _players[0].mesh.children[0].material = _remote_player_materials[0];
            _players[0].score = score1;
            //_players[0].curr_direction = new THREE.Vector3(0, 0, 0);
            _players[0].stop();

            _player_bike = new Bike(_game_scene, _player_mesh, _cube_size, true, false, 0xFF0000, p1_cube_side);
            _player_bike.score = score2;

            _player_bike.stop();

            if (!data) { // single player
                _play_btn.style.display = "none";
                _play2_btn.style.display = "none";
                _settings_btn.style.display = "none";
                _players[0].auto.mode = 1;
            } else { // 2-player
                _players[0].curr_direction = data.direction2;
                _player_bike.curr_direction = data.direction;
                
                _players[0].updateOrientation();
                _player_bike.updateOrientation();
                _players[0].auto.enabled = false;
                
                _player_bike.onDirectionChange(function () {
                    _sendPosition(_player_bike.mesh.position, _player_bike.curr_direction, _player_bike.curr_cube_side);
                });

                _latency_elem.style.display = "block";
            }

            _game_camera.position.copy(p1_cube_side.clone().multiplyScalar(_game_camera_distance));
            _game_camera.lookAt(new THREE.Vector3(0, 0, 0));

            _countdown_elems.forEach(function (elem) {
                document.body.removeChild(elem);
            });

            _countdown_elems = [];
            _countdown_index = 0;

            _countdown_clock.start();

            _addCountdown(_countdown_content[_countdown_index]);

            _playSfx(_countdown);

            _updateScore();
        } else if (game_state === _states.GAME) {
            _updateScore();

            _player_bike.start();
            _players[0].start();

            _playSfx(_engine);
        } else if (game_state === _states.WIN_LOSE) {
            _result_elem.style.display = "block";

            var msg = "";

            if (_player_bike.score > _players[0].score) {
                msg = "You WIN!";
            } else {
                msg = "You LOSE!";
            }

            msg += '<br/><span style="font-size: 0.18em">Ready ? Click or tap here!</span>';

            _player_bike.score = 0;
            _players[0].score = 0;

            _result_elem.innerHTML = msg;

            _music.volume(1.0, _curr_music);

            //_prepareFullAds();
        }

        _game_state = game_state;
    };

    var _exitApp = function () {
        if (navigator.device) {
            navigator.device.exitApp();
        } else {
            window.close();
        }
    };

    var _onExit = function (e) {
        e.preventDefault();

        _switchGameState(_states.MENU);
    };

    var _adsPostProcess = function () {
        if (_adsState === 1) {
            _resultClick();
        } else if (_adsState === 2) {
            _singlePlayer();
        } else if (_adsState === 3) {
            _multiPlayer();
        }

        _adsState = 0;
    };

    /***********************************************************
        Init.
    ************************************************************/
/*
    if (typeof AdMob !== 'undefined') {
        AdMob.setOptions({
            isTesting: false,
            bgColor: 'black'
        });
    } else {
        window["GD_OPTIONS"] = {
            "gameId": "066c23bcf3f64c06a9081656af10ab37",
            "onEvent": function(event) {
                switch (event.name) {
                    case "SDK_GAME_START":
                        if (_settings.music) {
                            _music.stop(_curr_music);
                            _curr_music = _music.play();
                        }

                        _adsPostProcess();
                        break;
                    case "SDK_GAME_PAUSE":
                        if (_settings.music) {
                            _music.stop(_curr_music);
                        }
                        break;
                }
            },
        };
        (function(d, s, id) {
            var js, fjs = d.getElementsByTagName(s)[0];
            if (d.getElementById(id)) return;
            js = d.createElement(s);
            js.id = id;
            js.src = 'https://html5.api.gamedistribution.com/main.min.js';
            fjs.parentNode.insertBefore(js, fjs);
        }(document, 'script', 'gamedistribution-jssdk'));
    }
    
    _prepareFullAds();
*/
    _music = new Howl({
        src: ["data/kTron_intro.mp3", "data/kTron_intro.m4a"],
        autoplay: false,
        loop: true,
        volume: 1.0
    });

    _sfx = new Howl({
        src: ["data/hover.mp3", "data/hover.m4a"],
        autoplay: false,
        loop: false,
        volume: 1.0
    });

    _countdown = new Howl({
        src: ["data/countdown.mp3", "data/countdown.m4a"],
        autoplay: false,
        loop: false,
        volume: 0.5
    });

    _engine = new Howl({
        src: ["data/engine.mp3", "data/engine.m4a"],
        autoplay: false,
        loop: true,
        html5: false,
        volume: 1.0
    });

    _hit = new Howl({
        src: ["data/hit.mp3", "data/hit.m4a"],
        autoplay: false,
        loop: false,
        rate: 0.75,
        volume: 1.0
    });

    if (_settings.music) {
        _curr_music = _music.play();
    }

    _updateSettingsView();
    
    //setInterval(_updateLatency, 250);

    _play_btn.addEventListener("click", _onPlay);
    _play2_btn.addEventListener("click", _onPlay2);
    _settings_btn.addEventListener("click", _onSettings);
    _menu_btn.addEventListener("click", _onMenu);
    _mute_mus_btn.addEventListener("click", _onMuteMus);
    _mute_sfx_btn.addEventListener("click", _onMuteSfx);
    _mute_vib_btn.addEventListener("click", _onMuteVib);
    _result_elem.addEventListener("click", _onResult);

    document.addEventListener("backbutton", _onExit, false);
    document.addEventListener("menubutton", _onExit, false);
/*
    document.addEventListener('onAdFailLoad', function (data) {
        if (data.adType == 'banner') {
            AdMob.hideBanner();
        } else if (data.adType == 'interstitial') {
            interstitialIsReady = false;

            _adsPostProcess();
        }
    });

    document.addEventListener('onAdLeaveApp', function (data) {
        if (data.adType == 'interstitial') {
            _adsPostProcess();
        }
    });

    document.addEventListener('onAdDismiss', function (data) {
        if (data.adType == 'interstitial') {
            _adsPostProcess();
        }
    });
*/
    document.addEventListener('resume', function(){
        //_showFullAds();
    });
    
    // Game scene setup
    _game_scene = new THREE.Scene();
    _game_scene.fog = new THREE.Fog(0x000000, 0.0025, 450);

    // Game camera setup
    _game_camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
    _game_camera.position.z = _game_camera_distance;
    _game_camera.lookAt(new THREE.Vector3(0, 0, 0));
    _game_scene.add(_game_camera);
    
    // lighting
    var ambient_light = new THREE.AmbientLight(0xffffff, 1.0);
    _game_scene.add(ambient_light);
    var directional_light = new THREE.DirectionalLight(0xffffff, 0.8);
    directional_light.position.set(0, 0, -8).normalize();
    _game_scene.add(directional_light);

    var gr = new THREE.Group();
    _game_scene.add(gr);

    _initEnvironment(_game_scene, _cube_size);

    // load assets
    var loading_manager = new THREE.LoadingManager(function () {
        var screen_width = Math.min(window.innerWidth, window.outerWidth);
        var screen_height = Math.min(window.innerHeight, window.outerHeight);

        // initialize rendering
        _game_renderer = new THREE.WebGLRenderer({
            antialias: false,
            stencil: false,
            powerPreference: "high-performance",
            sortObjects: false,
            toneMapping: THREE.NoToneMapping
        });
        _game_renderer.setPixelRatio(window.devicePixelRatio);
        _game_renderer.setSize(screen_width, screen_height);

        var render_pass = new THREE.RenderPass(_game_scene, _game_camera);

        // background
        _postfx.background = new THREE.ShaderPass(THREE.SpaceShader);
        _postfx.background.renderToScreen = false;

        // postfx
        _postfx.post = new THREE.ShaderPass(THREE.SuperShader);
        _postfx.post.renderToScreen = false;

        // bloom
        _postfx.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(screen_width, screen_height), 0.85, 0., 0.);
        _postfx.bloom.renderToScreen = false;

        // noise
        _postfx.noise = new THREE.ShaderPass(THREE.NoiseShader);
        _postfx.noise.renderToScreen = true;

        _game_composer = new THREE.EffectComposer(_game_renderer);
        _game_composer.setSize(screen_width, screen_height);
        _game_composer.addPass(render_pass);
        _game_composer.addPass(_postfx.background);
        _game_composer.addPass(_postfx.post);
        _game_composer.addPass(_postfx.bloom);
        _game_composer.addPass(_postfx.noise);
        
        _explosion_particles = new ExplosionParticles(_game_scene);

        // everything is ready; add canvas to DOM
        document.body.appendChild(_game_renderer.domElement);

        window.addEventListener('resize', _onWindowResize, false);
        window.addEventListener('fullscreenchange', _onWindowResize, false);

        window.addEventListener("keydown", _onKeyDown, false);
        
        requestAnimationFrame(_animate);

        _switchGameState(_states.MENU);

        _curtain.classList.add("fade-out");

        _onWindowResize();
    });

    // load player model
    var dae_loader = new THREE.ColladaLoader(loading_manager);
    dae_loader.load('data/Car.dae', function (collada) {
        var mat_tmp;

        _player_mesh = collada.scene;

        // replace mesh light material by a more basic one
        for (i = 0; i < _player_mesh.children[0].material.length; i += 1) {
            mat_tmp = _player_mesh.children[0].material[i];

            mat_tmp = new THREE.MeshBasicMaterial({ color: mat_tmp.color, fog: true });
            _player_mesh.children[0].material[i] = mat_tmp;

            for (var j = 0; j < _trail_palette.length; j += 1) {
                var mat_tmp2;
                if (mat_tmp.color.equals(new THREE.Color(0xff0000))) {
                    mat_tmp2 = new THREE.MeshBasicMaterial({ color: new THREE.Color(_trail_palette[j]), fog: true });
                } else {
                    mat_tmp2 = new THREE.MeshBasicMaterial({ color: mat_tmp.color, fog: true });
                }

                if (!_remote_player_materials[j]) {
                    _remote_player_materials[j] = [];
                }
                
                _remote_player_materials[j].push(mat_tmp2);
            }
        }
    });
};

if (typeof AdMob !== 'undefined') {
    document.addEventListener("deviceready", kTron, false);
} else {
    docReady(kTron);
}