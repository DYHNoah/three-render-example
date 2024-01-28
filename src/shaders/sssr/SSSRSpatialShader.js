import { Matrix4 } from "three";

const SSSRSpatialShader = {

	uniforms: {

		'uIntersectionRT': { value: null },
		'uFrameIndexMod64': { value: 0.0 },
		
		'uResolution': { value: null },
		'uInvResolution': { value: null },
        'uColor': { value: null },
        'uNormal': { value: null },
        'uPosition': { value: null },
        'uAlbedo': { value: null },
		'uMaterial': { value: null },
		
		'uSamples': { value: 1 },


	},

	vertexShader: /* glsl */`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

	fragmentShader: /* glsl */`

		#include <common>

		// control parameter
		uniform float time;


		uniform sampler2D tDiffuse;
		
        uniform sampler2D uIntersectionRT;
        uniform sampler2D uColor;
        uniform sampler2D uNormal;
        uniform sampler2D uPosition;
        uniform sampler2D uAlbedo;
        uniform sampler2D uMaterial;
		uniform vec2 uResolution;
		uniform vec2 uInvResolution;
		uniform vec3 uCameraPos;

		uniform int uFrameIndexMod64;

		uniform int uSamples;

		varying vec2 vUv;
		uniform mat4 uProjectionMatrix;
		uniform mat4 uProjViewMatrix;
		uniform mat4 uViewMatrix;

		uniform float uRoughnessMultiplier;

		float GetEdgeStopNormalWeight(vec3 normal_p, vec3 normal_q, float sigma)
		{
			return pow(max(dot(normal_p, normal_q), 0.0), sigma);
		}

		float GetEdgeStopDepthWeight(float x, float m, float sigma)
		{
			float a = length(x - m) / sigma;
			a *= a;
			return exp(-0.5 * a);
		}
		
		const ivec2 kStackowiakSampleSet2[16] = ivec2[](
			ivec2(0, 0), ivec2(0, 1), ivec2(1, 0), ivec2(1, 1),
			ivec2(0, -1), ivec2(-1, -2), ivec2(-1, 0), ivec2(0, 2),
			ivec2(1, -1), ivec2(-1, 1), ivec2(-1, 2), ivec2(1, 2),
			ivec2(2, -1), ivec2(2, 0), ivec2(2, 1), ivec2(2, 2)
		);

		void main() {
			vec3 sceneColor = texture2D(uColor, vUv).xyz;
			vec3 intersectionRes = texture2D(uIntersectionRT, vUv).xyz;
			vec4 posTexel = texture2D(uPosition, vUv);
			vec3 pos      = posTexel.xyz;
			float depth   = posTexel.w;

			if(depth == 0.0) {
				gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
				return;
			}

			vec3 normal   = normalize(texture2D(uNormal, vUv).xyz);
            vec4 albedo   = texture2D(uAlbedo, vUv);
        	vec4 material = texture2D(uMaterial, vUv);

			vec2 invResolution = uInvResolution;

			float sumWeight = 0.0;
    		vec3 spatialColor = vec3(0.0);

			for (int i = 0; i < 16; ++i) {
				ivec2 offset = kStackowiakSampleSet2[i];
				vec2 uvOffset = vUv + vec2(offset) * invResolution;

				float depthOffset = texture2D(uPosition, uvOffset).w;
				vec3 normalOffset = normalize(texture2D(uNormal, uvOffset).xyz);
				vec3 hitIntersectionRes = texture2D(uIntersectionRT, uvOffset).xyz;

				float depthWeight = GetEdgeStopDepthWeight(depthOffset, depth, 0.001);
				float normalWeight = GetEdgeStopNormalWeight(normal, normalOffset, 64.0);
				float weight = depthWeight * normalWeight;
				sumWeight += weight;
				spatialColor += hitIntersectionRes * weight;
			}
			spatialColor /= max(sumWeight, 1e-5);
			gl_FragColor =  vec4(clamp(spatialColor, 0.0, 1.0), 1.0 );
		}`,

};

export { SSSRSpatialShader };
