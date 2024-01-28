import { ShaderMaterial, UniformsUtils } from 'three';
import * as THREE from 'three';
import { FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { SSSRIntersectionShader } from '../shaders/sssr/SSSRIntersectionShader';
import { SSSRSpatialShader } from '../shaders/sssr/SSSRSpatialShader';
import { SSSRTemporalShader } from '../shaders/sssr/SSSRTemporalShader';
import { CrossBilateralFiltrerShader } from '../shaders/CrossBilateralFiltrerShader';

export default class StochasticSSR {
    constructor(width, height) {
        // 定义SSSR光线求交Shader、uniforms、材质、全屏四边形、渲染目标
        const intersectionShader = SSSRIntersectionShader;
        this.intersectionUniforms = UniformsUtils.clone(intersectionShader.uniforms);
        this.intersectionMaterial = new ShaderMaterial({
            uniforms: this.intersectionUniforms,
            vertexShader: intersectionShader.vertexShader,
            fragmentShader: intersectionShader.fragmentShader,
            // glslVersion: THREE.GLSL3,
        });
        this.intersectionFsQuad = new FullScreenQuad(this.intersectionMaterial);
        this.intersectionRT = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            depthBuffer: false,
        });

        // 定义空间滤波Shader、uniforms、材质、全屏四边形
        const spatialShader = SSSRSpatialShader;
        this.spatialUniforms = UniformsUtils.clone(spatialShader.uniforms);
        this.spatialMaterial = new ShaderMaterial({
            uniforms: this.spatialUniforms,
            vertexShader: spatialShader.vertexShader,
            fragmentShader: spatialShader.fragmentShader,
            // glslVersion: THREE.GLSL3,
        });
        this.spatialFsQuad = new FullScreenQuad(this.spatialMaterial);

        // 定义时间滤波渲染目标
        this.currColorRT = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            depthBuffer: false,
        });

        this.prevColorRT = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            depthBuffer: false,
        });

        this.temporalResultRT = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            depthBuffer: false,
        });

        // 定义时间滤波Shader、uniforms、材质、全屏四边形
        const temporalShader = SSSRTemporalShader;
        this.temporalUniforms = UniformsUtils.clone(temporalShader.uniforms);
        this.temporalMaterial = new ShaderMaterial({
            uniforms: this.temporalUniforms,
            vertexShader: temporalShader.vertexShader,
            fragmentShader: temporalShader.fragmentShader,
            // glslVersion: THREE.GLSL3,
        });
        this.temporalFsQuad = new FullScreenQuad(this.temporalMaterial);

        // 定义清理滤波Shader、uniforms、材质、全屏四边形、清理次数
        const cleanUpShader = CrossBilateralFiltrerShader;
        this.cleanUpUniforms = UniformsUtils.clone(cleanUpShader.uniforms);
        this.cleanUpMaterial = new ShaderMaterial({
            uniforms: this.cleanUpUniforms,
            vertexShader: cleanUpShader.vertexShader,
            fragmentShader: cleanUpShader.fragmentShader,
            // glslVersion: THREE.GLSL3,
        });
        this.cleanUpFsQuad = new FullScreenQuad(this.cleanUpMaterial);
        this.cleanUpTimes = 2;

        // 定义最终效果渲染目标
        this.finalResultRT = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            depthBuffer: false,
        });
    }

    // 渲染到writeBuffer
    render(renderer, renderTarget, clear) {
        // 渲染光线求交结果到intersectionRT
        renderer.setRenderTarget(this.intersectionRT);
        this.intersectionFsQuad.render(renderer);

        // 渲染空间滤波结果到currColorRT
        renderer.setRenderTarget(this.currColorRT);
        this.spatialFsQuad.render(renderer);

        // 渲染时间滤波结果到temporalResultRT
        renderer.setRenderTarget(this.temporalResultRT);
        this.temporalFsQuad.render(renderer);
        // this.prevColorRT = this.temporalResultRT.clone();

        // 渲染清理滤波结果到finalResultRT
        renderer.setRenderTarget(this.finalResultRT);
        this.cleanUpFsQuad.render(renderer);

        // 循环渲染清理滤波，最后一次渲染时，将结果渲染到结果到renderTarget
        for (let i = 1; i < this.cleanUpTimes; i++) {
            let temp1 = this.temporalResultRT;
            this.temporalResultRT = this.finalResultRT;
            this.finalResultRT = temp1;
            this.cleanUpUniforms['uStep'].value += 0.8;

            if (i == this.cleanUpTimes - 1) {
                renderer.setRenderTarget(renderTarget);
                if (clear) renderer.clear();
            }
            this.cleanUpFsQuad.render(renderer);
        }

        // if ( isRenderToScreen ) {
        //     renderer.setRenderTarget( null );
        //     this.combineFsQuad.render(renderer);
        // } else {
        //     renderer.setRenderTarget( renderTarget );
        //     if ( clear ) renderer.clear();
        //     this.combineFsQuad.render(renderer);
        // }

        // 交换prevColorRT和temporalResultRT
        let temp2 = this.temporalResultRT;
        this.temporalResultRT = this.prevColorRT;
        this.prevColorRT = temp2;
    }

    // 释放资源
    dispose() {
        this.intersectionFsQuad.dispose();
        this.spatialFsQuad.dispose();
        this.temporalFsQuad.dispose();
        this.cleanUpFsQuad.dispose();

        this.intersectionRT.dispose();
        this.currColorRT.dispose();
        this.prevColorRT.dispose();
        this.temporalResultRT.dispose();
        this.finalResultRT.dispose();
    }
}
