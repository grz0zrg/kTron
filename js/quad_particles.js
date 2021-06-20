var noise = new SimplexNoise();

var _quadParticles = function (BOUNDS) {
	var num_quads = 30;
	var holder;
	var sa = [];

	this.init = function(parent){
		holder = new THREE.Group();

		for(var i = 0; i < num_quads; i += 1) {

			s = new _quadParticle(BOUNDS);
			var pos = Tools.randomVector3(BOUNDS);
			s.init(holder, pos.x, Math.floor(Math.random() * 3), Math.round(Math.random()) * 2 - 1, 0.5 + Math.random(), BOUNDS);
			s.mesh.position.copy(pos);
			s.mesh.rotation.setFromVector3(Tools.randomVector3(1));

			// clump sizes of dots
			var noiseScale = 0.2;
			var n = noise.noise3d(pos.x * noiseScale, pos.y * noiseScale, pos.z * noiseScale);
			n = Math.pow(n,3);
			var scl = Tools.lerp(n, 0.2 , 1.5);
			s.mesh.scale.set(scl,scl,scl);

			sa.push(s);
		}
		parent.add(holder);

	};

	this.update = function () {
		for (var i = 0; i < num_quads; i += 1) {
			sa[i].update();
		}
	};
};

var _quadParticle = function (BOUNDS) {
	var scope = this;

	this.init = function(parent, posx, axis, dir, vel, BOUNDS){
		var size = 30;

		var col = new THREE.Color();
		var sat = Tools.randomRange(0.6,1);
		var lightness = Tools.randomRange(0.2,0.6);
		col.setHSL( Tools.map(posx,-BOUNDS,BOUNDS,0,1), sat, lightness);

		var meshMaterial = new THREE.MeshBasicMaterial( {
			side: THREE.DoubleSide,
			color: col.getHex(),
			fog: false,
			transparent: true
		} );

		this.meshGeom = new THREE.PlaneGeometry( size, size, 1, 1);
		this.mesh = new THREE.Mesh(this.meshGeom, meshMaterial);
		this.axis = axis;
		this.dir = dir;
		this.vel = vel;
		this.bounds = BOUNDS;
		parent.add(this.mesh);
	};

	this.updateVelocity = function () {
		this.vel = 0.5 + Math.random() / 2;
	}

	this.update = function () {
		var mat = scope.mesh.material;

		scope.mesh.rotation.x += 0.02 * _game_delta;
		scope.mesh.rotation.y += 0.01 * _game_delta;
		scope.mesh.rotation.z += 0.01 * _game_delta;

		// drift
		scope.mesh.position.setComponent(this.axis, scope.mesh.position.getComponent(this.axis) + this.vel * _game_delta * this.dir);
		if (scope.mesh.position.getComponent(this.axis) > this.bounds && this.dir > 0) {
			scope.mesh.position.setComponent(this.axis, -this.bounds);
			this.updateVelocity();
		}

		if (scope.mesh.position.getComponent(this.axis) < -this.bounds && this.dir < 0) {
			scope.mesh.position.setComponent(this.axis, this.bounds);
			this.updateVelocity();
		}
		
		// appear smoothly
		mat.opacity = Tools.map(scope.mesh.position.getComponent(this.axis), -this.bounds, -this.bounds + 200, 0, 1);
		mat.opacity = Tools.map(scope.mesh.position.getComponent(this.axis), this.bounds - 200, this.bounds, mat.opacity, 0);
	};

};

