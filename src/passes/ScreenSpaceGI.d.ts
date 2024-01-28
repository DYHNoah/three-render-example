import { ShaderMaterial, UniformsUtils } from 'three';
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { SSGIIntersectionShader } from '../shaders/ssgi/SSGIIntersectionShader';
import { SSGISpatialShader } from '../shaders/ssgi/SSGISpatialShader';
import { SSGITemporalShader } from '../shaders/ssgi/SSGITemporalShader';
import { CrossBilateralFiltrerShader } from '../shaders/CrossBilateralFiltrerShader';

export class ScreenSpaceGI {
    constructor(width: number, height: number);
    intersectionUniforms: { [uniform: string]: THREE.IUniform };
    intersectionMaterial: THREE.ShaderMaterial;
    intersectionFsQuad: THREE.FullScreenQuad;
    intersectionRT: THREE.WebGLRenderTarget;

    spatialUniforms: { [uniform: string]: THREE.IUniform };
    spatialMaterial: THREE.ShaderMaterial;
    spatialFsQuad: THREE.FullScreenQuad;
    currColorRT: THREE.WebGLRenderTarget;
    prevColorRT: THREE.WebGLRenderTarget;

    temporalUniforms: { [uniform: string]: THREE.IUniform };
    temporalMaterial: THREE.ShaderMaterial;
    temporalFsQuad: THREE.FullScreenQuad;
    temporalResultRT: THREE.WebGLRenderTarget;

    cleanUpUniforms: { [uniform: string]: THREE.IUniform };
    cleanUpMaterial: THREE.ShaderMaterial;
    cleanUpFsQuad: THREE.FullScreenQuad;
    cleanUpTimes: number;

    finalResultRT: THREE.WebGLRenderTarget;

    render(renderer: THREE.WebGLRenderer, renderTarget: THREE.WebGLRenderTarget | null, clear: boolean): void;
    dispose(): void;
}