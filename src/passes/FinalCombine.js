import { ShaderMaterial, UniformsUtils } from 'three';
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { TAAAccumulateShader } from '../shaders/taa/TAAAccumulateShader';
import { FinalCombineShader } from '../shaders/FinalCombineShader';
import { BlitShader } from '../shaders/BlitShader';

// 最终合并Pass
export default class FinalCombine {
    constructor(width, height) {
        // 定义合并Shader
        const combineShader = FinalCombineShader;

        // 定义合并Shader的uniforms
        this.combineUniforms = UniformsUtils.clone(combineShader.uniforms);

        // 创建合并Shader的材质
        this.combineMaterial = new ShaderMaterial({
            uniforms: this.combineUniforms,
            vertexShader: combineShader.vertexShader,
            fragmentShader: combineShader.fragmentShader,
            // glslVersion: THREE.GLSL3,
        });

        // 创建合并Shader的全屏四边形
        this.combineFsQuad = new FullScreenQuad(this.combineMaterial);
    }

    // 渲染到writeBuffer
    render(renderer, writeBuffer, clear) {
        renderer.setRenderTarget(writeBuffer);
        if (clear) renderer.clear();
        this.combineFsQuad.render(renderer);
    }

    // 释放资源
    dispose() {
        this.combineFsQuad.dispose();
    }
}
