import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SSRPass } from 'three/examples/jsm/postprocessing/SSRPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { TAARenderPass } from 'three/examples/jsm/postprocessing/TAARenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

import GBuffers from './utils/GBuffers';
import { DeferredRenderPass } from './passes/DeferredRenderPass';

let stats;
let renderer, scene, camera, controls, composer;
let frameIndex = 0;

let renderSettings;
let gbuffers;

let gui;

let params = {
    gbuffer: 'Default',
    gbuffers: ['Default', 'GBufferA', 'GBufferB', 'GBufferC', 'GBufferD'],
    ssaoEnable: true,
    ssaoRadius: 4,
    outputType: 'final',
    outputTypes: ['final', 'ssrOnly', 'ssgiOnly'],
    ssrEnable: true,
    ssrRays: 2,
    ssrResolution: 'Half',
    ssrResolutions: ['Half', 'Full'],
    ssrResolutionMultiplier: 0.5,
    ssrSmooth: 0.0,
    ssrDenoiseKernelStep: 2,
    ssgiEnable: true,
    ssgiRays: 4,
    ssgiResolution: 'Half',
    ssgiResolutions: ['Half', 'Full'],
    ssgiResolutionMultiplier: 0.5,
    ssgiSmooth: 0.0,
    ssgiDenoiseKernelStep: 4,
    taaEnable: true,
};

let renderType = 0;

const width = 1920;
const height = 1080;
// const width = window.innerWidth;
// const height = window.innerHeight;

function init() {
    // Stats: get FPS
    stats = new Stats();
    stats.setMode(0);
    stats.domElement.style.position = 'absolute';
    stats.domElement.style.left = '0px';
    stats.domElement.style.top = '0px';
    document.body.appendChild(stats.domElement);

    // GUI: get params
    gui = new GUI();
    const guiSSR = gui.addFolder('SSR');
    const guiSSGI = gui.addFolder('SSGI');
    const guiSSAO = gui.addFolder('SSAO');
    const guiTAA = gui.addFolder('TAA');
    const guiDebug = gui.addFolder('Debug');

    // init resolution

    const aspect = width / height;
    // const invAspect = height / width;

    // init scene
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 500);
    renderer = new THREE.WebGLRenderer();

    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // init scene objects
    const planeGeometry = new THREE.PlaneGeometry(40, 40);
    const planeMaterial = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.7, 0.7, 0.7),
        roughness: 0.01,
        metalness: 0.2,
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = -0.2;
    plane.receiveShadow = true;

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.9);
    dirLight.position.set(6, 12, 12);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 60;
    dirLight.shadow.camera.bottom = -60;
    dirLight.shadow.camera.left = -60;
    dirLight.shadow.camera.right = 60;
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 250;
    dirLight.shadow.bias = -0.0015;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.05);

    scene.add(dirLight);
    scene.add(ambientLight);

    camera.position.x = 0;
    camera.position.y = 30;
    camera.position.z = 40;

    // new GLTFLoader().load('models/小别墅/aa.gltf', function (gltf) {
    //     const model = gltf.scene;
    //     model.castShadow = true;
    //     model.receiveShadow = true;
    //     model.traverse(child => {
    //         if (child.isMesh) {
    //             child.castShadow = true;
    //             child.receiveShadow = true;
    //         }
    //     });
    //     scene.add(model);
    // });

    // new GLTFLoader().load('models/keyanlou_glb/keyanlou.glb', function (gltf) {
    //     const model = gltf.scene;
    //     model.position.set(0, 0, -20);
    //     model.castShadow = true;
    //     model.receiveShadow = true;
    //     model.traverse(child => {
    //         if (child.isMesh) {
    //             child.castShadow = true;
    //             child.receiveShadow = true;
    //         }
    //     });
    //     scene.add(model);
    // });
    new GLTFLoader().load('models/pica/scene.gltf', function (gltf) {
        const model = gltf.scene;
        model.position.set(0, 0, -20);
        model.castShadow = true;
        model.receiveShadow = true;
        model.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        scene.add(model);
    });

    new GLTFLoader().load('models/asia_building/scene.gltf', function (gltf) {
        const model = gltf.scene;
        model.scale.set(0.1, 0.1, 0.1);
        model.position.set(-25, 0, 20);
        model.castShadow = true;
        model.receiveShadow = true;
        model.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        scene.add(model);
    });
    plane.position.set(-25, 0, 20);
    scene.add(plane);

    new GLTFLoader().load('models/futuristic_building/scene.gltf', function (gltf) {
        const model = gltf.scene;
        model.position.set(25, 0, 20);
        model.castShadow = true;
        model.receiveShadow = true;
        model.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        scene.add(model);
    });

    // new FBXLoader().load('models/building/building.fbx', function (fbx) {
    //     const model = fbx;
    //     model.castShadow = true;
    //     model.receiveShadow = true;
    //     model.scale.set(0.01, 0.01, 0.01);
    //     scene.add(model);
    // });

    controls = new OrbitControls(camera, renderer.domElement);

    // RenderPass
    composer = new EffectComposer(renderer);
    const outputPass = new OutputPass(THREE.ACESFilmicToneMapping);
    const smaaPass = new SMAAPass(width, height);

    // only for debug
    gbuffers = new GBuffers(width, height, scene, camera);

    renderSettings = {
        outputType: 0,
        ssao: {
            enabled: true,
            kernelRadius: 8,
        },
        sssr: {
            enabled: true,
            resolution: [
                width * params.ssrResolutionMultiplier,
                height * params.ssrResolutionMultiplier,
            ],
            rays: params.ssrRays,
            roughnessMultiplier: params.ssrSmooth,
            denoiseKernelStep: params.ssrDenoiseKernelStep,
        },
        ssgi: {
            enabled: true,
            resolution: [
                width * params.ssgiResolutionMultiplier,
                height * params.ssgiResolutionMultiplier,
            ],
            rays: params.ssgiRays,
            denoiseKernelStep: params.ssgiDenoiseKernelStep,
        },
        taa: { enabled: true },
    };

    const deferredRenderPass = new DeferredRenderPass({
        scene: scene,
        camera: camera,
        renderer: renderer,
        controls: controls,
        width: width,
        height: height,
        settings: renderSettings,
    });

    composer.addPass(deferredRenderPass); // render the scene with screen space lighting(ssr/ssgi/ssao/taa)
    composer.addPass(outputPass); // tone mapping
    composer.addPass(smaaPass); // add final anti-aliasing

    // GUI

    guiSSAO.add(params, 'ssaoEnable').onChange(e => {
        deferredRenderPass.settings.ssao.enabled = e;
    });

    guiSSAO.add(params, 'ssaoRadius', 2, 10).onChange(e => {
        deferredRenderPass.settings.ssao.kernelRadius = e;
    });

    guiSSR.add(params, 'ssrEnable').onChange(e => {
        deferredRenderPass.settings.sssr.enabled = e;
    });
    guiSSR.add(params, 'ssrRays', 0, 8, 1).onChange(e => {
        deferredRenderPass.settings.sssr.rays = e;
    });
    guiSSR.add(params, 'ssrSmooth', 0, 1, 0.01).onChange(e => {
        deferredRenderPass.settings.sssr.roughnessMultiplier = e;
    });

    guiSSR
        .add(params, 'ssrResolution')
        .options(params.ssrResolutions)
        .onChange(e => {
            if (e == 'Half') {
                deferredRenderPass.settings.sssr.resolution = [width * 0.5, height * 0.5];
            } else {
                deferredRenderPass.settings.sssr.resolution = [width, height];
            }
        });

    guiSSR.add(params, 'ssrDenoiseKernelStep', 2, 5, 1).onChange(e => {
        deferredRenderPass.settings.sssr.denoiseKernelStep = e;
    });
    guiSSGI.add(params, 'ssgiEnable').onChange(e => {
        deferredRenderPass.settings.ssgi.enabled = e;
    });
    guiSSGI.add(params, 'ssgiRays', 0, 16, 1).onChange(e => {
        deferredRenderPass.settings.ssgi.rays = e;
    });

    guiSSGI
        .add(params, 'ssgiResolution')
        .options(params.ssgiResolutions)
        .onChange(e => {
            if (e == 'Half') {
                deferredRenderPass.settings.ssgi.resolution = [width * 0.5, height * 0.5];
            } else {
                deferredRenderPass.settings.ssgi.resolution = [width, height];
            }
        });

    guiSSGI.add(params, 'ssgiDenoiseKernelStep', 2, 5, 1).onChange(e => {
        deferredRenderPass.settings.ssgi.denoiseKernelStep = e;
    });

    guiTAA.add(params, 'taaEnable').onChange(e => {
        deferredRenderPass.settings.taa.enabled = e;
    });

    guiDebug
        .add(params, 'gbuffer')
        .options(params.gbuffers)
        .onChange(e => {
            if (e == 'GBufferA') {
                renderType = 1;
            } else if (e == 'GBufferB') {
                renderType = 2;
            } else if (e == 'GBufferC') {
                renderType = 3;
            } else if (e == 'GBufferD') {
                renderType = 4;
            } else {
                renderType = 0;
            }
        });
    guiDebug
        .add(params, 'outputType')
        .options(params.outputTypes)
        .onChange(e => {
            if (e == 'ssrOnly') {
                deferredRenderPass.settings.outputType = 1;
            } else if (e == 'ssgiOnly') {
                deferredRenderPass.settings.outputType = 2;
            } else {
                deferredRenderPass.settings.outputType = 0;
            }
        });
}

function animate() {
    requestAnimationFrame(animate);
    stats.update();
    controls.update();

    if (renderType == 0) {
        composer.render();
        // gbuffers.render(renderer);
        // deferredRenderPass.setGBuffers(gbuffers.GTextures);
    } else {
        gbuffers.renderToScreen(renderer, scene, camera, renderType - 1);
    }
    frameIndex++;
}

init();
animate();
