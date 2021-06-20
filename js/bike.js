function Bike(scene, mesh, world_size, is_player, auto_play, trail_color, start_side) {
    this.vel = _COMMON_CONFIG.velocity;

    // allowed directions per faces
    this.cube_directions = {
        xy: new THREE.Vector3(1, 1, 0),
        yz: new THREE.Vector3(0, 1, 1),
        xz: new THREE.Vector3(1, 0, 1)
    };

    this.mesh = mesh.clone();

    if (is_player) {
        this.mesh.renderOrder = 1;
    }

    // for AI, usefull when switching sides
    this.force_direction_check = false;

    // current cube face -1/1
    /*
        this is the only thing that need to be changed to place the car on an arbitrary face, note that only one axis should be set
        X = left/right, Y = top/bottom, Z = front/back (assuming camera is facing front)
    */
    this.curr_cube_side = new THREE.Vector3(0, 0, 1);

    // currently allowed directions
    this.curr_allowed_directions = this.cube_directions.xy;

    // current direction
    this.curr_direction = new THREE.Vector3(this.vel, 0, 0);
    this.prev_direction = new THREE.Vector3();

    // a list of positions (used for interpolation / guided mode)
    this.positions = [];

    // basically cube size
    this.world_size = world_size;
    this.world_size_d2 = world_size / 2;

    this.score = 0;

    // mesh position
    this.mesh.position.z = this.world_size_d2;

    if (!start_side) {
        start_side = new THREE.Vector3(0, 0, 1);
    }

    // this update all above
    this.startPosition(start_side);

    this.is_player = is_player;

    this.scene = scene;
    this.mesh.children[0].geometry.computeBoundingBox();

    // camera state (player only)
    this.tween_state = {
        rotate: false,
        translate: false,
        complete: true
    };

    // mesh setup
    this.mesh.scale.x = this.mesh.scale.y = this.mesh.scale.z = 4;
    this.mesh.updateMatrix();

    this.mesh.userData.wbbox = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0));

    this.world_bbox = null;
    
    scene.add(this.mesh);

    this.ai_last_dir_change = new THREE.Clock();

    // trail setup
    this.trail = {
        scale: 1,
        queue: [],
        color: trail_color
    };

    this.auto = {
        enabled: auto_play,
        mode: 0, // 0 = dumb (random direction), 1 = simple AI (distance based heuristic with variable rate)
        clock: new THREE.Clock(),
        next: null,
        follow: false
    };

    this.alpha = 0;

    this.on_direction_change = null;

    this.stopped = false;

    this.updateAutoMode();

    this.updateOrientation();

    this.prev_position = this.mesh.position.clone();

    this.delta_local = null;
}

Bike.prototype.onDirectionChange = function (cb) {
    this.on_direction_change = cb;
}

Bike.prototype.pushPosition = function (delta, position, direction, cube_side) {
    if (this.delta_local === null) {
        this.delta_local = performance.now();
    }
    
    if (this.positions.length < 1000) {
        this.positions.push({
            delta: delta,
            delta_local: Math.abs(performance.now() - this.delta_local),
            position: position,
            direction: direction,
            cube_side: cube_side
        });
    } else { // flush
        this.positions = [];
    }

    this.delta_local = performance.now();
}

// see constructor for more informations, arguments is cube side
Bike.prototype.startPosition = function (cube_side) {
    var x = cube_side.x,
        y = cube_side.y,
        z = cube_side.z;
    
    this.curr_cube_side = new THREE.Vector3(x, y, z);

    if (x) {
        this.curr_allowed_directions = this.cube_directions.yz;
        this.mesh.position.x = this.world_size_d2 * x;
        this.mesh.position.y = 0;
        this.mesh.position.z = 0;
    } else if (y) {
        this.curr_allowed_directions = this.cube_directions.xz;
        this.mesh.position.x = 0;
        this.mesh.position.y = this.world_size_d2 * y;
        this.mesh.position.z = 0;
    } else if (z) {
        this.curr_allowed_directions = this.cube_directions.xy;
        this.mesh.position.x = 0;
        this.mesh.position.y = 0;
        this.mesh.position.z = this.world_size_d2 * z;
    }

    this.curr_direction = this.newDirection();
    this.prev_direction = new THREE.Vector3();
}

Bike.prototype.remove = function () {
    var i = 0;
    for (i = this.trail.queue.length - 1; i >= 0; i -= 1) {
        this.scene.remove(this.trail.queue[i]);
    }

    this.trail.queue = [];

    this.scene.remove(this.mesh);
}

Bike.prototype.start = function () {
    this.stopped = false;

    this.prev_direction = this.curr_direction.clone().negate();
}

Bike.prototype.stop = function () {
    this.stopped = true;
}

Bike.prototype.onKeyDown = function (ev) {
    if (!this.tween_state.complete) {
        return;
    }

    var key = ev.key;

    var cube_side = this.curr_cube_side;

    var dir = null;
    var prev_dir = this.prev_direction.clone();

    if (key === "ArrowLeft" || key === "Left") {
        if (this.curr_allowed_directions === this.cube_directions.xy) {
            dir = new THREE.Vector3(-this.vel, 0, 0).multiplyScalar(cube_side.z);
        } else if (this.curr_allowed_directions === this.cube_directions.xz) {
            dir = new THREE.Vector3(-this.vel, 0, 0);
        } else if (this.curr_allowed_directions === this.cube_directions.yz) {
            if (cube_side.x > 0) {
                dir = new THREE.Vector3(0, 0, this.vel);
            } else {
                dir = new THREE.Vector3(0, 0, -this.vel);
            }
        }
    } else if (key === "ArrowRight" || key === "Right") {
        if (this.curr_allowed_directions === this.cube_directions.xy) {
            dir = new THREE.Vector3(this.vel, 0, 0).multiplyScalar(cube_side.z);
        } else if (this.curr_allowed_directions === this.cube_directions.xz) {
            dir = new THREE.Vector3(this.vel, 0, 0);
        } else if (this.curr_allowed_directions === this.cube_directions.yz) {
            if (cube_side.x > 0) {
                dir = new THREE.Vector3(0, 0, -this.vel);
            } else {
                dir = new THREE.Vector3(0, 0, this.vel);
            }
        }
    } else if (key === "ArrowUp" || key === "Up") {
        if (this.curr_allowed_directions === this.cube_directions.xy) {
            dir = new THREE.Vector3(0, this.vel, 0);
        } else if (this.curr_allowed_directions === this.cube_directions.yz) {
            dir = new THREE.Vector3(0, this.vel, 0);
        } else if (this.curr_allowed_directions === this.cube_directions.xz) {
            if (cube_side.y > 0) {
                dir = new THREE.Vector3(0, 0, -this.vel);
            } else {
                dir = new THREE.Vector3(0, 0, this.vel);
            }
        }
    } else if (key === "ArrowDown" || key === "Down") {
        if (this.curr_allowed_directions === this.cube_directions.xy) {
            dir = new THREE.Vector3(0, -this.vel, 0);
        } else if (this.curr_allowed_directions === this.cube_directions.yz) {
            dir = new THREE.Vector3(0, -this.vel, 0);
        } else if (this.curr_allowed_directions === this.cube_directions.xz) {
            if (cube_side.y > 0) {
                dir = new THREE.Vector3(0, 0, this.vel);
            } else {
                dir = new THREE.Vector3(0, 0, -this.vel);
            }
        }
    } else {
        return;
    }
    
    // apply new direction only if different than the previous one
    if (!dir.equals(prev_dir.clone().negate()) && !dir.equals(prev_dir)) {
        this.curr_direction = dir;
        this.addTrail();

        if (this.on_direction_change) {
            this.on_direction_change();
        }
    }
};

// logic handler; switching cube face when going on edges
Bike.prototype.checkWorldBoundaries = function () {
    var world_size_d2 = this.world_size_d2;

    var cube_side = this.curr_cube_side;

    var pos_x = this.mesh.position.x + this.curr_direction.x;
    var pos_y = this.mesh.position.y + this.curr_direction.y;
    var pos_z = this.mesh.position.z + this.curr_direction.z;

    this.prev_direction = this.curr_direction.clone();
 
    if (this.curr_allowed_directions === this.cube_directions.xy) {
        if (pos_x > world_size_d2) {
            this.curr_allowed_directions = this.cube_directions.yz;

            this.curr_direction = new THREE.Vector3(0, 0, -this.vel).multiplyScalar(cube_side.z);

            cube_side = new THREE.Vector3(1, 0, 0);
        } else if (pos_y > world_size_d2) {
            this.curr_allowed_directions = this.cube_directions.xz;

            this.curr_direction = new THREE.Vector3(0, 0, -this.vel).multiplyScalar(cube_side.z);
            
            cube_side = new THREE.Vector3(0, 1, 0);
        } else if (pos_x < -world_size_d2) {
            this.curr_allowed_directions = this.cube_directions.yz;

            this.curr_direction = new THREE.Vector3(0, 0, -this.vel).multiplyScalar(cube_side.z);

            cube_side = new THREE.Vector3(-1, 0, 0);
        } else if (pos_y < -world_size_d2) {
            this.curr_allowed_directions = this.cube_directions.xz;

            this.curr_direction = new THREE.Vector3(0, 0, -this.vel).multiplyScalar(cube_side.z);

            cube_side = new THREE.Vector3(0, -1, 0);
        }
    } else if (this.curr_allowed_directions === this.cube_directions.yz) {
        if (pos_z > world_size_d2) {
            this.curr_allowed_directions = this.cube_directions.xy;

            this.curr_direction = new THREE.Vector3(-this.vel, 0, 0).multiplyScalar(cube_side.x);

            cube_side = new THREE.Vector3(0, 0, 1);
        } else if (pos_y > world_size_d2) {
            this.curr_allowed_directions = this.cube_directions.xz;

            this.curr_direction = new THREE.Vector3(-this.vel, 0, 0).multiplyScalar(cube_side.x);

            cube_side = new THREE.Vector3(0, 1, 0);
        } else if (pos_z < -world_size_d2) {
            this.curr_allowed_directions = this.cube_directions.xy;

            this.curr_direction = new THREE.Vector3(-this.vel, 0, 0).multiplyScalar(cube_side.x);

            cube_side = new THREE.Vector3(0, 0, -1);
        } else if (pos_y < -world_size_d2) {
            this.curr_allowed_directions = this.cube_directions.xz;

            this.curr_direction = new THREE.Vector3(-this.vel, 0, 0).multiplyScalar(cube_side.x);

            cube_side = new THREE.Vector3(0, -1, 0);
        }
    } else if (this.curr_allowed_directions === this.cube_directions.xz) {
        if (pos_z > world_size_d2) {
            this.curr_allowed_directions = this.cube_directions.xy;

            this.curr_direction = new THREE.Vector3(0, -this.vel, 0).multiplyScalar(cube_side.y);

            cube_side = new THREE.Vector3(0, 0, 1);
        } else if (pos_x > world_size_d2) {
            this.curr_allowed_directions = this.cube_directions.yz;

            this.curr_direction = new THREE.Vector3(0, -this.vel, 0).multiplyScalar(cube_side.y);

            cube_side = new THREE.Vector3(1, 0, 0);
        } else if (pos_z < -world_size_d2) {
            this.curr_allowed_directions = this.cube_directions.xy;

            this.curr_direction = new THREE.Vector3(0, -this.vel, 0).multiplyScalar(cube_side.y);

            cube_side = new THREE.Vector3(0, 0, -1);
        } else if (pos_x < -world_size_d2) {
            this.curr_allowed_directions = this.cube_directions.yz;

            this.curr_direction = new THREE.Vector3(0, -this.vel, 0).multiplyScalar(cube_side.y);

            cube_side = new THREE.Vector3(-1, 0, 0);
        }
    }

    this.curr_cube_side = cube_side;
}

// add a trail (a cube scaled/positioned appropriatly)
Bike.prototype.addTrail = function () {
    var cube_geom,
        trail_mat,
        trail_mesh;

    cube_geom = new THREE.CubeGeometry(this.trail.scale, this.trail.scale, this.trail.scale, 1, 1, 1);
    cube_geom.computeBoundingBox();
    trail_mat = new THREE.MeshBasicMaterial({ wireframe: false, color: this.trail.color, fog: true, transparent: true });
    trail_mesh = new THREE.Mesh(cube_geom, trail_mat);
    trail_mesh.position.set(this.mesh.position.x, this.mesh.position.y, this.mesh.position.z);
    //trail_mesh.position.add(this.curr_cube_side.clone().negate().multiplyScalar(2));

    trail_mesh.userData.wbbox = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0));

    this.scene.add(trail_mesh);
    this.trail.queue.push(trail_mesh);
};

// trail handler
Bike.prototype.updateTrail = function (trail_add_size) {
    if (this.trail.queue.length === 0) {
        return;
    }

    var trail_queue = this.trail.queue,
        curr_trail_mesh = trail_queue[trail_queue.length - 1],
        i = 0;

    if (trail_add_size) { // on provided vector (for remote players)
        curr_trail_mesh.scale.add(trail_add_size);
        curr_trail_mesh.position.add(trail_add_size.clone().divideScalar(2));
    } else { // automatic (bots & player)
        curr_trail_mesh.scale.add(this.curr_direction);
        curr_trail_mesh.position.add(this.curr_direction.clone().divideScalar(2));       
    }

    curr_trail_mesh.updateMatrixWorld(true);
    curr_trail_mesh.userData.wbbox = curr_trail_mesh.geometry.boundingBox.clone().applyMatrix4(curr_trail_mesh.matrixWorld);

    // dim trails & progressive cleanup
    for (i = trail_queue.length - 2; i >= 0; i -= 1) {
        curr_trail_mesh = trail_queue[i];
        curr_trail_mesh.material.opacity -= (1. - curr_trail_mesh.material.opacity + 0.001) * 0.0175 * _game_delta;

        if (curr_trail_mesh.material.opacity <= 0) {
            this.scene.remove(curr_trail_mesh);
            trail_queue.splice(i, 1);         
        }
    }
}

// return a random direction
Bike.prototype.newDirection = function () {
    var tmp_arr = [];
    if (this.curr_allowed_directions.x) {
        tmp_arr.push(0);
    }

    if (this.curr_allowed_directions.y) {
        tmp_arr.push(1);
    }

    if (this.curr_allowed_directions.z) {
        tmp_arr.push(2);
    }

    tmp_arr = Tools.shuffle(tmp_arr);

    var new_dir = new THREE.Vector3(0, 0, 0);
    new_dir.setComponent(tmp_arr[0], this.vel * (Math.ceil((Math.random() - 0.5) * 2) < 1 ? -1 : 1));

    return new_dir;
}

// Simple "AI" (dumb random auto mode)
Bike.prototype.updateAutoMode = function () {
    if (this.auto.enabled && this.auto.mode === 0) {
        if (this.auto.next === null || this.auto.clock.getElapsedTime() > this.auto.next) {
            this.auto.clock.start();
            this.auto.next = 0.5 + Math.random() * 3;

            this.curr_direction = this.newDirection();
            while (this.curr_direction.equals(this.prev_direction) || this.curr_direction.equals(this.prev_direction.clone().negate())) {
                this.curr_direction = this.newDirection();
            }
        }
    }
};

// check if direction is free or return distance from obstacle
Bike.prototype.checkDirection = function (collide_meshes_arr, position, direction) {
    var objects = collide_meshes_arr.concat(this.trail.queue);

    var dirs = this.getAllowedCurrentDirection();

    var direction1 = dirs[0].multiplyScalar(5);
    var direction2 = dirs[1].multiplyScalar(5);

    var dir = direction.clone().normalize();

    var raycaster = new THREE.Raycaster(position, dir);
    var intersects = raycaster.intersectObjects(objects, false);

    // we also raycast from car sides (to allow detection from sides)
    var raycaster_side1 = new THREE.Raycaster(position.clone().add(direction1), dir);
    var intersects_side1 = raycaster_side1.intersectObjects(objects, false);

    var raycaster_side2 = new THREE.Raycaster(position.clone().add(direction2), dir);
    var intersects_side2 = raycaster_side2.intersectObjects(objects, false);

    if (intersects.length > 0) {
        return intersects[0].distance;
    } else {
        if (intersects_side1.length > 0) {
            return intersects_side1[0].distance;
        } else {
            if (intersects_side2.length > 0) {
                return intersects_side2[0].distance;
            } else {
                return -1;
            }
        }
    }
};

Bike.prototype.getCubeSidePosition = function (direction, position) {
    var inv_direction = new THREE.Vector3(!direction.x, !direction.y, !direction.z);
    return inv_direction.multiply(position).add(direction.clone().normalize().multiplyScalar(this.world_size_d2));
};

Bike.prototype.getAllowedCurrentDirection = function () {
    var vec3_index = 0;
    if (this.cube_directions.xy === this.curr_allowed_directions) {
        if (this.curr_direction.x > 0 || this.curr_direction.x < 0) {
            vec3_index = 1;
        }
    } else if (this.cube_directions.yz === this.curr_allowed_directions) {
        if (this.curr_direction.y > 0 || this.curr_direction.y < 0) {
            vec3_index = 2;
        } else {
            vec3_index = 1;
        }
    } else if (this.cube_directions.xz === this.curr_allowed_directions) {
        if (this.curr_direction.x > 0 || this.curr_direction.x < 0) {
            vec3_index = 2;
        }
    }

    var direction1 = new THREE.Vector3();
    var direction2 = new THREE.Vector3();

    direction1.setComponent(vec3_index, 1);
    direction2.setComponent(vec3_index, -1);

    return [direction1, direction2];
}

// handle AI (auto mode with direction / distance based heuristic)
Bike.prototype.aiUpdate = function (collide_meshes_arr) {
    if ((this.auto.next === null || this.auto.clock.getElapsedTime() > this.auto.next || this.force_direction_check) && this.ai_last_dir_change.getElapsedTime() > 0.1) {
        this.auto.next = 0.001 + Math.random() * 0.01;
    
        // check obstacle forward
        var distance_front = this.checkDirection(collide_meshes_arr, this.mesh.position, this.curr_direction);

        // do a check of the other side of the cube
        if (distance_front < 0) {
            var side_position = this.getCubeSidePosition(this.curr_direction, this.mesh.position);

            var direction;

            if (this.cube_directions.xy === this.curr_allowed_directions) {
                if (this.curr_cube_side.z > 0) {
                    direction = new THREE.Vector3(0, 0, -1);
                } else {
                    direction = new THREE.Vector3(0, 0, 1);
                }
            } else if (this.cube_directions.yz === this.curr_allowed_directions) {
                if (this.curr_cube_side.x > 0) {
                    direction = new THREE.Vector3(-1, 0, 0);
                } else {
                    direction = new THREE.Vector3(1, 0, 0);
                }
            } else if (this.cube_directions.xz === this.curr_allowed_directions) {
                if (this.curr_cube_side.y > 0) {
                    direction = new THREE.Vector3(0, -1, 0);
                } else {
                    direction = new THREE.Vector3(0, 1, 0);
                }
            }

            distance_front = this.checkDirection(collide_meshes_arr, side_position, direction);

            // and another side...
            if (distance_front < 0) {
                side_position = this.getCubeSidePosition(direction, side_position);

                distance_front = this.checkDirection(collide_meshes_arr, side_position, this.curr_direction.clone().negate());
            }
        }

        var new_direction = false;
        
        if ((distance_front >= 0 && distance_front < 30)) {
            new_direction = true;
        } else if (distance_front < 0) {
            /*if (Math.random() >= 0.95) {
                new_direction = true;
            }*/
        } else if (Math.random() > Math.max(0., 0.8 - (distance_front / (this.world_size * 2 + this.world_size)))) {
            new_direction = true;
        }

        // now check & chose the new direction (sides)
        if (new_direction) {
            var dirs = this.getAllowedCurrentDirection();

            var direction1 = dirs[0];
            var direction2 = dirs[1];

            var distance1 = this.checkDirection(collide_meshes_arr, this.mesh.position, direction1);
            var distance2 = this.checkDirection(collide_meshes_arr, this.mesh.position, direction2);
        
            direction1.multiplyScalar(this.vel);
            direction2.multiplyScalar(this.vel);

            if (distance1 > distance_front && distance2 > distance_front) {
                this.auto.next = 0.001 + Math.random() * 0.01;
                return;
            }/* else if (distance1 < 20 && distance2 < 20) {
                this.auto.next = 0.01 + Math.random() * 0.02;
            }*/

            if (distance1 > distance2 || (distance1 < 0 && distance2 >= 0)) {
                this.curr_direction = direction2;
            } else if (distance1 < distance2 || (distance2 < 0 && distance1 >= 0)) {
                this.curr_direction = direction1;
            } else {
                if (Math.random() > 0.5) {
                    this.curr_direction = direction1;
                } else {
                    this.curr_direction = direction2;
                }
            }

            this.ai_last_dir_change.start();

            this.addTrail();
        }

        this.auto.clock.start();

        this.force_direction_check = false;
    }
};

// collision detection from bounding boxes (note : world bounding box is pre-computed inside meshes userData)
Bike.prototype.detectCollision = function (bikes) {
/*
    if (!this.tween_state.complete) {
        return false;
    }
*/
    var i = 0,
        j = 0;

    for (j = 0; j < bikes.length; j += 1) {
        var meshes = [bikes[j].mesh];

        for (i = 0; i < bikes[j].trail.queue.length; i += 1) {
            meshes.push(bikes[j].trail.queue[i]);
        }

        for (i = 0; i < meshes.length; i += 1) {
            if (this.mesh.userData.wbbox.intersectsBox(meshes[i].userData.wbbox)) {
                if (i === 0) {
                    return 1;
                } else {
                    return 2;
                }
            }
        }
    }

    // check on self trails (note : ignore the current & previous one so we don't hit it)
    for (i = 0; i < this.trail.queue.length - 3; i += 1) {
        if (this.mesh.userData.wbbox.intersectsBox(this.trail.queue[i].userData.wbbox)) {
            return 2;
        }
    }

    return 0;
}

Bike.prototype.updateOrientation = function () {
    var bike_mesh = this.mesh;

    bike_mesh.up = this.curr_cube_side;
    bike_mesh.lookAt(bike_mesh.position.clone().add(this.curr_direction));
    bike_mesh.rotateX(-Math.PI / 2);
}

Bike.prototype.getLatency = function (sync_rate) {
    var latency = 0;
    if (this.positions.length > 1) {
        latency = Math.abs(this.positions[0].delta_local - sync_rate * 1000);
    }

    return latency;
}

Bike.prototype.update = function (camera, camera_distance, sync_rate) {
    var i = 0;

    if (this.stopped) {
        return;
    }
    
    // add at least one trail
    if (this.trail.queue.length <= 0) {
        this.addTrail();
    }

    var bike_mesh = this.mesh;

    this.checkWorldBoundaries();

    this.updateAutoMode();

    // handle remote players
    if (this.positions.length > 0) {
        var target_data = this.positions[0];

        var latency = target_data.delta_local - target_data.delta;
        var diff_position = bike_mesh.position.clone();

        if (latency < (sync_rate * 1000)) {
            this.alpha += 1 / ((sync_rate * 1000 - (Math.min(latency, sync_rate * 1000))) / (1 / 60 * 1000));
        } else {
            this.alpha = 1;
        }
        
        bike_mesh.position.lerpVectors(this.prev_position, target_data.position, Math.max(Math.min(this.alpha, 1.), 0.));

        this.updateTrail(this.curr_direction.clone().normalize().multiplyScalar(diff_position.manhattanDistanceTo(bike_mesh.position)));
        
        if (this.alpha >= 1) {
            this.positions.splice(0, 1);

            this.alpha = 0;
            //this.alpha -= 1;

            this.curr_direction = target_data.direction;
            this.curr_cube_side = target_data.cube_side;

            this.prev_position = target_data.position.clone();

            bike_mesh.position.copy(target_data.position);
        }
    }

    // move camera when switching faces
    if (!this.curr_direction.equals(this.prev_direction)) {
        if (this.is_player || this.auto.follow) {
            this.tween_state = _moveThenLookAt(camera, this.curr_cube_side.clone().multiplyScalar(camera_distance), new THREE.Vector3());
        }

        if (this.on_direction_change) {
            this.on_direction_change();

            this.force_direction_check = true;
        }

        this.addTrail();
    }

    // update position / camera tracking
    if (this.is_player || this.auto.follow) {
        bike_mesh.position.add(this.curr_direction);
        
        if (this.tween_state.complete) {
            camera.position.x = camera.position.x + (this.curr_direction.x / 2);
            camera.position.y = camera.position.y + (this.curr_direction.y / 2);
            camera.position.z = camera.position.z + (this.curr_direction.z / 2);
        }

        this.updateTrail();
    } else if (this.auto.enabled) {
        bike_mesh.position.add(this.curr_direction);

        this.updateTrail();
    }

    this.updateOrientation();

    // update bbox (note : scaled along the cube face normal so that it collide with trails/rays below)
    bike_mesh.updateMatrixWorld(true);
    bike_mesh.userData.wbbox = bike_mesh.children[0].geometry.boundingBox.clone().applyMatrix4(bike_mesh.matrixWorld)/*.expandByVector(this.curr_cube_side.clone().multiplyScalar(4))*/;
};