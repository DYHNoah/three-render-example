import { Matrix4 } from 'three';

const SSGIIntersectionShader = {
    uniforms: {
        tDiffuse: { value: null },
        time: { value: 0.0 },
        uFrameIndexMod64: { value: 0.0 },

        uResolution: { value: null },
        uColor: { value: null },
        uNormal: { value: null },
        uPosition: { value: null },
        uAlbedo: { value: null },
        uMaterial: { value: null },
        uCameraPos: { value: null },
        uCameraTarget: { value: null },

        uSamples: { value: 1 },

        uBlueNoise: { value: null },

        uProjectionMatrix: { value: new Matrix4() },
        uProjViewMatrix: { value: new Matrix4() },
        uViewMatrix: { value: new Matrix4() },

        uRoughnessMultiplier: { value: 0.0 },
    },

    vertexShader: /* glsl */ `

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,

    fragmentShader: /* glsl */ `

		#include <common>
		uniform float time;


		uniform sampler2D tDiffuse;
		
        uniform sampler2D uColor;
        uniform sampler2D uNormal;
        uniform sampler2D uPosition;
        uniform sampler2D uAlbedo;
        uniform sampler2D uMaterial;
		uniform vec2 uResolution;
		uniform vec3 uCameraPos;

		uniform int uFrameIndexMod64;

		uniform int uSamples;

		varying vec2 vUv;
		uniform mat4 uProjectionMatrix;
		uniform mat4 uProjViewMatrix;
		uniform mat4 uViewMatrix;

		uniform float uRoughnessMultiplier;
		
		// Low discrepancy sequence generation functions
		uvec3 Rand3DPCG16(ivec3 p)
		{
			uvec3 v = uvec3(p);
			v = v * 1664525u + 1013904223u;
			v.x += v.y*v.z;
			v.y += v.z*v.x;
			v.z += v.x*v.y;
			v.x += v.y*v.z;
			v.y += v.z*v.x;
			v.z += v.x*v.y;

			return v >> 16u;
		}

		uint ReverseBits32(uint bits) {
			bits = ((bits & 0x55555555u) << 1u) | ((bits >> 1u) & 0x55555555u);
			bits = ((bits & 0x33333333u) << 2u) | ((bits >> 2u) & 0x33333333u);
			bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits >> 4u) & 0x0F0F0F0Fu);
			bits = ((bits & 0x00FF00FFu) << 8u) | ((bits >> 8u) & 0x00FF00FFu);
			return (bits << 16u) | (bits >> 16u);
		}

		vec2 Hammersley16(uint Index, uint NumSamples, uvec2 Random)
		{
			float E1 = fract(float(Index) / float(NumSamples) + float(Random.x) * (1.0 / 65536.0));
			float E2 = float((ReverseBits32(Index) >> 16) ^ Random.y) * (1.0 / 65536.0);
			return vec2(E1, E2);
		}

		// GGX Importance Sampling
		vec3 ImportanceSamplingGGX(vec3 wo, vec3 norm, vec2 hash, float roughness, out vec3 out_wm) {
			
			float r0 = hash.x;
			float r1 = hash.y - 0.33;   

			// r0 = fract(r0 + float(isample) * 19.77);
			// r1 = fract(r1 + float(isample) * 27.337);
															
			float a = roughness * roughness;
			float a2 = a * a;
			float theta = acos(sqrt((1.0 - r0) / ((a2 - 1.0 ) * r0 + 1.0)));
			float phi = 2.0 * PI * r1;
			float x = sin(theta) * cos(phi);
			float y = cos(theta);
			float z = sin(theta) * sin(phi);
			vec3 wm = normalize(vec3(x, y, z));

			vec3 w = norm;
			if(abs(norm.y) < 0.95) {
				vec3 u = normalize(cross(w, vec3(0.0, 1.0, 0.0)));
				vec3 v = normalize(cross(u, w));
				wm = normalize(wm.y * w + wm.x * u + wm.z * v);                    
			} else {
				vec3 u = normalize(cross(w, vec3(0.0, 0.0, 1.0)));
				vec3 v = normalize(cross(u, w));
				wm = normalize(wm.y * w + wm.x * u + wm.z * v);
			}

			vec3 wi = reflect(wo, wm);
			out_wm = wm;
			return wi;
		}

		vec3 CosineSampling(vec3 wo, vec3 norm, vec2 hash, out vec3 out_wm){
			float r0 = hash.x;
			float r1 = hash.y - 0.33;

			// r0 = fract(r0 + float(isample) * 19.77);
			// r1 = fract(r1 + float(isample) * 27.337);

			float theta = acos(sqrt(1.0 - r0));
			float phi = 2.0 * PI * r1;
			float x = sin(theta) * cos(phi);
			float y = cos(theta);
			float z = sin(theta) * sin(phi);
			vec3 wm = normalize(vec3(x, y, z));

			vec3 w = norm;
			if(abs(norm.y) < 0.95) {
				vec3 u = normalize(cross(w, vec3(0.0, 1.0, 0.0)));
				vec3 v = normalize(cross(u, w));
				wm = normalize(wm.y * w + wm.x * u + wm.z * v);
			} else {
				vec3 u = normalize(cross(w, vec3(0.0, 0.0, 1.0)));
				vec3 v = normalize(cross(u, w));
				wm = normalize(wm.y * w + wm.x * u + wm.z * v);
			}

			vec3 wi = reflect(wo, wm);
			out_wm = wm;
			return wi;
		}

		float samplePDF(vec3 wi, vec3 wo, vec3 norm, float roughness) {
			vec3 wg = norm;
			vec3 wm = normalize(wo + wi);
			float a = roughness * roughness;
			float a2 = a * a;
			float cosTheta = dot(wg, wm);
			float exp = (a2 - 1.0) * cosTheta * cosTheta + 1.0;
			float D = a2 / (PI * exp * exp);
			return (D * dot(wm, wg)) / (4.0 * dot(wo,wm));
		}

		vec3 fresnelSchlick(float cosTheta, vec3 F0) {
			return F0 + (1.0 - F0) * pow(max(1.0 - cosTheta, 0.0), 5.0);
		}

		vec3 F_Schlick(float u, vec3 f0) {
			float f = pow(1.0 - u, 5.0);
			return f + f0 * (1.0 - f);
		}

		float DistributionGGX(vec3 N, vec3 H, float roughness) {
			vec3 m = H;
			float a = roughness * roughness;
			float nm2 = pow(dot(N, H), 2.0);
			return (a * a) / (PI * pow( nm2 * ( a * a - 1.0 ) + 1.0, 2.0));
		}

		float DistributionGGXFilament(vec3 N, vec3 H, float roughness) {
				// from filament
			float NoH  = max(dot(N, H), 0.0);
			float a = NoH * roughness;
			float k = roughness / (1.0 - NoH * NoH + a * a);
			return k * k * (1.0 / PI);
		}

		float GeometrySchlickGGX(float NdotV, float roughness) {
			float r = (roughness + 1.0);
			float k = (r*r) / 8.0;
		
			float num   = NdotV;
			float denom = NdotV * (1.0 - k) + k;
		
			return num / denom;
		}
		
		float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
			float a = roughness * roughness;
			float nv = dot(N, V);
			return (2.0 * nv) / (nv + sqrt(a*a + (1.0 - a*a) * nv * nv ));
		}

		float V_SmithGGXCorrelatedFast(vec3 N, vec3 V, vec3 L, float roughness) {
			float NoV = dot(N, V);
			float NoL = dot(N, L);
			float a = roughness;
			float GGXV = NoL * (NoV * (1.0 - a) + a);
			float GGXL = NoV * (NoL * (1.0 - a) + a);
			return 0.5 / (GGXV + GGXL);
		}

		vec3 EvalBRDF(vec3 wi, vec3 wo, vec3 n, float roughness, vec3 F0) {
			vec3 wm = normalize(wo + wi);
			if (dot(wi, wm) <= 0.0) {
				return vec3(0.0);
			}

			vec3 F    = fresnelSchlick(max(dot(wi, n), 0.0), F0);
			float NDF = DistributionGGX(n, wm, roughness); 
			float G   = GeometrySmith(n, wo, wi, roughness);   
	
			vec3 specular = (F * NDF * G) / (4.0 * dot(n,wo));  
			return F0 * specular;
		}

		float depthBufferAtP(vec3 p) {
			vec4 projP = uProjViewMatrix * vec4(p, 1.0);
			vec2 pNdc = (projP / projP.w).xy;
			vec2 pUv  = pNdc * 0.5 + 0.5;
			float depthAtPointP = texture2D(uPosition, pUv).w;
			if(depthAtPointP == 0.0) depthAtPointP = 9999999.0; 

			return depthAtPointP;
		}

		// Intersection
		bool intersect(
        vec3 ro, vec3 rd, uvec2 random,
        out vec3 intersectionP,
        out vec3 lastP) 
		{
			bool jitter = true;
			float startingStep = 2.0;
			float stepMult = 1.8;
			const int steps = 6;
			const int binarySteps = 6;

			float maxIntersectionDepthDistance = 1.5;
			float step = startingStep;

			vec3 p = ro;
			bool intersected = false;
			bool possibleIntersection = false;
			float lastRecordedDepthBuffThatIntersected;

			vec3 p1, p2;
			vec3 initialP = p;
			
			for(int i = 0; i < steps; i++) {
		
				vec2 hash = Hammersley16(uint(i), uint(steps), random);
				float jittA = fract(hash.x + hash.y);
				if(!jitter) jittA = 1.0;

				float jittB = 1.0 - jittA;

				p += rd * step * jittA;
				
				vec4 projP = uProjViewMatrix * vec4(p, 1.0);
				vec2 pNdc = (projP / projP.w).xy;
				vec2 pUv  = pNdc * 0.5 + 0.5;
				float depthAtPosBuff = texture2D(uPosition, pUv).w;

				if(depthAtPosBuff == 0.0) {
					depthAtPosBuff = 9999999.0;
				} 
				
				if(pUv.x < 0.0 || pUv.x > 1.0 || pUv.y < 0.0 || pUv.y > 1.0) {
					break;
				}
				
				float depthAtPointP = - (uViewMatrix * vec4(p, 1.0)).z;
				if(depthAtPointP > depthAtPosBuff) {
					// intersection found!
					p1 = initialP;
					p2 = p;
					lastRecordedDepthBuffThatIntersected = depthAtPosBuff;
					possibleIntersection = true;

					break;
				}
				
				initialP = p;
				p += rd * step * jittB;
				step *= stepMult; 
				
			}

			// ******** binary search start *********
			for(int j = 0; j < binarySteps; j++) {
				vec3 mid = (p1 + p2) * 0.5;
				float depthAtMid = - (uViewMatrix * vec4(mid, 1.0)).z;
				float depthAtPosBuff = depthBufferAtP(mid);
				
				if(depthAtMid > depthAtPosBuff) {
					p2 = (p1 + p2) * 0.5;
				
					lastRecordedDepthBuffThatIntersected = depthAtPosBuff;
				} else {
					p1 = (p1 + p2) * 0.5;
				}
			}
			// ******** binary search end   *********

			intersectionP = p2;
			lastP = p;

			// use p2 as the intersection point
			float depthAtP2 = - (uViewMatrix * vec4(p2, 1.0)).z;
		
			if( possibleIntersection &&   // without using possibleIntersection apparently it's possible that lastRecordedDepthBuffThatIntersected
											// ends up being valid thanks to the binary search, and that causes all sorts of troubles
				abs(depthAtP2 - lastRecordedDepthBuffThatIntersected) < maxIntersectionDepthDistance) {
				// intersection validated
				intersected = true;
			}
		
			return intersected;
		}

		void main() {

			vec4 sceneColor = texture2D( tDiffuse, vUv );

			vec4 posTexel = texture2D(uPosition, vUv);
			vec3 pos      = posTexel.xyz;
			float depth   = posTexel.w;
			vec3 norm     = normalize(texture2D(uNormal, vUv).xyz);

            vec4 albedo   = texture2D(uAlbedo, vUv);
        	vec4 material = texture2D(uMaterial, vUv);

			vec3 viewDir = normalize(pos - uCameraPos);
        
			// vec3 w = normalize(uCameraTarget - uCameraPos);

			if(dot(viewDir, norm) > 0.0) norm = -norm;

			if(depth == 0.0) {
				gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
				return;
			}

			float roughness = material.x;
			float metalness = material.y;
			float baseF0    = 0.25;

			vec3 specularReflectionDir = normalize(reflect(viewDir, norm));
			vec4 sum = vec4(0.0);

			vec4 intersectionPointAverage = vec4(0.0);
        	float intersectionPointAverageSamples = 0.0;
			uint rays = uint(uSamples);
			uint effectiveSamples = rays;

			uvec2 pixelPosition = uvec2(vUv * uResolution);
    		uvec2 random = Rand3DPCG16(ivec3(pixelPosition, uint(uFrameIndexMod64 + int(114.514 * fract(time))))).xy;

			vec2 hash = Hammersley16(0u, uint(rays), random);

			for(uint s = 0u; s < rays; s++) {
				vec2 hash = Hammersley16(s, rays + uint(11.4514 * fract(time)), random);
				vec3 wm;
            	vec3 reflDir = CosineSampling(viewDir, norm, hash, wm);

				if(dot(reflDir, norm) < 0.0) {
					if(effectiveSamples > 1u) {
						// skip this sample entirely
						--effectiveSamples;
						continue;
					} else {
						// one last attempt, and whatever happens happens
						hash = Hammersley16(s + 79u, rays + 79u + uint(fract(time) * 11.4514), random);
						reflDir = CosineSampling(viewDir, norm, hash, wm);
					}
				}

				vec3 rd = reflDir;
				vec3 ro = pos + reflDir * max(0.01, 0.01 * depth);
				
				vec3 mult = vec3(1.0);
				float maxIntersectionDepthDistance = 1.5;

				vec3 p2;
				vec3 lastP;
				bool intersected = intersect(ro, rd, random, p2, lastP);

				vec3 F0 = vec3(baseF0);
				F0 = mix(F0, albedo.xyz, metalness);

				vec2 p2Uv;
				if(intersected) {
					
					// intersection validated
					vec4 projP2 = uProjViewMatrix * vec4(p2, 1.0);
					p2Uv = (projP2 / projP2.w).xy * 0.5 + 0.5;
					// vec3 color = texture2D(uColor, p2Uv).xyz;
					vec3 color = texture2D(uColor, p2Uv).xyz;
					mult *= color;
					
					// apply pdf and brdf
					vec3 brdf = EvalBRDF(rd, -viewDir, norm, roughness, F0);
					float pdf = samplePDF(rd, -viewDir, norm, roughness);

					brdf = clamp(brdf, 0.00001, 100.0);
					pdf  = clamp(pdf,  0.1, 100.0);

					// mult *= brdf;
					// mult /= max(pdf, 0.00001);

					intersectionPointAverage += vec4(p2, 1.0);
					intersectionPointAverageSamples += 1.0;
				} else {
					// intersection is invalid
					// mult = vec3(0.0);
					intersectionPointAverage += vec4(ro + rd * 100.0, 1.0);
					intersectionPointAverageSamples += 1.0;
				}

				if(intersected) {
					sum += vec4(mult, 0.0);
				}
			}
			vec3 res = clamp(sum.rgb / vec3(effectiveSamples), 0.0, 1.0);
			
			// gl_FragColor =  vec4( vec3(float(effectiveSamples) / 64.0), 1.0 );
			gl_FragColor =  vec4( res, 1.0 );


		}`,
};

export { SSGIIntersectionShader };
