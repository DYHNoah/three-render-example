import * as THREE from "three";
import { Color } from 'three';
import { Vector2, Vector3 } from "three";
import { GBufferFragmentShader, GBufferDebugShaderA, GBufferDebugShaderB, GBufferDebugShaderC, GBufferDebugShaderD } from "../shaders/GBufferShaders";
// import { defaultWhiteTexture, defaultBlackTexture } from "./DefaultTextures";

export default class GBuffers {
    constructor(width, height, scene, camera) {
        this.GBuffer = new THREE.WebGLMultipleRenderTargets(
            width,
            height,
            4
        );
        
        for ( let j = 0, il = this.GBuffer.texture.length; j < il; j ++ ) {
            this.GBuffer.texture[ j ].minFilter = THREE.NearestFilter;
            this.GBuffer.texture[ j ].magFilter = THREE.NearestFilter;
            this.GBuffer.texture[ j ].type = THREE.FloatType;
        }

        this.GBuffer.texture[ 0 ].name = 'normal';
        this.GBuffer.texture[ 1 ].name = 'position';
        this.GBuffer.texture[ 2 ].name = 'albedo';
        this.GBuffer.texture[ 3 ].name = 'material';

        this.GTextures = { 
            normal:   this.GBuffer.texture[ 0 ],
            position: this.GBuffer.texture[ 1 ],
            albedo:   this.GBuffer.texture[ 2 ],
            material: this.GBuffer.texture[ 3 ],
        };
        
        this.bufferMaterial = new THREE.RawShaderMaterial({
            uniforms: {
                uRoughness: { value: 1 },
                uMetalness: { value: 1 },
                uBaseF0:    { value: 0.05 },
                uMeshId:    { value: 0 },
                uAlbedo:    { value: new Vector3(1,1,1) },
                uAlbedoMapRepeat: { value: new Vector2(1,1) },
                uRoughnessMapRepeat: { value: new Vector2(1,1) },
                uMetalnessMapRepeat: { value: new Vector2(1,1) },

                uRoughnessMap: { type: "t", value: null },
                uMetalnessMap: { type: "t", value: null },
                uAlbedoMap:    { type: "t", value: null },
            },
            
            vertexShader: `
                in vec3 position;
                in vec3 normal;
                in vec2 uv;
                in vec4 color;

                out vec3 vNormal;
                out vec3 vPosition;
                out vec2 vUv;
                out vec3 vColor;
                out float vDepth;

                uniform mat4 modelMatrix;
                uniform mat4 modelViewMatrix;
			    uniform mat4 viewMatrix;
			    uniform mat4 projectionMatrix;
			    uniform mat3 normalMatrix;

                void main() {
                    // world space normal
                    vNormal = (transpose(inverse(modelMatrix)) * vec4(normal, 1.0)).xyz;  
                    // view space normal
                    // vNormal = normalMatrix * normal;
                    
                    vPosition = (modelMatrix * vec4(position, 1.0)).xyz;  
                    vDepth = - (modelViewMatrix * vec4(position, 1.0)).z;  
                    vUv = uv;
                    vColor = color.rgb;

                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);    
                }
            `,

            fragmentShader: GBufferFragmentShader,

            glslVersion: THREE.GLSL3,
            side: THREE.DoubleSide,
        });

        this.scene = scene;
        this.camera = camera;

        this.originalClearColor = new Color();

        this.visibleMeshes = [];
        this.cachedMaterials = new WeakMap();

        this.defaultWhiteTexture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
        this.defaultWhiteTexture.needsUpdate = true;
        this.defaultWhiteTexture.magFilter = THREE.NearestFilter;
        this.defaultWhiteTexture.minFilter = THREE.NearestFilter;
    }

    render(renderer) {
        let autoClearOpt = renderer.autoClear;
        this.bufferMaterial.clearColor = new THREE.Color(0,0,0);
        renderer.autoClear = false;
        renderer.clear();

        this.renderOverride(renderer, this.bufferMaterial, this.GBuffer, 0, 0);

        renderer.autoClear = autoClearOpt;
        renderer.setRenderTarget(null);
    }

    getVisibleChildren(object) {
        const queue = [object];
        const objects = [];

        while (queue.length !== 0) {
            const mesh = queue.shift();
            if (mesh.material) objects.push(mesh);

            for (const c of mesh.children) {
                if (c.visible) queue.push(c);
            }
        }
        return objects;
    }

    copyNecessaryProps(originalMaterial, newMaterial) {
        newMaterial.uniforms.uAlbedoMap.value    = originalMaterial.map          || this.defaultWhiteTexture;
        newMaterial.uniforms.uRoughnessMap.value = originalMaterial.roughnessMap || this.defaultWhiteTexture;
        newMaterial.uniforms.uMetalnessMap.value = originalMaterial.metalnessMap || this.defaultWhiteTexture;
        newMaterial.uniforms.uRoughnessMapRepeat.value = originalMaterial.roughnessMap?.repeat || new THREE.Vector2(1,1);
        newMaterial.uniforms.uMetalnessMapRepeat.value = originalMaterial.metalnessMap?.repeat || new THREE.Vector2(1,1);
        newMaterial.uniforms.uAlbedoMapRepeat.value = originalMaterial.map?.repeat || new THREE.Vector2(1,1);
        newMaterial.uniforms.uAlbedo.value       = originalMaterial.color     || new Vector3(1,1,1);
        newMaterial.uniforms.uRoughness.value    = originalMaterial.roughness || 0;
        newMaterial.uniforms.uMetalness.value    = originalMaterial.metalness || 0;
    }

    renderOverride(renderer, overrideMaterial, renderTarget, clearColor, clearAlpha) {
        // this.originalClearColor.copy(renderer.getClearColor(this.tempColor));
        const originalClearAlpha = renderer.getClearAlpha(this.tempColor);
        const originalAutoClear = renderer.autoClear;

        renderer.setRenderTarget(renderTarget);
        renderer.autoClear = false;

        clearColor = overrideMaterial.clearColor || clearColor;
        clearAlpha = overrideMaterial.clearAlpha || clearAlpha;

        if (clearColor !== undefined && clearColor !== null) {
            renderer.setClearColor(clearColor);
            renderer.setClearAlpha(clearAlpha || 0.0);
            renderer.clear();
        }

        this.visibleMeshes = this.getVisibleChildren(this.scene);

        for (const c of this.visibleMeshes) { 
            const originalMaterial = c.material;

            let [cachedOriginalMaterial, gbufferMaterial] = this.cachedMaterials.get(c) || [];

            if (originalMaterial !== cachedOriginalMaterial) {
                if (gbufferMaterial) gbufferMaterial.dispose();
                gbufferMaterial = this.bufferMaterial.clone();
                
                this.copyNecessaryProps(originalMaterial, gbufferMaterial);

                this.cachedMaterials.set(c, [originalMaterial, gbufferMaterial])
            }

            c.material = gbufferMaterial;

            if (originalMaterial.transparent) {
                c.visible = false;
            }
        }

        renderer.render(this.scene, this.camera, renderTarget);

        for (const c of this.visibleMeshes) {
			c.visible = true
			const [originalMaterial] = this.cachedMaterials.get(c)
			c.material = originalMaterial
		}

        // overrideMaterial = gbufferMaterial;
        // this.scene.overrideMaterial = overrideMaterial;
        // renderer.render(this.scene, this.camera);
        // this.scene.overrideMaterial = null;

        // restore original state

        renderer.autoClear = originalAutoClear;
        // renderer.setClearColor(this.originalClearColor);
        renderer.setClearAlpha(originalClearAlpha);
    }

    renderToScreen(renderer, scene, camera, type) {
        let autoClearOpt = renderer.autoClear;
        this.bufferMaterial.clearColor = new THREE.Color(0,0,0);
        renderer.autoClear = false;
        renderer.clear();
        if (type === 0) {
            this.bufferMaterial.fragmentShader = GBufferDebugShaderA;
        } else if (type === 1) {
            this.bufferMaterial.fragmentShader = GBufferDebugShaderB;
        } else if (type === 2) {
            this.bufferMaterial.fragmentShader = GBufferDebugShaderC;
        } else if (type === 3) {
            this.bufferMaterial.fragmentShader = GBufferDebugShaderD;
        };

        this.renderOverride(renderer, this.bufferMaterial, null, 0, 0);

        // for(let i = scene.children.length - 1; i >= 0; i--) {
        //     let children = scene.children[i];
        //     this.renderMesh(renderer, scene, camera, children)
        // }

        renderer.autoClear = autoClearOpt;
        renderer.setRenderTarget(null);
    }
}

export { GBuffers };