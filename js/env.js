/***********************************************************
    Fields.
************************************************************/

var _sky_mesh,
    _quad_particles,
    _cross_obj = [];

/***********************************************************
    Functions.
************************************************************/

var _createWireQuadMesh = function (scale, material) {
    var geometry = new THREE.BufferGeometry();
    var vertices = new Float32Array([
        -0.5, 0.5, -0.5,
        -0.5, -0.5, -0.5,
        0.5, -0.5, -0.5,
        0.5, 0.5, -0.5,
        -0.5, 0.5, -0.5,
    ]);
    vertices = vertices.map(function (v) {
        return scale * v;
    });
    geometry.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
    return new THREE.Line(geometry, material);
};
  
var _initEnvironment = function (scene, cube_size) {
    var sky_geom,
        sky_texture,
        line_material,

        i = 0;

    // create a wireframed cube mesh
    line_material = new THREE.LineBasicMaterial( {
        color: 0x8c1eff,
        linewidth: 2,
        fog: true
    });

    var wire_quad_mesh,
        quad_step = 0,
        cube_subdivisions = 4;
    cube_size -= 4;

    for (i = 0; i < cube_subdivisions; i += 1) {
        quad_step = i * (cube_size / (cube_subdivisions - 1));

        wire_quad_mesh = _createWireQuadMesh(cube_size, line_material);
        wire_quad_mesh.position.z += quad_step;
        scene.add(wire_quad_mesh);

        wire_quad_mesh = _createWireQuadMesh(cube_size, line_material);
        wire_quad_mesh.rotation.x = Math.PI / 2;
        wire_quad_mesh.position.y -= quad_step;
        scene.add(wire_quad_mesh);

        if (i !== 0 && i !== (cube_subdivisions - 1)) {
            wire_quad_mesh = _createWireQuadMesh(cube_size, line_material);
            wire_quad_mesh.rotation.y = Math.PI / 2;
            wire_quad_mesh.position.x += quad_step;
            scene.add(wire_quad_mesh);            
        }
    }

    // skydome setup
    sky_geom = new THREE.SphereGeometry(2000, 25, 25);
    sky_texture = new THREE.TextureLoader().load('data/background.jpg');
    sky_texture.wrapS = THREE.RepeatWrapping;
    sky_texture.wrapT = THREE.RepeatWrapping;
    sky_texture.repeat.set(12, 12);
    sky_texture.anisotropy = 2;
    sky_material = new THREE.MeshBasicMaterial({ 
        map: sky_texture,
        fog: false,
        side: THREE.BackSide
    });
    _sky_mesh = new THREE.Mesh(sky_geom, sky_material);
    scene.add(_sky_mesh);

    // cube vertices intersection meshes
    /*
    cross_obj_material = new THREE.MeshBasicMaterial({ wireframe: true, color: 0xffff00, fog: true });//new THREE.MeshLambertMaterial({ wireframe: false, color: 0xffff00, fog: true });
    cross_obj_geom = new THREE.CubeGeometry(1, 1, 1, 1, 1, 1);

    for (i = 0; i < geom.faces.length; i += 1) {
        var vert = [geom.faces[i].a, geom.faces[i].b, geom.faces[i].c];

        var j = 0;
        for (j = 0; j < vert.length; j += 1) {
            var geom_vertices = geom.vertices[vert[j]].clone();
            var face_normal = geom.faces[i].normal;

            cross_obj_mesh = new THREE.Mesh(cross_obj_geom, cross_obj_material);
            cross_obj_mesh.position.x = geom_vertices.x;
            cross_obj_mesh.position.y = geom_vertices.y;
            cross_obj_mesh.position.z = geom_vertices.z;

            cross_obj_mesh.scale.x = cross_obj_mesh.scale.y = cross_obj_mesh.scale.z = 4;

            //cross_obj_mesh.rotation.x = Tools.randomRange(-Math.PI / 2, Math.PI / 2);
            //cross_obj_mesh.rotation.y = Tools.randomRange(-Math.PI / 2, Math.PI / 2);
            //cross_obj_mesh.rotation.z = Tools.randomRange(-Math.PI / 2, Math.PI / 2);
            
            //cross_obj_mesh.renderOrder = 0;

            //cross_obj_mesh.lookAt(cross_obj_mesh.position.clone().add(face_normal.clone()));
            //cross_obj_mesh.rotation.x = Math.PI / 2;

            _cross_obj[i] = cross_obj_mesh;

            scene.add(cross_obj_mesh);
        }
    }
    */
    
   _quad_particles = new _quadParticles(300);
   _quad_particles.init(gr);
};

var _animateEnvironment = function (camera, player_mesh) {
    var i = 0,
        norm_i,
        cross_obj,
        cross_obj_distance;

    _sky_mesh.position.set(camera.position.x, camera.position.y, camera.position.z);
/*
    for (i = 0; i < _cross_obj.length; i += 1) {
        norm_i = i / _cross_obj.length;

        cross_obj = _cross_obj[i];

        cross_obj_distance = (1. - player_mesh.mesh.position.clone().normalize().distanceTo(cross_obj.position.clone().normalize())) * 4;

        cross_obj.scale.x = 0.5 + cross_obj_distance;
        cross_obj.scale.y = 0.5 + cross_obj_distance;
        cross_obj.scale.z = 0.5 + cross_obj_distance;
        cross_obj.rotation.x += 0.01 * (0.5 + norm_i);
        cross_obj.rotation.y += 0.02 * (0.5 + norm_i);
        cross_obj.updateMatrix();
    }*/

    _quad_particles.update();
};