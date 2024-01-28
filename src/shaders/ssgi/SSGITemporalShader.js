import { Matrix4 } from 'three';

const SSGITemporalShader = {
    uniforms: {
        uCurrColorRT: { value: null },
        uPrevColorRT: { value: null },
        uFrameIndexMod64: { value: 0.0 },
        uTemporalWeight: { value: 0.95 },

        uResolution: { value: null },
        uInvResolution: { value: null },
        uColor: { value: null },
        uNormal: { value: null },
        uPosition: { value: null },
        uAlbedo: { value: null },
        uMaterial: { value: null },

        uPrevViewProjMatrix: { value: new Matrix4() },
    },

    vertexShader: /* glsl */ `

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

    fragmentShader: /* glsl */ `

		#include <common>

		// control parameter
		uniform float time;


		uniform sampler2D tDiffuse;
		
        uniform sampler2D uCurrColorRT;
		uniform sampler2D uPrevColorRT;
        uniform sampler2D uColor;
        uniform sampler2D uNormal;
        uniform sampler2D uPosition;
        uniform sampler2D uAlbedo;
        uniform sampler2D uMaterial;
		uniform vec2 uResolution;
		uniform vec2 uInvResolution;
		uniform vec3 uCameraPos;

		uniform mat4 uPrevViewProjMatrix;

		uniform int uFrameIndexMod64;

		uniform float uTemporalWeight;


		varying vec2 vUv;

		#define FLT_EPS 5.960464478e-8

		vec4 RGB2YCoCgR(vec4 rgbColor)
		{
			vec4 YCoCgRColor;

			YCoCgRColor.y = rgbColor.r - rgbColor.b;
			float temp = rgbColor.b + YCoCgRColor.y / 2.0;
			YCoCgRColor.z = rgbColor.g - temp;
			YCoCgRColor.x = temp + YCoCgRColor.z / 2.0;
			YCoCgRColor.w = rgbColor.w;

			return YCoCgRColor;
		}
		
		vec4 YCoCgR2RGB(vec4 YCoCgRColor)
		{
			vec4 rgbColor;

			float temp = YCoCgRColor.x - YCoCgRColor.z / 2.0;
			rgbColor.g = YCoCgRColor.z + temp;
			rgbColor.b = temp - YCoCgRColor.y / 2.0;
			rgbColor.r = rgbColor.b + YCoCgRColor.y;
			rgbColor.w = YCoCgRColor.w;

			return rgbColor;
		}

		float Luminance(vec4 linearRgb)
		{
			return dot(linearRgb.rgb, vec3(0.2126729, 0.7151522, 0.0721750));
		}

		vec4 ToneMap(vec4 color)
		{
			return color / (1.0 + Luminance(color));
		}

		vec4 UnToneMap(vec4 color)
		{
			return color / (1.0 - Luminance(color));
		}

		vec2 HistoryPosition(vec2 uv, vec3 worldPos)
		{
			vec4 historyNDC = uPrevViewProjMatrix * vec4(worldPos, 1.0);
			vec2 historyUV = historyNDC.xy / historyNDC.w;
			historyUV = historyUV * 0.5 + 0.5;
			return historyUV;
		}

		vec4 ClipAABB_YCoCgR(vec3 aabbMin, vec3 aabbMax, vec4 avg, vec4 preColor)
		{
			vec3 p_clip = 0.5 * (aabbMax + aabbMin);
			vec3 e_clip = 0.5 * (aabbMax - aabbMin) + FLT_EPS;

			vec4 v_clip = preColor - vec4(p_clip, avg.w);
			vec3 v_unit = v_clip.xyz / e_clip;
			vec3 a_unit = abs(v_unit);
			float ma_unit = max(a_unit.x, max(a_unit.y, a_unit.z));

			if (ma_unit > 1.0)
				return vec4(p_clip, avg.w) + v_clip / ma_unit;
			return preColor;
		}

		vec4 ClipAABB(vec3 aabbMin, vec3 aabbMax, vec4 avg, vec4 preColor)
		{
			vec3 aabbCenter = 0.5 * (aabbMax + aabbMin);
			vec3 extentClip = 0.5 * (aabbMax - aabbMin) + 0.001;

			vec3 colorVector = preColor.xyz - aabbCenter;

			vec3 colorVectorClip =  colorVector / extentClip;
			colorVectorClip = abs(colorVectorClip);
			
			float maxAbsUnit = max(max(colorVectorClip.x, colorVectorClip.y), colorVectorClip.z);
			if (maxAbsUnit > 1.0) {
				return vec4(aabbCenter + colorVector / maxAbsUnit, 1.0); // clip towards color vector
			}
			return preColor; // point is inside aabb
		}

		void main() {

			vec3 currColor = clamp(texture2D(uCurrColorRT, vUv).xyz, 0.0, 1.0);
			vec4 posTexel  = texture2D(uPosition, vUv);
			vec3 pos       = posTexel.xyz;
			float depth    = posTexel.w;

			// if (depth == 0.0)
			// {
			// 	gl_FragColor = vec4(0.0);
			// 	return;
			// }

			vec3 normal    = normalize(texture2D(uNormal, vUv).xyz);
            vec4 albedo    = texture2D(uAlbedo, vUv);
        	vec4 material  = texture2D(uMaterial, vUv);

			vec4 colorMin;
			vec4 colorMax;
			vec4 colorAvg;
			vec4 colorDiff;

			vec2 du = vec2(uInvResolution.x, 0.0) * 0.2;
			vec2 dv = vec2(0.0, uInvResolution.y) * 0.2;

			vec4 colorTL = texture2D(uCurrColorRT, vUv - du - dv);
			vec4 colorTC = texture2D(uCurrColorRT, vUv - dv);
			vec4 colorTR = texture2D(uCurrColorRT, vUv + du - dv);
			vec4 colorML = texture2D(uCurrColorRT, vUv - du);
			vec4 colorMC = texture2D(uCurrColorRT, vUv);
			vec4 colorMR = texture2D(uCurrColorRT, vUv + du);
			vec4 colorBL = texture2D(uCurrColorRT, vUv - du + dv);
			vec4 colorBC = texture2D(uCurrColorRT, vUv + dv);
			vec4 colorBR = texture2D(uCurrColorRT, vUv + du + dv);
			colorMin = min(colorTL, min(colorTC, min(colorTR, min(colorML, min(colorMC, min(colorMR, min(colorBL, min(colorBC, colorBR))))))));
			colorMax = max(colorTL, max(colorTC, max(colorTR, max(colorML, max(colorMC, max(colorMR, max(colorBL, max(colorBC, colorBR))))))));
			colorAvg = (colorTL + colorTC + colorTR + colorML + colorMC + colorMR + colorBL + colorBC + colorBR) / 9.0;
			colorDiff = abs(colorTL - colorAvg) * abs(colorTL - colorAvg) + 
						abs(colorTC - colorAvg) * abs(colorTC - colorAvg) +
						abs(colorTR - colorAvg) * abs(colorTR - colorAvg) +
						abs(colorML - colorAvg) * abs(colorML - colorAvg) +
						abs(colorMC - colorAvg) * abs(colorMC - colorAvg) +
						abs(colorMR - colorAvg) * abs(colorMR - colorAvg) +
						abs(colorBL - colorAvg) * abs(colorBL - colorAvg) +
						abs(colorBC - colorAvg) * abs(colorBC - colorAvg) +
						abs(colorBR - colorAvg) * abs(colorBR - colorAvg);
			colorDiff = sqrt(colorDiff / 9.0);

			vec2 historyUV = HistoryPosition(vUv, pos);
			// vec2 historyUV = vUv;

			vec4 prevColor = clamp(texture2D(uPrevColorRT, historyUV), 0.0, 1.0);
			colorDiff = colorDiff * 2.5;
			vec4 clampedColor = clamp(ClipAABB(colorAvg.rgb - colorDiff.rgb, colorAvg.rgb + colorDiff.rgb, colorAvg, prevColor), 0.0, 1.0);
			vec3 temporalColor = prevColor.rgb * uTemporalWeight + clampedColor.rgb * (1.0 - uTemporalWeight);

			gl_FragColor =  vec4( temporalColor.rgb, 1.0 );
			// gl_FragColor =  vec4( historyUV, 0.0, 1.0 );
		}`,
};

export { SSGITemporalShader };
