/**
 * @author alteredq / http://alteredqualia.com/
 *
 * Vignette shader
 * based on PaintEffect postprocess from ro.me
 * http://code.google.com/p/3-dreams-of-black/source/browse/deploy/js/effects/PaintEffect.js
 */

THREE.VignetteShader = {

	uniforms: {

		"tDiffuse": { value: null },
		"offset":   { value: 1.0 },
		"darkness": { value: 1.0 }

	},

	vertexShader: [

		"varying vec2 vUv;",

		"void main() {",

			"vUv = uv;",
			"gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",

		"}"

	].join( "\n" ),

	fragmentShader: [

		"uniform float offset;",
		"uniform float darkness;",

		"uniform sampler2D tDiffuse;",

		"varying vec2 vUv;",

		"vec2 Distort(vec2 p)",
		"{",
		"	float theta  = atan(p.y, p.x);",
		"	float radius = length(p);",
		"	radius = pow(radius, 1.5);",
		"	p.x = radius * cos(theta);",
		"	p.y = radius * sin(theta);",
		"	return 0.5 * (p + 1.0);",
		"}",

		"void main() {",

			// Eskil's vignette
			"vec2 uv = ( vUv - vec2( 0.5 ) ) * vec2( offset );",
			"vec4 texel = texture2D( tDiffuse, vUv * Distort(vUv ) );",
			"gl_FragColor = texel;",

			/*
			// alternative version from glfx.js
			// this one makes more "dusty" look (as opposed to "burned")

			"vec4 color = texture2D( tDiffuse, vUv );",
			"float dist = distance( vUv, vec2( 0.5 ) );",
			"color.rgb *= smoothstep( 0.8, offset * 0.799, dist *( darkness + offset ) );",
			"gl_FragColor = color;",
			*/

		"}"

	].join( "\n" )

};
