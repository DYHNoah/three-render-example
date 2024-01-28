import * as THREE from 'three';

import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import StochasticSSR from './StochasticSSR';
import ScreenSpaceGI from './ScreenSpaceGI';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import FinalCombine from './FinalCombine';
import GBuffers from '../utils/GBuffers';
import { SSAOPass } from './SSAOPass';

class DeferredRenderPass extends Pass {
    constructor({ scene, renderer, camera, controls, width, height, settings }) {
        super();

        // 定义renderPass
        this.renderPass = new RenderPass(scene, camera);

        // 创建SSAO Pass
        this.SSAO = new SSAOPass(scene, camera, width, height);

        // 创建SSSR Pass
        this.SSSR = new StochasticSSR(width, height);

        // 创建SSGI Pass
        this.SSGI = new ScreenSpaceGI(width, height);

        // 创建Combine Pass，用于将SSSR和SSGI等的结果合并
        this.Combine = new FinalCombine(width, height);

        // 定义渲染目标
        this.SceneColorRT = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            depthBuffer: true,
        });
        this.SSAORT = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            depthBuffer: true,
        });
        this.SSSRResultRT = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            depthBuffer: false,
        });
        this.SSGIResultRT = new THREE.WebGLRenderTarget(width, height, {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            type: THREE.FloatType,
            depthBuffer: false,
        });

        // 定义场景参数
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.contorls = controls;
        this.camPos = camera.position.clone();
        this.resolution = new THREE.Vector2(width, height);
        this.invResolution = new THREE.Vector2(1 / width, 1 / height);

        // 定义GBuffer
        this.gbuffers = new GBuffers(width, height, scene, camera);

        // 定义渲染设置
        this.settings = settings;

        // 定义帧数，用于生成输入给shader的随机数
        this.frameIndexMod64 = 0;
    }

    // 刷新帧数
    RefreshframeIndexMod64() {
        this.frameIndexMod64++;
        this.frameIndexMod64 = this.frameIndexMod64 % 648;
    }

    // 渲染
    render(renderer, writeBuffer, readBuffer, deltaTime /*, maskActive */) {
        // 生成帧数
        this.RefreshframeIndexMod64();

        // 渲染GBuffer
        this.gbuffers.render(renderer);

        // 渲染场景
        this.renderPass.render(renderer, readBuffer, this.SceneColorRT);

        // 如果启用了SSAO
        if (this.settings.ssao.enabled) {
            // 设置SSAO参数
            this.SSAO.minDistance = 0.00001;
            this.SSAO.maxDistance = 0.01;
            this.SSAO.kernelRadius = this.settings.ssao.kernelRadius * 0.005;
            this.SSAO.output = 0;

            // 渲染SSAO
            this.SSAO.render(renderer, this.SceneColorRT, this.SSAORT);
        } else {
            // 如果没有启用SSAO，仅将场景颜色渲染到SSAORT即可
            this.SSAORT = this.SceneColorRT;
        }

        // Stochastic SSR
        if (this.settings.sssr.enabled || this.settings.outputType == 1) {
            // 设置SSSR参数
            this.SSSR.intersectionUniforms['tDiffuse'].value = this.SceneColorRT.texture;
            this.SSSR.intersectionUniforms['uColor'].value = this.SceneColorRT.texture;
            this.SSSR.intersectionUniforms['uFrameIndexMod64'].value = this.frameIndexMod64;
            this.SSSR.intersectionUniforms['uNormal'].value = this.gbuffers.GTextures.normal;
            this.SSSR.intersectionUniforms['uPosition'].value = this.gbuffers.GTextures.position;
            this.SSSR.intersectionUniforms['uAlbedo'].value = this.gbuffers.GTextures.albedo;
            this.SSSR.intersectionUniforms['uMaterial'].value = this.gbuffers.GTextures.material;
            this.SSSR.intersectionUniforms['uCameraPos'].value = this.camera.position;
            this.SSSR.intersectionUniforms['uResolution'].value = this.settings.sssr.resolution;
            this.SSSR.intersectionUniforms['uSamples'].value = this.settings.sssr.rays;
            this.SSSR.intersectionUniforms['uProjectionMatrix'].value =
                this.camera.projectionMatrix;
            this.SSSR.intersectionUniforms['uProjViewMatrix'].value = this.camera.projectionMatrix
                .clone()
                .multiply(this.camera.matrixWorldInverse);
            this.SSSR.intersectionUniforms['uViewMatrix'].value = this.camera.matrixWorldInverse;
            this.SSSR.intersectionUniforms['uRoughnessMultiplier'].value =
                this.settings.sssr.roughnessMultiplier;
            this.SSSR.intersectionUniforms['uMetallicMultiplier'].value =
                this.settings.sssr.metallicMultiplier;
            
            
            this.SSSR.spatialUniforms['uIntersectionRT'].value = this.SSSR.intersectionRT.texture;
            this.SSSR.spatialUniforms['uColor'].value = readBuffer.texture;
            this.SSSR.spatialUniforms['uNormal'].value = this.gbuffers.GTextures.normal;
            this.SSSR.spatialUniforms['uPosition'].value = this.gbuffers.GTextures.position;
            this.SSSR.spatialUniforms['uAlbedo'].value = this.gbuffers.GTextures.albedo;
            this.SSSR.spatialUniforms['uMaterial'].value = this.gbuffers.GTextures.material;
            this.SSSR.spatialUniforms['uResolution'].value = this.settings.sssr.resolution;
            this.SSSR.spatialUniforms['uInvResolution'].value = this.invResolution;

            this.SSSR.temporalUniforms['uInvResolution'].value = this.invResolution;
            this.SSSR.temporalUniforms['uPosition'].value = this.gbuffers.GTextures.position;
            this.SSSR.temporalUniforms['uCurrColorRT'].value = this.SSSR.currColorRT.texture;
            this.SSSR.temporalUniforms['uPrevColorRT'].value = this.SSSR.prevColorRT.texture;

            this.SSSR.cleanUpUniforms['uInvResolution'].value = this.invResolution;
            this.SSSR.cleanUpUniforms['uStep'].value = 1.5;
            this.SSSR.cleanUpUniforms['uPosition'].value = this.gbuffers.GTextures.position;
            this.SSSR.cleanUpUniforms['uNormal'].value = this.gbuffers.GTextures.normal;
            this.SSSR.cleanUpUniforms['tDiffuse'].value = this.SSSR.temporalResultRT.texture;

            this.SSSR.cleanUpTimes = this.settings.sssr.denoiseKernelStep;

            // 渲染SSSR
            this.SSSR.render(renderer, this.SSSRResultRT, this.clear);

            // 将SSSR的结果传入Combine Pass
            this.Combine.combineUniforms['uSSSRColorRT'].value = this.SSSRResultRT.texture;
        } else {
            // 如果没有启用SSSR，将SSSR的结果置空
            this.Combine.combineUniforms['uSSSRColorRT'].value = null;
        }

        // SSGI
        if (this.settings.ssgi.enabled || this.settings.outputType == 2) {
            // 设置SSGI参数
            this.SSGI.intersectionUniforms['tDiffuse'].value = this.SceneColorRT.texture;
            this.SSGI.intersectionUniforms['uColor'].value = this.SceneColorRT.texture;
            this.SSGI.intersectionUniforms['uFrameIndexMod64'].value = this.frameIndexMod64;
            this.SSGI.intersectionUniforms['uNormal'].value = this.gbuffers.GTextures.normal;
            this.SSGI.intersectionUniforms['uPosition'].value = this.gbuffers.GTextures.position;
            this.SSGI.intersectionUniforms['uAlbedo'].value = this.gbuffers.GTextures.albedo;
            this.SSGI.intersectionUniforms['uMaterial'].value = this.gbuffers.GTextures.material;
            this.SSGI.intersectionUniforms['uCameraPos'].value = this.camera.position;
            this.SSGI.intersectionUniforms['uResolution'].value = this.settings.ssgi.resolution;
            this.SSGI.intersectionUniforms['uSamples'].value = this.settings.ssgi.rays;
            this.SSGI.intersectionUniforms['uProjectionMatrix'].value =
                this.camera.projectionMatrix;
            this.SSGI.intersectionUniforms['uProjViewMatrix'].value = this.camera.projectionMatrix
                .clone()
                .multiply(this.camera.matrixWorldInverse);
            this.SSGI.intersectionUniforms['uViewMatrix'].value = this.camera.matrixWorldInverse;
            this.SSGI.intersectionUniforms['uRoughnessMultiplier'].value =
                this.settings.ssgi.roughnessMultiplier;

            this.SSGI.spatialUniforms['uIntersectionRT'].value = this.SSGI.intersectionRT.texture;
            this.SSGI.spatialUniforms['uColor'].value = writeBuffer.texture;
            this.SSGI.spatialUniforms['uNormal'].value = this.gbuffers.GTextures.normal;
            this.SSGI.spatialUniforms['uPosition'].value = this.gbuffers.GTextures.position;
            this.SSGI.spatialUniforms['uAlbedo'].value = this.gbuffers.GTextures.albedo;
            this.SSGI.spatialUniforms['uMaterial'].value = this.gbuffers.GTextures.material;
            this.SSGI.spatialUniforms['uResolution'].value = this.settings.ssgi.resolution;
            this.SSGI.spatialUniforms['uInvResolution'].value = this.invResolution;

            this.SSGI.temporalUniforms['uInvResolution'].value = this.invResolution;
            this.SSGI.temporalUniforms['uPosition'].value = this.gbuffers.GTextures.position;
            this.SSGI.temporalUniforms['uCurrColorRT'].value = this.SSGI.currColorRT.texture;
            this.SSGI.temporalUniforms['uPrevColorRT'].value = this.SSGI.prevColorRT.texture;

            this.SSGI.cleanUpUniforms['uInvResolution'].value = this.invResolution;
            this.SSGI.cleanUpUniforms['uStep'].value = 3.0;
            this.SSGI.cleanUpUniforms['uPosition'].value = this.gbuffers.GTextures.position;
            this.SSGI.cleanUpUniforms['uNormal'].value = this.gbuffers.GTextures.normal;
            this.SSGI.cleanUpUniforms['tDiffuse'].value = this.SSGI.temporalResultRT.texture;

            this.SSGI.cleanUpTimes = this.settings.ssgi.denoiseKernelStep;

            // 渲染SSGI
            this.SSGI.render(renderer, this.SSGIResultRT, this.clear);

            // 将SSGI的结果传入Combine Pass
            this.Combine.combineUniforms['uSSGIColorRT'].value = this.SSGIResultRT.texture;
        } else {
            // 如果没有启用SSGI，将SSGI的结果置空
            this.Combine.combineUniforms['uSSGIColorRT'].value = null;
        }

        // 传入GBuffer中的Albedo，用于Combine Pass中的SSGI合并算法
        this.Combine.combineUniforms['uAlbedoRT'].value = this.gbuffers.GTextures.albedo;

        if (this.settings.outputType == 0) {
            // 默认设置，渲染SSSR + SSGI，并将结果合并到场景颜色中
            // 传入场景颜色，用于Combine Pass的合并算法
            this.Combine.combineUniforms['uSceneColorRT'].value = this.SSAORT.texture;
        } else if (this.settings.outputType == 1) {
            // 仅Debug SSSR的效果
            // 将SSGI和场景颜色置空
            this.Combine.combineUniforms['uSSGIColorRT'].value = null;
            this.Combine.combineUniforms['uSceneColorRT'].value = null;
        } else {
            // 仅Debug SSGI的效果
            // 将SSSR和场景颜色置空
            this.Combine.combineUniforms['uSSSRColorRT'].value = null;
            this.Combine.combineUniforms['uSceneColorRT'].value = null;
        }

        // 渲染合并结果
        if (this.renderToScreen) {
            this.Combine.render(renderer, null, this.clear);
        } else {
            this.Combine.render(renderer, writeBuffer, this.clear);
        }

        // TAA参数设置
        if (this.settings.taa.enabled) {
            if (this.camera.position.distanceTo(this.camPos) > 0.1) {
                this.SSSR.temporalUniforms['uTemporalWeight'].value = 0.75;
                this.SSGI.temporalUniforms['uTemporalWeight'].value = 0.96;
            } else {
                this.SSSR.temporalUniforms['uTemporalWeight'].value = 0.98;
                this.SSGI.temporalUniforms['uTemporalWeight'].value = 0.98;
            }
        } else {
            this.SSSR.temporalUniforms['uTemporalWeight'].value = 0;
            this.SSGI.temporalUniforms['uTemporalWeight'].value = 0;
        }

        // 为下一帧的TAA准备此帧的视口投影矩阵数据
        this.SSSR.temporalUniforms['uPrevViewProjMatrix'].value = this.camera.projectionMatrix
            .clone()
            .multiply(this.camera.matrixWorldInverse)
            .clone();
        this.SSGI.temporalUniforms['uPrevViewProjMatrix'].value = this.camera.projectionMatrix
            .clone()
            .multiply(this.camera.matrixWorldInverse)
            .clone();

        // 为下一帧的TAA准备此帧的相机位置数据
        this.camPos = this.camera.position.clone();
    }

    // 释放资源
    dispose() {
        this.SSSR.dispose();
        this.SSGI.dispose();
        this.Combine.dispose();
        this.TAA.dispose();
        this.SSAO.dispose();
    }
}

export { DeferredRenderPass };
