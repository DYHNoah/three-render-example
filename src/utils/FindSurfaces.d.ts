import * as THREE from "three";

export class FindSurfaces{
    constructor();
    surfaceId: number;

    getSurfaceIdAttribute(Mesh:THREE.Mesh): Float32Array;
}

export function getSurfaceIdMaterial(): THREE.ShaderMaterial;
export function getVertexShader(): String;
export function getFragmentShader(): String;