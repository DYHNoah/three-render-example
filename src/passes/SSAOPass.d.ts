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

export class SSAOPass {
    constructor(scene: THREE.Scene, camera: THREE.Camera, width?: number, height?: number);
    width: number;
    height: number;
    clear: boolean;
    camera: THREE.Camera;
    scene: THREE.Scene;
    kernelRadius: number;
    kernelSize: number;
    kernel: THREE.Vector3[];
    noiseTexture: THREE.DataTexture;
    output: number;
    minDistance: number;
    maxDistance: number;
    _visibilityCache: Map<THREE.Object3D, boolean>;
    beautyRenderTarget: THREE.WebGLRenderTarget;
    normalRenderTarget: THREE.WebGLRenderTarget;
    ssaoRenderTarget: THREE.WebGLRenderTarget;
    blurRenderTarget: THREE.WebGLRenderTarget;
    ssaoMaterial: THREE.ShaderMaterial;
    normalMaterial: THREE.MeshNormalMaterial;
    blurMaterial: THREE.ShaderMaterial;
    depthRenderMaterial: THREE.ShaderMaterial;
    copyMaterial: THREE.ShaderMaterial;
    fsQuad: THREE.FullScreenQuad;
    originalClearColor: THREE.Color;

    dispose(): void;
    render(renderer: THREE.WebGLRenderer, beautyRenderTarget: THREE.WebGLRenderTarget, writeBuffer: THREE.WebGLRenderTarget | null, clearColor?: THREE.Color, clearAlpha?: number): void;
    setSize(width: number, height: number): void;
    generateSampleKernel(): void;
    generateRandomKernelRotations(): void;
    overrideVisibility(): void;
    restoreVisibility(): void;
}