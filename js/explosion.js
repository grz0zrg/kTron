var _MAX_PARTICLES = 30,
    _pdirs = [],
    _pspeed = 40,
    _psize = 10,
    _psize_randomness = 4000,
    _pcolors = [0xFF0000];//[0xFF0FFF, 0xCCFF00, 0xFF000F, 0x996600, 0xFFFFFF];

var ExplosionParticles = function (scene) {
    var geometry = new THREE.Geometry();

    var material = new THREE.PointsMaterial({
        size: _psize,
        color: _pcolors[Math.round(Math.random() * (_pcolors.length-1))]
    });

    var particles = new THREE.Points(geometry, material);
    
    this.object = particles;
    this.status = false;
    this.clock = new THREE.Clock();
    
    this.xDir = (Math.random() * _pspeed) - (_pspeed / 2);
    this.yDir = (Math.random() * _pspeed) - (_pspeed / 2);
    this.zDir = (Math.random() * _pspeed) - (_pspeed / 2);
    
    scene.add(this.object);
    
    this.update = function () {
        if (this.status == true && this.object.geometry.vertices.length > 0) {
            var i = 0;
                
            for (i = 0; i < _MAX_PARTICLES; i += 1) {
                var particle = this.object.geometry.vertices[i]
                particle.y += _pdirs[i].y;
                particle.x += _pdirs[i].x;
                particle.z += _pdirs[i].z;
            }

            this.object.geometry.verticesNeedUpdate = true;

            if (this.clock.getElapsedTime() > 3000) {
                this.status = false;
            }
        }
    }

    this.start = function (pos, color) {
        var geometry = new THREE.Geometry();
        var i = 0;

        _pdirs = [];

        for (i = 0; i < _MAX_PARTICLES; i += 1) {
            var vertex = new THREE.Vector3();
            vertex.x = pos.x;
            vertex.y = pos.y;
            vertex.z = pos.z;
        
            geometry.vertices.push(vertex);
            _pdirs.push({
                x: (Math.random() * _pspeed) - (_pspeed / 2), y: (Math.random() * _pspeed) - (_pspeed / 2), z: (Math.random() * _pspeed) - (_pspeed / 2)
            });
        }

        var material = new THREE.PointsMaterial({
            size: _psize,
            color: (color !== undefined) ? color : _pcolors[Math.round(Math.random() * (_pcolors.length - 1))]
        });

        this.object.geometry = geometry;
        this.object.material = material;

        this.clock = new THREE.Clock();

        this.status = true;
    }
};