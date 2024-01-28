import { ShaderMaterial, UniformsUtils } from 'three';
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { TAAAccumulateShader } from '../shaders/taa/TAAAccumulateShader';
import { FinalCombineShader } from '../shaders/FinalCombineShader';
import { BlitShader } from '../shaders/BlitShader';

// 最终合并Pass
export class FinalCombine {
    constructor(width: number, height: number);

    combineUniforms: any;
    combineMaterial: THREE.ShaderMaterial;
    combineFsQuad: FullScreenQuad;
  
    render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, clear: boolean): void;
    dispose(): void;
}
