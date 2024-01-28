import {
    AddEquation,
    Color,
    CustomBlending,
    DataTexture,
    DepthTexture,
    DstAlphaFactor,
    DstColorFactor,
    FloatType,
    HalfFloatType,
    MathUtils,
    MeshNormalMaterial,
    NearestFilter,
    NoBlending,
    RedFormat,
    LuminanceFormat,
    DepthStencilFormat,
    UnsignedInt248Type,
    RepeatWrapping,
    ShaderMaterial,
    UniformsUtils,
    Vector3,
    WebGLRenderTarget,
    ZeroFactor,
} from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import { SimplexNoise } from 'three/examples/jsm/math/SimplexNoise.js';
import { SSAOShader } from '../shaders/ssao/SSAOShader.js';
import { SSAOBlurShader } from '../shaders/ssao/SSAOShader.js';
import { SSAODepthShader } from '../shaders/ssao/SSAOShader.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';

class SSAOPass extends Pass {
    constructor(scene, camera, width, height) {
        super();

        // 设置默认宽度和高度为512
        this.width = width !== undefined ? width : 512;
        this.height = height !== undefined ? height : 512;

        // 是否清除画布
        this.clear = true;

        // 相机和场景
        this.camera = camera;
        this.scene = scene;

        // SSAO算法参数
        this.kernelRadius = 16; // 核的半径
        this.kernelSize = 64; // 核的大小
        this.kernel = []; // 核
        this.noiseTexture = null; // 噪音纹理
        this.output = 0; // 输出

        // SSAO影响范围
        this.minDistance = 0.005; // 最小距离
        this.maxDistance = 0.3; // 最大距离

        // 可见性缓存
        this._visibilityCache = new Map();

        // 生成样本采样核
        this.generateSampleKernel();
        // 生成随机采样核旋转
        this.generateRandomKernelRotations();

        // 深度纹理
        const depthTexture = new DepthTexture();
        depthTexture.format = DepthStencilFormat;
        depthTexture.type = UnsignedInt248Type;

        // 原画布渲染目标
        this.beautyRenderTarget = new WebGLRenderTarget(this.width, this.height, {
            type: HalfFloatType,
        });

        // 带深度缓冲的法线渲染目标
        this.normalRenderTarget = new WebGLRenderTarget(this.width, this.height, {
            minFilter: NearestFilter,
            magFilter: NearestFilter,
            type: HalfFloatType,
            depthTexture: depthTexture,
        });

        // SSAO渲染目标
        this.ssaoRenderTarget = new WebGLRenderTarget(this.width, this.height, {
            type: HalfFloatType,
        });

        this.blurRenderTarget = this.ssaoRenderTarget.clone(); // 模糊渲染目标

        // SSAO材质
        this.ssaoMaterial = new ShaderMaterial({
            defines: Object.assign({}, SSAOShader.defines),
            uniforms: UniformsUtils.clone(SSAOShader.uniforms),
            vertexShader: SSAOShader.vertexShader,
            fragmentShader: SSAOShader.fragmentShader,
            blending: NoBlending,
        });

        // 设置SSAO材质的纹理和参数
        this.ssaoMaterial.uniforms['tDiffuse'].value = this.beautyRenderTarget.texture;
        this.ssaoMaterial.uniforms['tNormal'].value = this.normalRenderTarget.texture;
        this.ssaoMaterial.uniforms['tDepth'].value = this.normalRenderTarget.depthTexture;
        this.ssaoMaterial.uniforms['tNoise'].value = this.noiseTexture;
        this.ssaoMaterial.uniforms['kernel'].value = this.kernel;
        this.ssaoMaterial.uniforms['cameraNear'].value = this.camera.near;
        this.ssaoMaterial.uniforms['cameraFar'].value = this.camera.far;
        this.ssaoMaterial.uniforms['resolution'].value.set(this.width, this.height);
        this.ssaoMaterial.uniforms['cameraProjectionMatrix'].value.copy(
            this.camera.projectionMatrix
        );
        this.ssaoMaterial.uniforms['cameraInverseProjectionMatrix'].value.copy(
            this.camera.projectionMatrixInverse
        );

        // 法线材质
        this.normalMaterial = new MeshNormalMaterial();
        this.normalMaterial.blending = NoBlending;

        // 模糊材质
        this.blurMaterial = new ShaderMaterial({
            defines: Object.assign({}, SSAOBlurShader.defines),
            uniforms: UniformsUtils.clone(SSAOBlurShader.uniforms),
            vertexShader: SSAOBlurShader.vertexShader,
            fragmentShader: SSAOBlurShader.fragmentShader,
        });
        this.blurMaterial.uniforms['tDiffuse'].value = this.ssaoRenderTarget.texture;
        this.blurMaterial.uniforms['resolution'].value.set(this.width, this.height);

        // 用于渲染深度的材质
        this.depthRenderMaterial = new ShaderMaterial({
            defines: Object.assign({}, SSAODepthShader.defines),
            uniforms: UniformsUtils.clone(SSAODepthShader.uniforms),
            vertexShader: SSAODepthShader.vertexShader,
            fragmentShader: SSAODepthShader.fragmentShader,
            blending: NoBlending,
        });
        this.depthRenderMaterial.uniforms['tDepth'].value = this.normalRenderTarget.depthTexture;
        this.depthRenderMaterial.uniforms['cameraNear'].value = this.camera.near;
        this.depthRenderMaterial.uniforms['cameraFar'].value = this.camera.far;

        // 用于渲染渲染目标内容的材质
        this.copyMaterial = new ShaderMaterial({
            uniforms: UniformsUtils.clone(CopyShader.uniforms),
            vertexShader: CopyShader.vertexShader,
            fragmentShader: CopyShader.fragmentShader,
            transparent: true,
            depthTest: false,
            depthWrite: false,
            blendSrc: DstColorFactor,
            blendDst: ZeroFactor,
            blendEquation: AddEquation,
            blendSrcAlpha: DstAlphaFactor,
            blendDstAlpha: ZeroFactor,
            blendEquationAlpha: AddEquation,
        });

        // 全屏四边形
        this.fsQuad = new FullScreenQuad(null);

        // 原始背景颜色
        this.originalClearColor = new Color();
    }

    // 释放资源
    dispose() {
        this.beautyRenderTarget.dispose();
        this.normalRenderTarget.dispose();
        this.ssaoRenderTarget.dispose();
        this.blurRenderTarget.dispose();
        this.normalMaterial.dispose();
        this.blurMaterial.dispose();
        this.copyMaterial.dispose();
        this.depthRenderMaterial.dispose();
        this.fsQuad.dispose();
    }

    render(renderer, beautyRenderTarget, writeBuffer /*, readBuffer, deltaTime, maskActive */) {
        // 如果不支持WebGL2，将噪音纹理格式设置为亮度格式
        if (renderer.capabilities.isWebGL2 === false) {
            this.noiseTexture.format = LuminanceFormat;
            console.log('1');
        }

        // 使用输入的beautyRenderTarget（已经渲染好的原画布上的场景）
        this.beautyRenderTarget = beautyRenderTarget;

        // 原渲染方法（已弃用）
        // renderer.setRenderTarget( this.beautyRenderTarget );
        // renderer.clear();
        // renderer.render( this.scene, this.camera );

        // 渲染法线和深度（只考虑网格，点和线不会影响SSAO）

        // this.normalRenderTarget = normalRenderTarget;
        this.overrideVisibility();
        this.renderOverride(renderer, this.normalMaterial, this.normalRenderTarget, 0x7777ff, 1.0);
        this.restoreVisibility();

        // 渲染SSAO

        this.ssaoMaterial.uniforms['kernelRadius'].value = this.kernelRadius;
        this.ssaoMaterial.uniforms['minDistance'].value = this.minDistance;
        this.ssaoMaterial.uniforms['maxDistance'].value = this.maxDistance;
        this.renderPass(renderer, this.ssaoMaterial, this.ssaoRenderTarget);

        // 渲染模糊

        this.renderPass(renderer, this.blurMaterial, this.blurRenderTarget);

        // 输出结果到屏幕

        switch (this.output) {
            case SSAOPass.OUTPUT.SSAO:
                this.copyMaterial.uniforms['tDiffuse'].value = this.ssaoRenderTarget.texture;
                this.copyMaterial.blending = NoBlending;
                this.renderPass(
                    renderer,
                    this.copyMaterial,
                    this.renderToScreen ? null : writeBuffer
                );

                break;

            case SSAOPass.OUTPUT.Blur:
                this.copyMaterial.uniforms['tDiffuse'].value = this.blurRenderTarget.texture;
                this.copyMaterial.blending = NoBlending;
                this.renderPass(
                    renderer,
                    this.copyMaterial,
                    this.renderToScreen ? null : writeBuffer
                );

                break;

            case SSAOPass.OUTPUT.Beauty:
                this.copyMaterial.uniforms['tDiffuse'].value = this.beautyRenderTarget.texture;
                this.copyMaterial.blending = NoBlending;
                this.renderPass(
                    renderer,
                    this.copyMaterial,
                    this.renderToScreen ? null : writeBuffer
                );

                break;

            case SSAOPass.OUTPUT.Depth:
                this.renderPass(
                    renderer,
                    this.depthRenderMaterial,
                    this.renderToScreen ? null : writeBuffer
                );

                break;

            case SSAOPass.OUTPUT.Normal:
                this.copyMaterial.uniforms['tDiffuse'].value = this.normalRenderTarget.texture;
                this.copyMaterial.blending = NoBlending;
                this.renderPass(
                    renderer,
                    this.copyMaterial,
                    this.renderToScreen ? null : writeBuffer
                );

                break;

            case SSAOPass.OUTPUT.Default:
                this.copyMaterial.uniforms['tDiffuse'].value = this.beautyRenderTarget.texture;
                this.copyMaterial.blending = NoBlending;
                this.renderPass(
                    renderer,
                    this.copyMaterial,
                    this.renderToScreen ? null : writeBuffer
                );

                this.copyMaterial.uniforms['tDiffuse'].value = this.blurRenderTarget.texture;
                this.copyMaterial.blending = CustomBlending;
                this.renderPass(
                    renderer,
                    this.copyMaterial,
                    this.renderToScreen ? null : writeBuffer
                );

                break;

            default:
                console.warn('THREE.SSAOPass: Unknown output type.');
        }
    }

    renderPass(renderer, passMaterial, renderTarget, clearColor, clearAlpha) {
        // 保存原始状态
        renderer.getClearColor(this.originalClearColor);
        const originalClearAlpha = renderer.getClearAlpha();
        const originalAutoClear = renderer.autoClear;

        renderer.setRenderTarget(renderTarget);

        // 设置通道状态
        renderer.autoClear = false;
        if (clearColor !== undefined && clearColor !== null) {
            renderer.setClearColor(clearColor);
            renderer.setClearAlpha(clearAlpha || 0.0);
            renderer.clear();
        }

        this.fsQuad.material = passMaterial;
        this.fsQuad.render(renderer);

        // 还原通道状态
        renderer.autoClear = originalAutoClear;
        renderer.setClearColor(this.originalClearColor);
        renderer.setClearAlpha(originalClearAlpha);
    }

    // 使用指定的材质渲染场景，覆盖原始材质。
    renderOverride(renderer, overrideMaterial, renderTarget, clearColor, clearAlpha) {
        // 保存原始状态
        renderer.getClearColor(this.originalClearColor);
        const originalClearAlpha = renderer.getClearAlpha();
        const originalAutoClear = renderer.autoClear;

        // 设置渲染目标和自动清除
        renderer.setRenderTarget(renderTarget);
        renderer.autoClear = false;

        // 根据覆盖材质设置清除颜色和透明度
        clearColor = overrideMaterial.clearColor || clearColor;
        clearAlpha = overrideMaterial.clearAlpha || clearAlpha;

        if (clearColor !== undefined && clearColor !== null) {
            renderer.setClearColor(clearColor);
            renderer.setClearAlpha(clearAlpha || 0.0);
            renderer.clear();
        }

        // 使用覆盖材质渲染场景
        this.scene.overrideMaterial = overrideMaterial;
        renderer.render(this.scene, this.camera);
        this.scene.overrideMaterial = null;

        // 恢复原始状态
        renderer.autoClear = originalAutoClear;
        renderer.setClearColor(this.originalClearColor);
        renderer.setClearAlpha(originalClearAlpha);
    }

    // 设置渲染器的宽度和高度，并调整渲染目标的大小和相关参数。
    setSize(width, height) {
        this.width = width;
        this.height = height;

        // 调整渲染目标的大小
        this.beautyRenderTarget.setSize(width, height);
        this.ssaoRenderTarget.setSize(width, height);
        this.normalRenderTarget.setSize(width, height);
        this.blurRenderTarget.setSize(width, height);

        // 更新SSAO材质和模糊材质的分辨率参数
        this.ssaoMaterial.uniforms['resolution'].value.set(width, height);
        this.ssaoMaterial.uniforms['cameraProjectionMatrix'].value.copy(
            this.camera.projectionMatrix
        );
        this.ssaoMaterial.uniforms['cameraInverseProjectionMatrix'].value.copy(
            this.camera.projectionMatrixInverse
        );

        this.blurMaterial.uniforms['resolution'].value.set(width, height);
    }

    //生成采样核样本。
    generateSampleKernel() {
        const kernelSize = this.kernelSize;
        const kernel = this.kernel;

        for (let i = 0; i < kernelSize; i++) {
            const sample = new Vector3();
            sample.x = Math.random() * 2 - 1;
            sample.y = Math.random() * 2 - 1;
            sample.z = Math.random();

            sample.normalize();

            let scale = i / kernelSize;
            scale = MathUtils.lerp(0.1, 1, scale * scale);
            sample.multiplyScalar(scale);

            kernel.push(sample);
        }
    }

    // 生成随机采样核旋转纹理

    generateRandomKernelRotations() {
        const width = 4,
            height = 4;

        const simplex = new SimplexNoise();

        const size = width * height;
        const data = new Float32Array(size);

        for (let i = 0; i < size; i++) {
            const x = Math.random() * 2 - 1;
            const y = Math.random() * 2 - 1;
            const z = 0;

            data[i] = simplex.noise3d(x, y, z);
        }

        this.noiseTexture = new DataTexture(data, width, height, RedFormat, FloatType);
        this.noiseTexture.wrapS = RepeatWrapping;
        this.noiseTexture.wrapT = RepeatWrapping;
        this.noiseTexture.needsUpdate = true;
    }

    // 临时隐藏场景中的点和线，用于SSAO渲染。
    overrideVisibility() {
        const scene = this.scene;
        const cache = this._visibilityCache;

        scene.traverse(function (object) {
            cache.set(object, object.visible);

            if (object.isPoints || object.isLine) object.visible = false;
        });
    }

    // 恢复场景中点和线的可见性。
    restoreVisibility() {
        const scene = this.scene;
        const cache = this._visibilityCache;

        scene.traverse(function (object) {
            const visible = cache.get(object);
            object.visible = visible;
        });

        cache.clear();
    }
}

SSAOPass.OUTPUT = {
    Default: 0,
    SSAO: 1,
    Blur: 2,
    Beauty: 3,
    Depth: 4,
    Normal: 5,
};

export { SSAOPass };
