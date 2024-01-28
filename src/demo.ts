import * as OBC from 'openbim-components';

const container = document.getElementById('app');

const components = new OBC.Components();

components.scene = new OBC.SimpleScene(components);
components.renderer = new OBC.PostproductionRenderer(components, container);
components.camera = new OBC.SimpleCamera(components);
components.raycaster = new OBC.SimpleRaycaster(components);

components.init();

components.renderer.postproduction.enabled = true;

const scene = components.scene.get();


components.scene.setup();


let fragments = new OBC.FragmentManager(components);
let fragmentIfcLoader = new OBC.FragmentIfcLoader(components, fragments);

// 设置wasm路径
fragmentIfcLoader.settings.wasm = {
    path: "https://unpkg.com/web-ifc@0.0.43/",
    absolute: true
}

// 设置
fragmentIfcLoader.settings.webIfc.COORDINATE_TO_ORIGIN = true;
fragmentIfcLoader.settings.webIfc.OPTIMIZE_PROFILES = true;


// 加载ifc文件 需要等待一会
async function loadIfcAsFragments() {
    const file = await fetch('/models/小别墅.ifc');
    const data = await file.arrayBuffer();
    const buffer = new Uint8Array(data);
    const model = await fragmentIfcLoader.load(buffer);
    scene.add(model);
}
await loadIfcAsFragments()





