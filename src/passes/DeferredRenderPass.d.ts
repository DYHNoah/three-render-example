import * as THREE from 'three';

import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';
import StochasticSSR from './StochasticSSR';
import ScreenSpaceGI from './ScreenSpaceGI';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import FinalCombine from './FinalCombine';
import GBuffers from '../utils/GBuffers';
import { SSAOPass } from './SSAOPass';

export class DeferredRenderPass extends Pass {
    constructor(options: {
        scene: THREE.Scene;
        renderer: THREE.WebGLRenderer;
        camera: THREE.Camera;
        controls: any;
        width: number;
        height: number;
        settings: any;
    });

    renderPass: RenderPass;
    SSAO: SSAOPass;
    SSSR: StochasticSSR;
    SSGI: ScreenSpaceGI;
    Combine: FinalCombine;
    SceneColorRT: THREE.WebGLRenderTarget;
    SSAORT: THREE.WebGLRenderTarget;
    SSSRResultRT: THREE.WebGLRenderTarget;
    SSGIResultRT: THREE.WebGLRenderTarget;
    scene: THREE.Scene;
    camera: THREE.Camera;
    renderer: THREE.WebGLRenderer;
    controls: any;
    camPos: THREE.Vector3;
    resolution: THREE.Vector2;
    invResolution: THREE.Vector2;
    gbuffers: GBuffers;
    settings: any;
    frameIndexMod64: number;

    RefreshframeIndexMod64(): void;
    render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget, deltaTime: number): void;
    dispose(): void;
}