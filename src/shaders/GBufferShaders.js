const GBufferFragmentShader = /* glsl */`
precision highp float;
precision highp int;

in vec3 vNormal;
in vec3 vPosition;
in vec2 vUv;
in float vDepth;


uniform float uRoughness;
uniform float uMetalness;
uniform float uBaseF0;
uniform float uMeshId;
uniform vec3  uAlbedo;
uniform vec2  uAlbedoMapRepeat;
uniform vec2  uRoughnessMapRepeat;
uniform vec2  uMetalnessMapRepeat;

uniform sampler2D uRoughnessMap;
uniform sampler2D uMetalnessMap;
uniform sampler2D uAlbedoMap;

layout(location = 0) out vec4 out_normal;
layout(location = 1) out vec4 out_position;
layout(location = 2) out vec4 out_albedo;
layout(location = 3) out vec4 out_material;

void main() {
    float roughness = texture(uRoughnessMap, vUv * uRoughnessMapRepeat).x * uRoughness;
    float metalness = texture(uMetalnessMap, vUv * uMetalnessMapRepeat).y * uMetalness;
    vec3 albedo     = texture(uAlbedoMap, vUv* uAlbedoMapRepeat).xyz * uAlbedo;

    out_normal      = vec4(normalize(vNormal), 1.0);
    out_position    = vec4(vPosition, vDepth);
    out_albedo      = vec4(albedo, 1.0);
    out_material    = vec4(roughness, metalness, 0.0, 1.0);
}
`;

const GBufferDebugShaderA = `
precision highp float;
precision highp int;

in vec3 vNormal;
in vec3 vPosition;
in vec2 vUv;
in float vDepth;

 
uniform float uRoughness;
uniform float uMetalness;
uniform float uBaseF0;
uniform float uMeshId;
uniform vec3  uAlbedo;
uniform vec2  uAlbedoMapRepeat;
uniform vec2  uRoughnessMapRepeat;
uniform vec2  uMetalnessMapRepeat;

uniform sampler2D uRoughnessMap;
uniform sampler2D uMetalnessMap;
uniform sampler2D uAlbedoMap;

layout(location = 0) out vec4 out_normal;
layout(location = 1) out vec4 out_position;
layout(location = 2) out vec4 out_albedo;
layout(location = 3) out vec4 out_material;

void main() {
    float roughness = texture(uRoughnessMap, vUv * uRoughnessMapRepeat).x * uRoughness;
    float metalness = texture(uMetalnessMap, vUv * uMetalnessMapRepeat).y * uMetalness;
    vec3 albedo     = texture(uAlbedoMap, vUv * uAlbedoMapRepeat).xyz * uAlbedo;

    out_normal      = vec4(normalize(vNormal), 1.0);
    out_position    = vec4(vPosition, vDepth);
    out_albedo      = vec4(albedo, 1.0);
    out_material    = vec4(uRoughness, metalness, 0.0, 1.0);
}
`;
const GBufferDebugShaderB = `
precision highp float;
precision highp int;

in vec3 vNormal;
in vec3 vPosition;
in vec2 vUv;
in float vDepth;

uniform float uRoughness;
uniform float uMetalness;
uniform float uBaseF0;
uniform float uMeshId;
uniform vec3  uAlbedo;
uniform vec2  uAlbedoMapRepeat;
uniform vec2  uRoughnessMapRepeat;
uniform vec2  uMetalnessMapRepeat;

uniform sampler2D uRoughnessMap;
uniform sampler2D uMetalnessMap;
uniform sampler2D uAlbedoMap;

layout(location = 0) out vec4 out_normal;
layout(location = 1) out vec4 out_position;
layout(location = 2) out vec4 out_albedo;
layout(location = 3) out vec4 out_material;

void main() {
    float roughness = texture(uRoughnessMap, vUv * uRoughnessMapRepeat).x * uRoughness;
    float metalness = texture(uMetalnessMap, vUv * uMetalnessMapRepeat).y * uMetalness;
    vec3 albedo     = texture(uAlbedoMap, vUv * uAlbedoMapRepeat).xyz * uAlbedo;

    out_normal      = vec4(vPosition, vDepth);
    out_position    = vec4(vPosition, vDepth);
    out_albedo      = vec4(albedo, 1.0);
    out_material    = vec4(uRoughness, metalness, 0.0, 1.0);
}
`;
const GBufferDebugShaderC = `
precision highp float;
precision highp int;

in vec3 vNormal;
in vec3 vPosition;
in vec2 vUv;
in vec3 vColor;
in float vDepth;

uniform float uRoughness;
uniform float uMetalness;
uniform float uBaseF0;
uniform float uMeshId;
uniform vec3  uAlbedo;
uniform vec2  uAlbedoMapRepeat;
uniform vec2  uRoughnessMapRepeat;
uniform vec2  uMetalnessMapRepeat;

uniform sampler2D uRoughnessMap;
uniform sampler2D uMetalnessMap;
uniform sampler2D uAlbedoMap;

layout(location = 0) out vec4 out_normal;
layout(location = 1) out vec4 out_position;
layout(location = 2) out vec4 out_albedo;
layout(location = 3) out vec4 out_material;

void main() {
    float roughness = texture(uRoughnessMap, vUv * uRoughnessMapRepeat).x * uRoughness;
    float metalness = texture(uMetalnessMap, vUv * uMetalnessMapRepeat).y * uMetalness;
    vec3 albedo     = texture(uAlbedoMap, vUv * uAlbedoMapRepeat).xyz * uAlbedo;

    out_normal      = vec4(albedo, 1.0);
    out_position    = vec4(vPosition, vDepth);
    out_albedo      = vec4(vColor, 1.0);
    out_material    = vec4(uRoughness, metalness, 0.0, 1.0);
}
`;
const GBufferDebugShaderD = `
precision highp float;
precision highp int;

in vec3 vNormal;
in vec3 vPosition;
in vec2 vUv;
in float vDepth;

 
uniform float uRoughness;
uniform float uMetalness;
uniform float uBaseF0;
uniform float uMeshId;
uniform vec3  uAlbedo;
uniform vec2  uAlbedoMapRepeat;
uniform vec2  uRoughnessMapRepeat;
uniform vec2  uMetalnessMapRepeat;

uniform sampler2D uRoughnessMap;
uniform sampler2D uMetalnessMap;
uniform sampler2D uAlbedoMap;

layout(location = 0) out vec4 out_normal;
layout(location = 1) out vec4 out_position;
layout(location = 2) out vec4 out_albedo;
layout(location = 3) out vec4 out_material;

void main() {
    float roughness = texture(uRoughnessMap, vUv * uRoughnessMapRepeat).x * uRoughness;
    float metalness = texture(uMetalnessMap, vUv * uMetalnessMapRepeat).y * uMetalness;
    vec3 albedo     = texture(uAlbedoMap, vUv* uAlbedoMapRepeat).xyz * uAlbedo;

    out_normal      = vec4(roughness, metalness, 0.0, 1.0);
    out_position    = vec4(vPosition, vDepth);
    out_albedo      = vec4(albedo, 1.0);
    out_material    = vec4(roughness, metalness, 0.0, 1.0);
}
`;

export { GBufferFragmentShader, GBufferDebugShaderA, GBufferDebugShaderB, GBufferDebugShaderC, GBufferDebugShaderD };