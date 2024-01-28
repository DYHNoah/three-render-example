import * as THREE from "three";
import { Pass } from "three/examples/jsm/postprocessing/Pass.js";
import { FullScreenQuad } from "three/examples/jsm/postprocessing/Pass.js";
import {
  getSurfaceIdMaterial,
} from "./FindSurfaces.js";

export class CustomOutlinePass extends Pass{
    constructor(resolution: THREE.Vector2, scene:THREE.Scene, camera:THREE.Camera);
    renderScene: THREE.Scene;
    renderCamera: THREE.Camera;
    resolution: THREE.Vector2;
    fsQuad: THREE.FullScreenQuad;
    surfaceBuffer: THREE.WebGLRenderTarget;
    normalOverrideMaterial: THREE.MeshNormalMaterial;
    surfaceIdOverrideMaterial: THREE.ShaderMaterial;

    dispose(): void;
    updateMaxSurfaceId(maxSurfaceId: number): void;
    setSize(width: number, height: number): void;
    render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget<THREE.Texture>, readBuffer: THREE.WebGLRenderTarget<THREE.Texture>, deltaTime: number, maskActive: boolean): void;
    createOutlinePostProcessMaterial(): THREE.ShaderMaterial;
}