import { Matrix4 } from "three";

const BlitShader = {

	uniforms: {
		'uSceneColorRT': { value: null },

	},

	vertexShader: /* glsl */`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

	fragmentShader: /* glsl */`

		#include <common>

		uniform sampler2D uSceneColorRT;


		varying vec2 vUv;


		void main() {
			vec4 sceneColor = texture2D(uSceneColorRT, vUv);
			gl_FragColor = vec4(sceneColor.rgb, 1.0);
		}`,

};

export { BlitShader };
