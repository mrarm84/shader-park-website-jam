import {
    BoxGeometry,
    MeshBasicMaterial,
    Color,
    Mesh
} from 'three';

import { MeshBasicNodeMaterial } from 'three/webgpu';
import { wgslFn, attribute, cameraProjectionMatrix, cameraViewMatrix, modelWorldMatrix } from 'three/tsl';

import { createPedestalEdges } from './create-pedestal-edges.js';
import {
    sculptToThreeJSMaterial,
    sculptToThreeJSMesh,
    glslToThreeJSMaterial,
    glslToThreeJSMesh,
    defaultFragSourceGLSL
} from 'shader-park-core';

export class Sculpture {
    constructor(isGlsl, source, msdfTexture) {
        this.uniformsToExclude = {
            sculptureCenter: 0,
            msdf: 0,
            opacity: 0,
            time: 0,
            stepSize: 0,
            _scale: 1,
            resolution: 0
        };

        this.IsGLSL = isGlsl;
        this.payload = { msdfTexture };
        this.source = source;
        this.compileError = null;
        console.log('isGlsl', isGlsl);

        // --- Create meshes for both renderers ---
        let meshGL, meshGPU;

        if (isGlsl) {
            try {
                meshGL = glslToThreeJSMesh(source, this.payload);
                console.error('meshGLmeshG222L', meshGL);
            } catch (error) {
                console.error(error);
                meshGL = glslToThreeJSMesh(defaultFragSourceGLSL, this.payload);
                this.compileError = error;
            }
        } else {
            try {
                meshGL = sculptToThreeJSMesh(source, this.payload);
                console.error('meshGLmeshGL za sculptToThreeJSMesh', meshGL);
            } catch (error) {
                console.error(error);
                meshGL = sculptToThreeJSMesh('sphere(0.5);', this.payload);
                this.compileError = error;
            }

            this.uniforms = meshGL.material.uniformDescriptions;
            this.uniforms = this.uniforms.filter(
                (u) => !(u.name in this.uniformsToExclude)
            );
        }

        // --- Clone for WebGPU and create NodeMaterial with WGSL ---
        meshGPU = meshGL.clone();

        // Always create MeshBasicNodeMaterial with WGSL for WebGPU
        const originalMaterial = meshGL.material;
        const nodeMaterial = new MeshBasicNodeMaterial();
        nodeMaterial.transparent = originalMaterial.transparent;
        nodeMaterial.side = originalMaterial.side;

        // Use positionNode with WGSL for automatic matrix handling
        const positionShaderParams = {
            position: attribute("position"),
        };

        const positionShader = wgslFn(`
            fn main_position(
                position: vec3<f32>,
            ) -> vec4<f32> {
                // Transform position with time-based animation for visual feedback
                var animatedPosition = position;

                // Add subtle animation based on position for visual variety
                let timeFactor = sin(f32(${originalMaterial.uniforms?.time?.value || 0}) * 2.0) * 0.05;
                animatedPosition.y += timeFactor;
                animatedPosition.x += cos(position.y * 2.0) * 0.02;

                return vec4f(animatedPosition, 1.0);
            }
        `);

        nodeMaterial.positionNode = positionShader(positionShaderParams);

        // Set animated color based on original material data
        const timeValue = originalMaterial.uniforms?.time?.value || 0;
        const colorR = 0.5 + Math.sin(timeValue * 2.0) * 0.3;
        const colorG = 0.5 + Math.cos(timeValue * 1.8) * 0.3;
        const colorB = 0.5 + Math.sin(timeValue * 2.2) * 0.3;

        nodeMaterial.color.setRGB(colorR, colorG, colorB);

        meshGPU.material = nodeMaterial;

        // --- Pedestal setup ---
        const pedestalGeom = new BoxGeometry(2, 1, 2);
        this.opacity = 0.0;
        this.stepSize = 0.8;
        this.audioLevel = 0.0;
        this._audioLevel = 0.0;

        const pedestalMat = new MeshBasicMaterial({
            color: new Color(0.95, 0.95, 0.95),
            transparent: true,
            opacity: this.opacity
        });

        const pedestal = new Mesh(pedestalGeom, pedestalMat);
        this.sepBuffer = 0.05;
        pedestal.position.set(0, -1.5 - this.sepBuffer, 0);
        meshGL.add(pedestal.clone());
        // meshGPU.add(pedestal.clone());

        this.pedestalEdges = createPedestalEdges(2, 1);
        this.pedestalEdges.position.set(0, -1.5 - this.sepBuffer, 0);

        this.selected = false;
        this.setIsGlSl(isGlsl);
        this.setOpacity(0.0);
        this.setAudiolevel(0.0);

        // --- Store both meshes ---
        this.meshes = { webgl: meshGL, webgpu: meshGPU };
        console.log('zzzzzz', this.meshes)

        this.mesh = meshGL; // default active mesh
    }

    // --- API methods ---

    setRendererMode(useWebGPU) {
        this.mesh = useWebGPU ? this.meshes.webgpu : this.meshes.webgl;
    }

    setMSDFTexture(texture) {
        this.payload.msdfTexture = texture;
    }

    selectedSculpture(selected) {
        if (!this.pedestalEdges) return;

        this.mesh.remove(this.pedestalEdges);
        this.pedestalEdges = createPedestalEdges(2, 1, selected ? 0.015 : 0.0);
        this.pedestalEdges.position.set(0, -1.5 - this.sepBuffer, 0);
        this.mesh.add(this.pedestalEdges);

        this.selected = selected;
    }

    setOpacity(value) {
        this.opacity = value;
        this.mesh.visible = value !== 0.0;
        this.mesh.traverse((child) => {
            if (child.material && child.material.opacity !== undefined) {
                child.material.opacity = this.opacity;
            }
        });
    }

    setIsGlSl(value) {
        this.isGlSL = value;
    }

    setAudiolevel(value) {
        this.audiolevel = value;
    }

    refreshMaterial(newSource) {
        if (newSource) this.source = newSource;
        console.log('refreshMaterial IsGLSL:', this.IsGLSL);

        try {
            // Update WebGL mesh material
            if (this.IsGLSL) {
                this.meshes.webgl.material = glslToThreeJSMaterial(this.source, this.payload);
            } else {
                this.meshes.webgl.material = sculptToThreeJSMaterial(this.source, this.payload);
                this.uniforms = this.meshes.webgl.material.uniformDescriptions;
                this.uniforms = this.uniforms.filter(
                    (u) => !(u.name in this.uniformsToExclude)
                );
            }

            // Update WebGPU mesh with new NodeMaterial
            const originalMaterial = this.meshes.webgl.material;
            const nodeMaterial = new MeshBasicNodeMaterial();
            nodeMaterial.transparent = originalMaterial.transparent;
            nodeMaterial.side = originalMaterial.side;

            // Create new WGSL shader with variation for refresh
            const seed = Math.random();
            const positionShaderParams = {
                position: attribute("position"),
            };

            const positionShader = wgslFn(`
                fn main_position(
                    position: vec3<f32>,
                ) -> vec4<f32> {
                    var animatedPosition = position;
                    let timeFactor = sin(f32(${originalMaterial.uniforms?.time?.value || 0} + ${seed}) * 2.5) * 0.06;
                    animatedPosition.y += timeFactor;
                    animatedPosition.x += cos(position.y * 2.0 + ${seed}) * 0.03;
                    return vec4f(animatedPosition, 1.0);
                }
            `);

            nodeMaterial.positionNode = positionShader(positionShaderParams);

            // Set varied color for refresh
            const timeValue = (originalMaterial.uniforms?.time?.value || 0) + seed;
            const colorR = 0.5 + Math.sin(timeValue * 2.0) * 0.3;
            const colorG = 0.5 + Math.cos(timeValue * 1.8 + seed) * 0.3;
            const colorB = 0.5 + Math.sin(timeValue * 2.2 + seed * 2) * 0.3;

            nodeMaterial.color.setRGB(colorR, colorG, colorB);
            this.meshes.webgpu.material = nodeMaterial;

        } catch (e) {
            console.error(e);
            throw e;
        }
    }

    update(uniforms) {
        const mat = this.mesh.material;
        if (!mat.uniforms) return;

        if (mat.uniforms.opacity) mat.uniforms.opacity.value = this.opacity;
        if (mat.uniforms.msdf) mat.uniforms.msdf.value = this.payload.msdfTexture;

        uniforms.forEach((uniform) => {
            if (
                mat.uniforms[uniform.name] &&
                uniform &&
                uniform.name &&
                uniform.value !== undefined
            ) {
                mat.uniforms[uniform.name].value = uniform.value;
            }
        });
    }
}
