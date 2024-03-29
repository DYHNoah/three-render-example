import { Matrix4 } from "three";

const CrossBilateralFiltrerShader = {

	uniforms: {

		'tDiffuse': { value: null },

		'uInvResolution': { value: null },
        'uNormal': { value: null },
        'uPosition': { value: null },
		'uStep': { value: 1.0 },



	},

	vertexShader: /* glsl */`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

	fragmentShader: /* glsl */`

		#include <common>


		uniform sampler2D tDiffuse;
        uniform sampler2D uNormal;
        uniform sampler2D uPosition;
		uniform vec2 uInvResolution;
		uniform float uStep;
		varying vec2 vUv;

		void main() {

			float kernel[25];
			kernel[20] = 0.00390625; kernel[21] = 0.015625; kernel[22] = 0.0234375; kernel[23] = 0.015625; kernel[24] = 0.00390625;
			kernel[15] = 0.015625;   kernel[16] = 0.0625;   kernel[17] = 0.09375;   kernel[18] = 0.0625;   kernel[19] = 0.015625;
			kernel[10] = 0.0234375;  kernel[11] = 0.09375;  kernel[12] = 0.140625;  kernel[13] = 0.09375;  kernel[14] = 0.0234375;
			kernel[5]  = 0.015625;   kernel[6]  = 0.0625;   kernel[7]  = 0.09375;   kernel[8]  = 0.0625;   kernel[9]  = 0.015625;
			kernel[0]  = 0.00390625; kernel[1]  = 0.015625; kernel[2]  = 0.0234375; kernel[3]  = 0.015625; kernel[4]  = 0.00390625;
			vec2 offs[25];
			offs[20] = vec2(-2.0, +2.0); offs[21] = vec2(-1.0, +2.0); offs[22] = vec2(+0.0, +2.0); offs[23] = vec2(+1.0, +2.0); offs[24] = vec2(+2.0, +2.0);
			offs[15] = vec2(-2.0, +1.0); offs[16] = vec2(-1.0, +1.0); offs[17] = vec2(+0.0, +1.0); offs[18] = vec2(+1.0, +1.0); offs[19] = vec2(+2.0, +1.0);
			offs[10] = vec2(-2.0, +0.0); offs[11] = vec2(-1.0, +0.0); offs[12] = vec2(+0.0, +0.0); offs[13] = vec2(+1.0, +0.0); offs[14] = vec2(+2.0, +0.0);
			offs[5]  = vec2(-2.0, -1.0); offs[6]  = vec2(-1.0, -1.0); offs[7]  = vec2(+0.0, -1.0); offs[8]  = vec2(+1.0, -1.0); offs[9]  = vec2(+2.0, -1.0);
			offs[0]  = vec2(-2.0, -2.0); offs[1]  = vec2(-1.0, -2.0); offs[2]  = vec2(+0.0, -2.0); offs[3]  = vec2(+1.0, -2.0); offs[4]  = vec2(+2.0, -2.0);
			const int loopSteps = 25;

			// float kernel[9];
			// kernel[6] = 0.0625; kernel[7] = 0.125; kernel[8] = 0.0625;
			// kernel[3] = 0.125;  kernel[4] = 0.25;  kernel[5] = 0.125; 
			// kernel[0] = 0.0625; kernel[1] = 0.125; kernel[2] = 0.0625;
			// vec2 offs[9];
			// offs[6] = vec2(-1.0, +1.0); offs[7] = vec2(+0.0, +1.0); offs[8] = vec2(+1.0, +1.0);
			// offs[3] = vec2(-1.0, +0.0); offs[4] = vec2(+0.0, +0.0); offs[5] = vec2(+1.0, +0.0);
			// offs[0] = vec2(-1.0, -1.0); offs[1] = vec2(+0.0, -1.0); offs[2] = vec2(+1.0, -1.0);
			// const int loopSteps = 9;
			
			float n_phi = 0.1;
			float p_phi = 10.1;
			float stepwidth = uStep;

			vec4 sum = vec4(0.0);
			vec2 step  = vec2(uInvResolution.x, uInvResolution.y);
			vec2 hstep = step * 0.0;

			vec4 cval = texture2D(tDiffuse,  vUv.st + hstep);
			vec4 nval = texture2D(uNormal,   vUv.st + hstep);
			vec4 pval = texture2D(uPosition, vUv.st + hstep);

			if(pval == vec4(0.0, 0.0, 0.0, 0.0)) {
				return;
			}
			// float history = texture2D(uHistoryAccum, vUv.st + hstep).z;
			// // stepwidth *= 1.0 - (1.0 - (10.0 - history) / 10.0);
			// history = clamp(history, 0.0, 20.0);
			// stepwidth *= 1.0 - (1.0 - (20.0 - history) / 20.0) * 0.8;
			
			float cum_w = 0.0;
			for(int i = 0; i < loopSteps; i++) {
				vec2 uv = vUv.st + hstep + offs[i] * step * stepwidth;
				vec4 ctmp = texture2D(tDiffuse, uv);
				vec4 t;
				float dist2;

				// vec4 t = cval - ctmp;
				// float dist2 = dot(t,t);
				// float c_w = min(exp(-(dist2)/c_phi), 1.0);

				vec4 ntmp = texture2D(uNormal, uv);
				t = nval - ntmp;
				dist2 = max(dot(t,t)/(stepwidth*stepwidth),0.0);
				float n_w = min(exp(-(dist2)/n_phi), 1.0);
				vec4 ptmp = texture2D(uPosition, uv);

				t = pval - ptmp;
				dist2 = dot(t,t);
				float p_w = min(exp(-(dist2)/p_phi), 1.0);

				float weight = n_w * p_w;
				sum += ctmp * weight * kernel[i];
				cum_w += weight * kernel[i];
			}

			vec4 color = sum / cum_w;
			gl_FragColor = color;
		}`,

};

export { CrossBilateralFiltrerShader };
