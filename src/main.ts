import * as THREE from 'three';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CSM } from 'three/examples/jsm/csm/CSM.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutlinePass } from 'three/addons/postprocessing/OutlinePass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { CustomOutlinePass } from './passes/CustomOutlinePass.js';
import { FindSurfaces } from './utils/FindSurfaces.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { DeferredRenderPass } from './passes/DeferredRenderPass';
import { GBuffers } from './utils/GBuffers.js';

enum CMSMode {
    practical = 'practical',
    uniform = 'uniform',
    logarithmic = 'logarithmic',
    custom = 'custom',
}

let frameIndex: number = 0;
let renderType: number = 0;
let gbuffers: GBuffers;
let renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls,
    csm: CSM,
    stats: Stats,
    planes: THREE.Plane[] = [],
    planeHelper: THREE.PlaneHelper[],
    gradientMap: THREE.Texture,
    backgroundColor: THREE.Color;
let composer: EffectComposer,
    effectFXAA: ShaderPass,
    outlinePass: OutlinePass,
    bokehPass: BokehPass,
    bloomPass: UnrealBloomPass,
    customOutline: CustomOutlinePass;

let selectedObjects: THREE.Object3D[] = [];

let initMaterials: THREE.MeshStandardMaterial[] = [];
let toonMaterials: THREE.MeshToonMaterial[] = [];

let deferredRenderPass: DeferredRenderPass;

const textureLoader = new THREE.TextureLoader();
gradientMap = textureLoader.load('textures/gradientMaps/fiveTone.jpg');
gradientMap.minFilter = THREE.NearestFilter;
gradientMap.magFilter = THREE.NearestFilter;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const sceneContrtoller = {
    backgroundColor: '#000000',
};
const backgroundColorChanger = function () {
    backgroundColor.set(sceneContrtoller.backgroundColor);
    scene.background = backgroundColor;
};
function guiScene(gui: GUI) {
    const sceneConfig = gui.addFolder('Scene');
    sceneConfig.close();
    sceneConfig.addColor(sceneContrtoller, 'backgroundColor').onChange(backgroundColorChanger);
}

// 控制裁剪的总控制器
const clippingController = {
    planeX: {
        constant: 200,
        negated: false,
        displayHelper: false,
    },
    planeY: {
        constant: 200,
        negated: false,
        displayHelper: false,
    },
    planeZ: {
        constant: 200,
        negated: false,
        displayHelper: false,
    },
};
// 修改裁切面的回调函数
const clippingPlanePos = function () {
    planes[0].constant = clippingController.planeX.constant;
    planes[1].constant = clippingController.planeY.constant;
    planes[2].constant = clippingController.planeZ.constant;
};
// 是否显示裁切面位置的回调函数
const clippingPlaneHelperVisbility = function () {
    planeHelper[0].visible = clippingController.planeX.displayHelper;
    planeHelper[1].visible = clippingController.planeY.displayHelper;
    planeHelper[2].visible = clippingController.planeZ.displayHelper;
};
// 修改裁切方向的回调函数
const clippingPlaneNegate = function (index: number) {
    if (index != 0 && index != 1 && index != 2) {
        return;
    }
    planes[index].negate();
};
/**
 * 剖切的gui以及事件绑定
 *
 * @param {GUI} gui
 */
function guiClipping(gui: GUI) {
    const clipping = gui.addFolder('Clipping');
    clipping.close();

    const planeX = clipping.addFolder('planeX');
    planeX.add(clippingController.planeX, 'displayHelper').onChange(clippingPlaneHelperVisbility);
    planeX.add(clippingController.planeX, 'constant').min(-200).max(200).onChange(clippingPlanePos);
    planeX.add(clippingController.planeX, 'negated').onChange(function () {
        clippingPlaneNegate(0);
    });
    planeX.open();

    const planeY = clipping.addFolder('planeY');
    planeY.add(clippingController.planeY, 'displayHelper').onChange(clippingPlaneHelperVisbility);
    planeY.add(clippingController.planeY, 'constant').min(-200).max(200).onChange(clippingPlanePos);
    planeY.add(clippingController.planeY, 'negated').onChange(function () {
        clippingPlaneNegate(1);
    });
    planeY.open();

    const planeZ = clipping.addFolder('planeZ');
    planeZ.add(clippingController.planeZ, 'displayHelper').onChange(clippingPlaneHelperVisbility);
    planeZ.add(clippingController.planeZ, 'constant').min(-200).max(200).onChange(clippingPlanePos);
    planeZ.add(clippingController.planeZ, 'negated').onChange(function () {
        clippingPlaneNegate(2);
    });
    planeZ.open();
}

enum CustomMaterial {
    PBRMaterial = 'PBRMaterial',
    ToonMaterial = 'ToonMaterial',
}
// 修改材质的总控制器
const matController = {
    wireframe: false,
    material: CustomMaterial.PBRMaterial,
};
// 更换材质的回调函数
const matChanger = function (group: THREE.Group) {
    let i = 0;
    // 给每个mesh更新material
    group.traverse(function (children) {
        if (children instanceof THREE.Mesh) {
            if (matController.material == CustomMaterial.PBRMaterial) {
                children.material = initMaterials[i].clone();
                children.material.clippingPlanes = planes;
                csm.setupMaterial(children.material);
                i++;
            } else if (matController.material == CustomMaterial.ToonMaterial) {
                children.material = toonMaterials[i].clone();
                children.material.clippingPlanes = planes;
                csm.setupMaterial(children.material);
                i++;
            }
        }
    });
};
// 是否显示线框模式的回调函数
const matWireFrameChanger = function (group: THREE.Group) {
    // 遍历每个mesh，看是否开启线框
    group.traverse(function (children) {
        if (children instanceof THREE.Mesh) {
            children.material.wireframe = matController.wireframe;
        }
    });
};
/**
 * 改变materials的gui
 *
 * @param {GUI} gui
 * @param {THREE.Group} group
 */
function guiMaterials(gui: GUI, group: THREE.Group) {
    const materials = gui.addFolder('Material');
    materials.close();

    materials.add(matController, 'wireframe').onChange(function () {
        matWireFrameChanger(group);
    });

    materials
        .add(matController, 'material', [CustomMaterial.PBRMaterial, CustomMaterial.ToonMaterial])
        .onChange(function () {
            matChanger(group);
        });
}

// 阴影的总控制器
const shadowController = {
    shadow: false,
    shadowMap: false,
    lightX: -1,
    lightY: -1,
    lightZ: -1,
    shadowBias: 0.00015,
    shadowMapSize: 8192,
    lightIntensity: 3,
};
// 是否显示阴影的回调函数
const shadowChanger = function (group: THREE.Group) {
    // 遍历每个mesh，设置是否开启阴影
    group.traverse(function (children) {
        if (children instanceof THREE.Mesh) {
            if(children.material.transparent == false)
            {
                children.castShadow = shadowController.shadow;
                children.receiveShadow = shadowController.shadow;
            }
        }
    });
};
// 使用csm还是普通的shadowmap的回调函数
const shadowMapChanger = function (group: THREE.Group) {
    if (shadowController.shadowMap == true) {
        // 把之前的csm销毁
        csm.remove();
        csm.dispose();
        // shadowmap可以当成cascade只有1的csm
        csm = new CSM({
            maxFar: 200,
            cascades: 1,
            parent: scene,
            lightIntensity: 3,
            shadowMapSize: 8192,
            lightDirection: new THREE.Vector3(-1, -1, -1).normalize(),
            camera: camera,
            shadowBias: -0.00015,
        });
        // 遍历mesh，为csm设置每一个material
        group.traverse(function (children) {
            if (children instanceof THREE.Mesh) {
                csm.setupMaterial(children.material);
            }
        });
    } else {
        // 把之前的csm销毁
        csm.remove();
        csm.dispose();
        // 设置4cascade的csm
        csm = new CSM({
            maxFar: 300,
            cascades: 4,
            parent: scene,
            lightIntensity: 3,
            shadowMapSize: 2048,
            lightDirection: new THREE.Vector3(-1, -1, -1).normalize(),
            camera: camera,
            shadowBias: -0.00015,
        });
        // 遍历mesh，为csm设置每一个material
        group.traverse(function (children) {
            if (children instanceof THREE.Mesh) {
                csm.setupMaterial(children.material);
            }
        });
    }
};
// 更改光源方向的回调函数
const lightDirectionChanger = function () {
    csm.lightDirection.x = shadowController.lightX;
    csm.lightDirection.y = shadowController.lightY;
    csm.lightDirection.z = shadowController.lightZ;
};
// 更改阴影偏移
const shadowBiasChanger = function () {
    for (let i = 0; i < csm.lights.length; i++) {
        csm.lights[i].shadow.bias = shadowController.shadowBias * -1.0;
    }
    csm.updateFrustums();
};
// 更改shadowMap的分辨率
const shadowMapSizeChanger = function () {
    csm.shadowMapSize = shadowController.shadowMapSize;
    for (let i = 0; i < csm.lights.length; i++) {
        csm.lights[i].shadow.mapSize.width = shadowController.shadowMapSize;
        csm.lights[i].shadow.mapSize.height = shadowController.shadowMapSize;
        if (csm.lights[i].shadow.map != null) {
            csm.lights[i].shadow.map?.dispose();
            csm.lights[i].shadow.map = null;
        }
    }
};
// 更改光照强度
const lightIntensityChanger = function () {
    for (let i = 0; i < csm.lights.length; i++) {
        csm.lights[i].intensity = shadowController.lightIntensity;
    }
};
/**
 * 配置阴影相关
 *
 * @param {GUI} gui
 * @param {THREE.Group} group
 */
function guiShadow(gui: GUI, group: THREE.Group) {
    const configCSM = gui.addFolder('configShadow');
    configCSM.close();

    configCSM.add(shadowController, 'shadow').onChange(function () {
        shadowChanger(group);
    });

    configCSM.add(shadowController, 'shadowMap').onChange(function () {
        shadowMapChanger(group);
        if (shadowController.shadowMap == true) {
            shadowMapSizeController.show();
        } else {
            shadowMapSizeController.show(false);
        }
    });

    configCSM
        .add(shadowController, 'lightX', -1, 1)
        .name('light direction x')
        .onChange(lightDirectionChanger);

    configCSM
        .add(shadowController, 'lightY', -1, 1)
        .name('light direction y')
        .onChange(lightDirectionChanger);

    configCSM
        .add(shadowController, 'lightZ', -1, 1)
        .name('light direction z')
        .onChange(lightDirectionChanger);

    configCSM
        .add(shadowController, 'shadowBias', -0.005, 0.005)
        .name('shadow Bias')
        .onChange(shadowBiasChanger);

    let shadowMapSizeController = configCSM
        .add(shadowController, 'shadowMapSize', [1024, 2048, 4096, 8192])
        .name('shadowMapSize')
        .onChange(shadowMapSizeChanger);
    shadowMapSizeController.show(false);

    configCSM
        .add(shadowController, 'lightIntensity', 1, 5, 1)
        .name('light Intensity')
        .onChange(lightIntensityChanger);
}

// DOF的总控制器
const DOFController = {
    isDOF: false,
    focus: 10.0,
    aperture: 0.025,
    maxblur: 0.0,
};
// 修改DOF参数的回调函数
const DOFChanger = function () {
    bokehPass.uniforms['focus'].value = DOFController.focus;
    bokehPass.uniforms['aperture'].value = DOFController.aperture * 0.000001;
    bokehPass.uniforms['maxblur'].value = DOFController.maxblur;
};
// 是否开启DOF的回调函数
const isDOFChanger = function () {
    if (DOFController.isDOF == false) {
        composer.removePass(bokehPass);
    } else {
        composer.insertPass(bokehPass, 2);
    }
};
/**
 * 配置DOF
 *
 * @param {GUI} gui
 */
function guiDOF(gui: GUI) {
    const configDOF = gui.addFolder('configDOF');
    configDOF.close();

    configDOF.add(DOFController, 'isDOF').onChange(isDOFChanger);

    configDOF.add(DOFController, 'focus', 1.0, 5000.0, 1).onChange(DOFChanger);

    configDOF.add(DOFController, 'aperture', 0, 50, 0.1).onChange(DOFChanger);

    configDOF.add(DOFController, 'maxblur', 0.0, 0.01, 0.001).onChange(DOFChanger);
}

// bloom的总控制器
const bloomController = {
    isBloom: false,
    threshold: 0,
    strength: 0,
    radius: 0,
};
// 修改bloom参数的回调函数
const bloomChanger = function () {
    bloomPass.threshold = bloomController.threshold;
    bloomPass.strength = bloomController.strength;
    bloomPass.radius = bloomController.radius;
};
// 是否开启bloom的回调函数
const isBloomChanger = function () {
    if (bloomController.isBloom == false) {
        composer.removePass(bloomPass);
    } else {
        composer.insertPass(bloomPass, 3);
    }
};
/**
 * 配置Bloom
 *
 * @param {GUI} gui
 */
function guiBloom(gui: GUI) {
    const configBloom = gui.addFolder('configBloom');
    configBloom.close();

    configBloom.add(bloomController, 'isBloom').onChange(isBloomChanger);

    configBloom.add(bloomController, 'threshold', 0.0, 1.0).onChange(bloomChanger);

    configBloom.add(bloomController, 'strength', 0.0, 3.0).onChange(bloomChanger);

    configBloom.add(bloomController, 'radius', 0.0, 1.0, 0.01).onChange(bloomChanger);
}

// 描边的总控制器
const outlineController = {
    visibleEdgeColor: '#ffffff',
    globalOutline: false,
    globalOutlineColor: '#ffffff',
};
// 描边参数的回调函数
const outlineChanger = function () {
    outlinePass.visibleEdgeColor.set(outlineController.visibleEdgeColor);
    customOutline.fsQuad.material.uniforms.outlineColor.value.set(
        outlineController.globalOutlineColor
    );
};
// 使用选中描边还是全局描边
const isOutlineGlobalChanger = function () {
    if (outlineController.globalOutline == true) {
        composer.removePass(outlinePass);
        composer.insertPass(customOutline, 5);
    } else {
        composer.removePass(customOutline);
        composer.insertPass(outlinePass, 1);
    }
};
/**
 * 配置描边
 *
 * @param {GUI} gui
 */
function guiOutline(gui: GUI) {
    const configOutline = gui.addFolder('configOutline');
    configOutline.close();

    configOutline.addColor(outlineController, 'visibleEdgeColor').onChange(outlineChanger);

    configOutline.add(outlineController, 'globalOutline').onChange(isOutlineGlobalChanger);

    configOutline.addColor(outlineController, 'globalOutlineColor').onChange(outlineChanger);
}
// 鼠标移动的监听器
function onPointerMove(event: PointerEvent) {
    if (event.isPrimary === false) return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    checkIntersection();
}
// 存储鼠标选中的物体
function addSelectedObject(object: THREE.Object3D<THREE.Event>) {
    selectedObjects = [];
    selectedObjects.push(object);
}
// 将选中的物体赋给outlinePass
function checkIntersection() {
    // 从相机到鼠标位置做光线投射
    raycaster.setFromCamera(mouse, camera);

    // 获取相交的物体
    const intersects = raycaster.intersectObject(scene, true);

    if (intersects.length > 0) {
        const selectedObject = intersects[0].object;
        // 为选中描边添加第一个mesh
        addSelectedObject(selectedObject);
        outlinePass.selectedObjects = selectedObjects;
    } else {
        // 移开鼠标时清空选中物体
        selectedObjects = [];
        outlinePass.selectedObjects = selectedObjects;
    }
}

const SSRController = {
    ssrEnable: false,
    ssrRays: 1,
    ssrResolution: 'Quarter',
    ssrResolutions: ['Quarter', 'Half', 'Full'],
    ssrResolutionMultiplier: 0.5,
    ssrSmooth: 0.0,
    ssrMetallic: 0.0,
    ssrRayMarchingQuality: 'Low',
    ssrRayMarchingQualities: ['Low', 'Medium', 'High'],
    ssrDenoiseKernelStep: 2,
    ssrDenoiseQuality: 'Low',
    ssrDenoiseQualities: ['Low', 'High'],
};
function guiSSR(gui: GUI) {
    const guiSSR = gui.addFolder('SSR');
    guiSSR.close();
    guiSSR.add(SSRController, 'ssrEnable').onChange(function () {
        deferredRenderPass.settings.sssr.enabled = SSRController.ssrEnable;
    });
    // guiSSR.add(SSRController, 'ssrRays', 0, 8, 1).onChange(function () {
    //     deferredRenderPass.settings.sssr.rays = SSRController.ssrRays;
    // });
    guiSSR.add(SSRController, 'ssrSmooth', 0, 1, 0.01).onChange(function () {
        deferredRenderPass.settings.sssr.roughnessMultiplier = SSRController.ssrSmooth;
    });
    guiSSR.add(SSRController, 'ssrMetallic', 0, 1, 0.01).onChange(function () {
        deferredRenderPass.settings.sssr.metallicMultiplier = SSRController.ssrMetallic;
    });

    guiSSR
        .add(SSRController, 'ssrResolution')
        .options(SSRController.ssrResolutions)
        .onChange(function () {
            if (SSRController.ssrResolution == 'Quarter') {
                deferredRenderPass.settings.sssr.resolution = [
                    window.innerWidth * 0.25,
                    window.innerHeight * 0.25,
                ];
            } else if (SSRController.ssrResolution == 'Half') {
                deferredRenderPass.settings.sssr.resolution = [
                    window.innerWidth * 0.5,
                    window.innerHeight * 0.5,
                ];
            } else {
                deferredRenderPass.settings.sssr.resolution = [
                    window.innerWidth,
                    window.innerHeight,
                ];
            }
        });

    // guiSSR.add(SSRController, 'ssrDenoiseKernelStep', 2, 5, 1).onChange(function () {
    //     deferredRenderPass.settings.sssr.denoiseKernelStep = SSRController.ssrDenoiseKernelStep;
    // });

    guiSSR.add(SSRController, 'ssrDenoiseQuality')
        .options(SSRController.ssrDenoiseQualities)
        .onChange(function () {
            if (SSRController.ssrResolution == 'Low') {
                deferredRenderPass.settings.ssr.denoiseKernelStep = 2;
            }
            else {
                deferredRenderPass.settings.ssr.denoiseKernelStep = 4;
            }
        });
}

const SSAOController = {
    ssaoEnable: false,
    ssaoRadius: 4,
};
function guiSSAO(gui: GUI) {
    const guiSSAO = gui.addFolder('SSAO');
    guiSSAO.close();
    guiSSAO.add(SSAOController, 'ssaoEnable').onChange(function () {
        deferredRenderPass.settings.ssao.enabled = SSAOController.ssaoEnable;
    });

    guiSSAO.add(SSAOController, 'ssaoRadius').onChange(function () {
        deferredRenderPass.settings.ssao.kernelRadius = SSAOController.ssaoRadius;
    });
}

const SSGIController = {
    ssgiEnable: false,
    ssgiRays: 1,
    ssgiResolution: 'Quarter',
    ssgiResolutions: ['Minimum', 'Quarter', 'Half', 'Full'],
    ssgiResolutionMultiplier: 0.25,
    ssgiSmooth: 0.0,
    ssgiDenoiseKernelStep: 4,
    ssgiDenoiseQuality: 'Low',
    ssgiDenoiseQualities: ['Low', 'High'],
};
function guiSSGI(gui: GUI) {
    const guiSSGI = gui.addFolder('SSGI');
    guiSSGI.close();

    guiSSGI.add(SSGIController, 'ssgiEnable').onChange(function () {
        deferredRenderPass.settings.ssgi.enabled = SSGIController.ssgiEnable;
    });
    // guiSSGI.add(SSGIController, 'ssgiRays', 0, 16, 1).onChange(function () {
    //     deferredRenderPass.settings.ssgi.rays = SSGIController.ssgiRays;
    // });

    guiSSGI
        .add(SSGIController, 'ssgiResolution')
        .options(SSGIController.ssgiResolutions)
        .onChange(function () {
            if (SSGIController.ssgiResolution == 'Minimum') {
                deferredRenderPass.settings.ssgi.resolution = [
                    window.innerWidth * 0.125,
                    window.innerHeight * 0.125,
                ];
            } else if (SSGIController.ssgiResolution == 'Quarter') {
                deferredRenderPass.settings.ssgi.resolution = [
                    window.innerWidth * 0.25,
                    window.innerHeight * 0.25,
                ];
            } else if (SSGIController.ssgiResolution == 'Half') {
                deferredRenderPass.settings.ssgi.resolution = [
                    window.innerWidth * 0.5,
                    window.innerHeight * 0.5,
                ];
            } else {
                deferredRenderPass.settings.ssgi.resolution = [
                    window.innerWidth,
                    window.innerHeight,
                ];
            }
        });

    guiSSGI.add(SSGIController, 'ssgiDenoiseQuality')
        .options(SSGIController.ssgiDenoiseQualities)
        .onChange(function () {
            if (SSGIController.ssgiResolution == 'Low') {
                deferredRenderPass.settings.ssgi.denoiseKernelStep = 4;
            }
            else {
                deferredRenderPass.settings.ssgi.denoiseKernelStep = 6;
            }
        });
}
const TAAController = {
    taaEnable: true,
};
function guiTAA(gui: GUI) {
    const guiTAA = gui.addFolder('TAA');
    guiTAA.close();
    guiTAA.add(TAAController, 'taaEnable').onChange(function () {
        deferredRenderPass.settings.taa.enabled = TAAController.taaEnable;
    });
}

const DebugController = {
    gbuffer: 'Default',
    gbuffers: ['Default', 'GBufferA', 'GBufferB', 'GBufferC', 'GBufferD'],
    outputType: 'final',
    outputTypes: ['final', 'ssrOnly', 'ssgiOnly'],
};
function guiDebug(gui: GUI) {
    const guiDebug = gui.addFolder('Debug');
    guiDebug.close();

    guiDebug
        .add(DebugController, 'gbuffer')
        .options(DebugController.gbuffers)
        .onChange(function () {
            if (DebugController.gbuffer == 'GBufferA') {
                renderType = 1;
            } else if (DebugController.gbuffer == 'GBufferB') {
                renderType = 2;
            } else if (DebugController.gbuffer == 'GBufferC') {
                renderType = 3;
            } else if (DebugController.gbuffer == 'GBufferD') {
                renderType = 4;
            } else {
                renderType = 0;
            }
        });
    guiDebug
        .add(DebugController, 'outputType')
        .options(DebugController.outputTypes)
        .onChange(function () {
            if (DebugController.outputType == 'ssrOnly') {
                deferredRenderPass.settings.outputType = 1;
            } else if (DebugController.outputType == 'ssgiOnly') {
                deferredRenderPass.settings.outputType = 2;
            } else {
                deferredRenderPass.settings.outputType = 0;
            }
        });
}

const renderSettings = {
    outputType: 0,
    ssao: {
        enabled: false,
        kernelRadius: 8,
    },
    sssr: {
        enabled: false,
        resolution: [
            window.innerWidth * SSRController.ssrResolutionMultiplier,
            window.innerHeight * SSRController.ssrResolutionMultiplier,
        ],
        rays: SSRController.ssrRays,
        roughnessMultiplier: SSRController.ssrSmooth,
        metallicMultiplier: SSRController.ssrMetallic,
        denoiseKernelStep: SSRController.ssrDenoiseKernelStep,
    },
    ssgi: {
        enabled: false,
        resolution: [
            window.innerWidth * SSGIController.ssgiResolutionMultiplier,
            window.innerHeight * SSGIController.ssgiResolutionMultiplier,
        ],
        rays: SSGIController.ssgiRays,
        denoiseKernelStep: SSGIController.ssgiDenoiseKernelStep,
    },
    taa: { enabled: true },
};

// 初始化一个group，方便管理
const object = new THREE.Group();
// 初始化场景
const surfaceFinder = new FindSurfaces();
surfaceFinder.surfaceId = 0;
let gui = new GUI();
async function init() {
    // const gui = new GUI();

    // 监测性能插件
    stats = new Stats();
    document.body.appendChild(stats.dom);

    // 渲染器初始化及相关设置
    renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    // 此处开启阴影，renderer默认不开启阴影，因为消耗性能，因此需要显式开启阴影
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x263238);
    // 这里需要添加dom元素
    document.body.appendChild(renderer.domElement);
    // 此处开启clipping
    renderer.localClippingEnabled = true;

    // 初始化场景
    scene = new THREE.Scene();
    backgroundColor = new THREE.Color();
    backgroundColor.set('#000000');
    scene.background = backgroundColor;

    // 初始化相机
    camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.position.set(50, 50, 50);

    // 初始化controls控制视角，此处采用轨道控制器，左键旋转，右键移动
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target = new THREE.Vector3(0, 0, 0);
    controls.minDistance = 20;
    controls.maxDistance = 180;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    // 需调用update开启
    controls.update();

    // 配置环境光照
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.0);
    scene.add(ambientLight);

    // 初始化csm
    csm = new CSM({
        maxFar: 300,
        cascades: 4,
        mode: CMSMode.practical,
        lightIntensity: 3,
        parent: scene,
        shadowMapSize: 1024,
        lightDirection: new THREE.Vector3(-1, -1, -1).normalize(),
        camera: camera,
        shadowBias: -0.00015,
    });

    // 初始化裁切面以及裁切的辅助面(帮助查看裁切面)
    planes = [
        new THREE.Plane(new THREE.Vector3(-1, 0, 0), 200),
        new THREE.Plane(new THREE.Vector3(0, -1, 0), 200),
        new THREE.Plane(new THREE.Vector3(0, 0, -1), 200),
    ];
    // 将辅助面映射到裁切面
    planeHelper = planes.map(p => new THREE.PlaneHelper(p, 100, 0xffffff));
    planeHelper.forEach(ph => {
        ph.visible = false;
        scene.add(ph);
    });

    deferredRenderPass = new DeferredRenderPass({
        scene: scene,
        camera: camera,
        renderer: renderer,
        controls: controls,
        width: window.innerWidth,
        height: window.innerHeight,
        settings: renderSettings,
    });

    // TODO 提到外部
    // 初始化一个group，方便管理
    // let object = new THREE.Group();
    scene.add(object);

    gbuffers = new GBuffers(window.innerWidth, window.innerHeight, scene, camera);

    // 初始化后处理的处理器
    composer = new EffectComposer(renderer);

    // 给处理器添加正常渲染的pass
    // const renderPass = new RenderPass(scene, camera);
    // composer.addPass(renderPass);

    composer.addPass(deferredRenderPass);

    // 添加选中描边pass
    outlinePass = new OutlinePass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        scene,
        camera
    );
    composer.addPass(outlinePass);

    // 配置dof的pass
    bokehPass = new BokehPass(scene, camera, {
        focus: 10.0,
        aperture: 0.025,
        maxblur: 0.0,
    });
    // composer.addPass(bokehPass);

    // 配置bloom的pass
    bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0,
        0,
        0
    );
    // composer.addPass(bloomPass);

    // 进行色调映射，不进行这一步画面会很暗
    const outputPass = new OutputPass();
    composer.addPass(outputPass);

    // 配置全局描边
    customOutline = new CustomOutlinePass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        scene,
        camera
    );
    // composer.addPass(customOutline);

    // 添加FXAA抗锯齿，描边需要
    effectFXAA = new ShaderPass(FXAAShader);
    effectFXAA.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight);
    composer.addPass(effectFXAA);

    // TODO 提到外部
    // 全局描边用来找边界
    // const surfaceFinder = new FindSurfaces();

    // 加载gltf模型
    const loader = new GLTFLoader();
    const loaderData1 = await loader.loadAsync('models/gltf/house/aa.gltf');
    const loaderData = await loader.loadAsync('models/gltf/house/aa.gltf');
    // TODO 提到外部
    // surfaceFinder.surfaceId = 0;
    let toonMaterial: THREE.MeshToonMaterial;
    // 遍历gltf的mesh
    loaderData.scene.traverse(function (children) {
        if (children instanceof THREE.Mesh) {
            // 给予mesh一个id，用于全局描边
            const colorsTypedArray = surfaceFinder.getSurfaceIdAttribute(children);
            children.geometry.setAttribute('color', new THREE.BufferAttribute(colorsTypedArray, 4));

            // 对每个mesh的描边和阴影配置
            children.material.clippingPlanes = planes;
            children.material.clipShadows = true;
            children.material.shadowSide = THREE.DoubleSide;
            children.castShadow = false;
            children.receiveShadow = false;

            // 保存最开始的materials
            initMaterials.push(children.material.clone());
            // 为每一个mesh新建一个toonMaterial
            toonMaterial = new THREE.MeshToonMaterial({
                color: children.material.color,
                clippingPlanes: planes,
                clipShadows: true,
                shadowSide: THREE.DoubleSide,
                transparent: children.material.transparent,
                opacity: children.material.opacity,
                side: THREE.DoubleSide,
                gradientMap: gradientMap,
                map: children.material.map,
            });
            toonMaterials.push(toonMaterial);

            // csm需要存每一个材质
            csm.setupMaterial(children.material);
            csm.setupMaterial(toonMaterial);
        }
    });

    // 更新全局描边的属性
    customOutline.updateMaxSurfaceId(surfaceFinder.surfaceId + 1);

    // 添加到之前初始化的group
    object.add(loaderData.scene);

    // 监听鼠标
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    guiScene(gui);
    guiClipping(gui);
    guiMaterials(gui, loaderData.scene);
    guiShadow(gui, loaderData.scene);
    guiOutline(gui);
    guiDOF(gui);
    guiBloom(gui);
    guiSSR(gui);
    guiSSGI(gui);
    guiSSAO(gui);
    guiTAA(gui);
    guiDebug(gui);
}

// 每一帧渲染
function render() {
    stats.update();
    requestAnimationFrame(render);

    camera.updateMatrixWorld();
    csm.update();
    controls.update();

    if (renderType == 0) {
        composer.render();
    } else {
        gbuffers.renderToScreen(renderer, scene, camera, renderType - 1);
    }
    frameIndex++;
}

// 监听窗口变化
window.addEventListener(
    'resize',
    function () {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();

        csm.updateFrustums();

        renderer.setSize(window.innerWidth, window.innerHeight);
        composer.setSize(window.innerWidth, window.innerHeight);
        effectFXAA.setSize(window.innerWidth, this.window.innerHeight);
        customOutline.setSize(window.innerWidth, this.window.innerHeight);
        effectFXAA.uniforms['resolution'].value.set(
            1 / this.window.innerWidth,
            1 / this.window.innerHeight
        );
    },
    false
);

(async () => {
    await init();
    render();
})();

// 加载gltf模型
const loaderFBX = new GLTFLoader();
//  打开模型文件，加载模型
const fileOpener = document.getElementById('file-opener');
if (fileOpener) {
    fileOpener.addEventListener('change', async () => {
        //清除模型
        object.clear();
        csm.remove();
        csm.dispose();
        // 初始化csm
        csm = new CSM({
            maxFar: 300,
            cascades: 4,
            mode: CMSMode.practical,
            lightIntensity: 3,
            parent: scene,
            shadowMapSize: 1024,
            lightDirection: new THREE.Vector3(-1, -1, -1).normalize(),
            camera: camera,
            shadowBias: -0.00015,
        });
        //@ts-ignore
        const file = fileOpener.files[0];
        const loaderData = await loaderFBX.loadAsync(URL.createObjectURL(file));
        loaderData.scene.traverse(function (children) {
            if (children instanceof THREE.Mesh) {
                // 给予mesh一个id，用于全局描边
                console.log(children);
                const colorsTypedArray = surfaceFinder.getSurfaceIdAttribute(children);

                children.geometry.setAttribute(
                    'color',
                    new THREE.BufferAttribute(colorsTypedArray, 4)
                );

                // 对每个mesh的描边和阴影配置
                children.material.clippingPlanes = planes;
                children.material.clipShadows = true;
                children.material.shadowSide = THREE.DoubleSide;
                children.castShadow = false;
                children.receiveShadow = false;
                // 保存最开始的materials
                initMaterials.push(children.material.clone());
                // 为每一个mesh新建一个toonMaterial
                const toonMaterial = new THREE.MeshToonMaterial({
                    color: children.material.color,
                    clippingPlanes: planes,
                    clipShadows: true,
                    shadowSide: THREE.DoubleSide,
                    transparent: children.material.transparent,
                    opacity: children.material.opacity,
                    side: THREE.DoubleSide,
                    gradientMap: gradientMap,
                    map: children.material.map,
                });
                toonMaterials.push(toonMaterial);

                // csm需要存每一个材质
                csm.setupMaterial(children.material);
                csm.setupMaterial(toonMaterial);
            }
        });
        object.add(loaderData.scene);
        gui.destroy();
        gui = new GUI();
        guiScene(gui);
        guiClipping(gui);
        guiMaterials(gui, loaderData.scene);
        guiShadow(gui, loaderData.scene);
        guiOutline(gui);
        guiDOF(gui);
        guiBloom(gui);
        guiSSR(gui);
        guiSSGI(gui);
        guiSSAO(gui);
        guiTAA(gui);
        guiDebug(gui);
        // console.log(dataFBX)
        // loaderFBX
    });
}
