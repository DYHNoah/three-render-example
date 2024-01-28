import { Matrix4 } from "three";

const FinalCombineShader = {

	uniforms: {
		'uSSSRColorRT': { value: null },
		'uSSGIColorRT': { value: null },
		'uAlbedoRT': { value: null },
		'uSceneColorRT': { value: null },
		'uSSSRIntensity': { value: 0.0 },
		'uSSGIIntensity': { value: 0.0 },
	},

	vertexShader: /* glsl */`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

	fragmentShader: /* glsl */`

		#include <common>
		
        uniform sampler2D uSSSRColorRT;
        uniform sampler2D uSSGIColorRT;
		uniform sampler2D uSceneColorRT;
		uniform sampler2D uAlbedoRT;

		varying vec2 vUv;

		vec3 RRTAndODTFit( vec3 v ) {
			vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
			vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
			return a / b;
		}

		vec3 ACESFilmicToneMapping( vec3 color ) {
			const mat3 ACESInputMat = mat3(
			vec3( 0.59719, 0.07600, 0.02840 ), vec3( 0.35458, 0.90834, 0.13383 ), vec3( 0.04823, 0.01566, 0.83777 )
			);
			const mat3 ACESOutputMat = mat3(
			vec3(  1.60475, -0.10208, -0.00327 ), vec3( -0.53108, 1.10813, -0.07276 ), vec3( -0.07367, -0.00605, 1.07602 )
			);
			float toneMappingExposure = 1.0;
			color *= toneMappingExposure / 0.6;
			color = ACESInputMat * color;
			color = RRTAndODTFit( color );
			color = ACESOutputMat * color;
			return saturate( color );
		}

		void main() {

			vec4 sssrColor = texture2D(uSSSRColorRT, vUv);
			vec4 ssgiColor = texture2D(uSSGIColorRT, vUv);
			vec4 sceneColor = texture2D(uSceneColorRT, vUv);
			vec4 albedo = texture2D(uAlbedoRT, vUv);
			// gl_FragColor = vec4(sssrColor.rgb, 1.0);
			// gl_FragColor = vec4(ACESFilmicToneMapping(sceneColor.rgb + sssrColor.rgb * 1.8 +  albedo.rgb * ssgiColor.rgb * 1.2), 1.0);
			gl_FragColor = vec4(sceneColor.rgb + sssrColor.rgb * 1.8 +  albedo.rgb * ssgiColor.rgb * 1.0, 1.0);
		}`,

};

export { FinalCombineShader };
