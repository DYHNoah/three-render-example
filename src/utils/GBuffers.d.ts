import * as THREE from "three";
import { Color } from 'three';
import { Vector2, Vector3 } from "three";
import { GBufferFragmentShader, GBufferDebugShaderA, GBufferDebugShaderB, GBufferDebugShaderC, GBufferDebugShaderD } from "../shaders/GBufferShaders";

export class GBuffers {
    constructor(width: number, height: number, scene: THREE.Scene, camera: THREE.Camera);
    
    GBuffer: THREE.WebGLMultipleRenderTargets;
    GTextures: {
      normal: THREE.Texture;
      position: THREE.Texture;
      albedo: THREE.Texture;
      material: THREE.Texture;
    };
    bufferMaterial: THREE.RawShaderMaterial;
    scene: THREE.Scene;
    camera: THREE.Camera;
    originalClearColor: THREE.Color;
    visibleMeshes: THREE.Mesh[];
    cachedMaterials: WeakMap<THREE.Mesh, [THREE.Material, THREE.RawShaderMaterial]>;
    defaultWhiteTexture: THREE.DataTexture;

    render(renderer: THREE.WebGLRenderer): void;
    getVisibleChildren(object: THREE.Object3D): THREE.Mesh[];
    copyNecessaryProps(originalMaterial: THREE.Material, newMaterial: THREE.RawShaderMaterial): void;
    renderOverride(renderer: THREE.WebGLRenderer, overrideMaterial: THREE.RawShaderMaterial, renderTarget: THREE.WebGLMultipleRenderTargets, clearColor: THREE.Color, clearAlpha: number): void;
    renderToScreen(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, type: number): void;
}