 /*
	SuperShader combines some shaders
	- RGB shift
	- Vignette

	Some of the code taken from felixturner / http://airtight.cc/

 */

THREE.SuperShader = {

	uniforms: {

		'tDiffuse': { type: 't', value: null },
		
		//Vignette
		'vigOffset':   { type: 'f', value: 0.5 }, //amount of vig
		'vigDarkness': { type: 'f', value: 1. }, //vig color: -1 = white, 1 = black

		'rgbShiftAmount': { type: 'f', value: 0.005 },

	},

	vertexShader: [

		'varying vec2 vUv;',

		'void main() {',

			'vUv = uv;',
			'gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );',

		'}'

	].join('\n'),

	fragmentShader: [

		'uniform sampler2D tDiffuse;',

		'uniform float vigOffset;',
		'uniform float vigDarkness;',

		'uniform float rgbShiftAmount;',

		'varying vec2 vUv;',

		'const float rgbAngle = 0.1;',

		'void main() {',
			//orig color
			'vec4 col = texture2D( tDiffuse, vUv );',

			//rgb shift wat=y from center
			'vec2 uv = ( vUv - vec2( 0.5 ) );',
			'float amt = dot( uv, uv );',
			'vec2 offset = rgbShiftAmount * vec2( cos(rgbAngle), sin(rgbAngle)) * amt;',
			'vec4 cr = texture2D(tDiffuse, vUv + offset);',
			'vec4 cga = texture2D(tDiffuse, vUv);',
			'vec4 cb = texture2D(tDiffuse, vUv - offset);',
			'col = vec4(cr.r, cga.g, cb.b, cga.a);',

			//vignette
			'vec2 uv2 = uv * vec2( vigOffset );',
			'col = vec4( mix( col.rgb, vec3( 1.0 - vigDarkness ), dot( uv2, uv2 ) ), col.a );',

			'gl_FragColor = col;',

		'}'

	].join('\n')

};
