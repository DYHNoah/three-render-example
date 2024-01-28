import { ShaderMaterial, UniformsUtils } from 'three';
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { SSSRIntersectionShader } from '../shaders/sssr/SSSRIntersectionShader';
import { SSSRSpatialShader } from '../shaders/sssr/SSSRSpatialShader';
import { SSSRTemporalShader } from '../shaders/sssr/SSSRTemporalShader';
import { CrossBilateralFiltrerShader } from '../shaders/CrossBilateralFiltrerShader';

export class StochasticSSR {
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