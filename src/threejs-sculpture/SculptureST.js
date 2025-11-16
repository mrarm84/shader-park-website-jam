import { BoxGeometry, MeshBasicMaterial, Color, Mesh, } from 'three';

// import {createPedestalEdges} from './create-pedestal-edges.js'

import { ShadertoyTexture } from "three-shadertoy-texture";

export class SculptureST {
    constructor(isGlsl, source, msdfTexture) {
        this.uniformsToExclude = { 'sculptureCenter': 0, 'msdf': 0, 'opacity': 0, 'time': 0, 'stepSize': 0, '_scale' : 1, 'resolution': 0};
        this.IsGLSL = isGlsl;
        this.source = source;
        this.compileError = null;
        this.selected = false;
        this.opacity = 1.0;

        console.log('SculptureST constructor - isGlsl:', isGlsl, 'source length:', source.length);

        // Create ShadertoyTexture
        this.texture = new ShadertoyTexture(1024, 1024);

        // Set the shader source
        try {
            this.texture.image.shader = source;
            console.log('Shader set successfully');
        } catch (error) {
            console.error('Error setting shader:', error);
            this.compileError = error;
            // Set a default shader if the provided one fails
            this.texture.image.shader = `
                void mainImage(out vec4 fragColor, in vec2 fragCoord) {
                    vec2 uv = fragCoord/iResolution.xy;
                    fragColor = vec4(uv, 0.5, 1.0);
                }
            `;
        }

        // Create mesh geometry
        const geometry = new BoxGeometry(2, 2, 2);

        // Create material with the ShadertoyTexture
        const material = new MeshBasicMaterial({
            map: this.texture.texture,
            transparent: true
        });

        // Create mesh
        this.mesh = new Mesh(geometry, material);

        // Create pedestal
        const pedestalGeom = new BoxGeometry(2, 1, 2);
        const pedestalMat = new MeshBasicMaterial({
            color: new Color(0.95, 0.95, 0.95),
            transparent: true,
            opacity: this.opacity
        });
        this.pedestal = new Mesh(pedestalGeom, pedestalMat);
        this.sepBuffer = 0.05;
        this.pedestal.position.set(0, -1.5-this.sepBuffer, 0);
        this.mesh.add(this.pedestal);

        // Position the mesh
        this.mesh.position.set(0, 0, 7);

        this.setOpacity(1.0);
    }

    selectedSculpture(selected) {
        // For now, just update the selected state
        // Could add visual selection indicators later
        this.selected = selected;
    }

    setOpacity(value) {
        this.opacity = value;
        this.mesh.visible = value !== 0.0;
        this.pedestal.material.opacity = this.opacity;
    }

    setIsGlSl(value) {
        this.IsGLSL = value;
    }

    setAudiolevel(value) {
        // Shadertoy shaders typically don't use audio levels directly
        // Could be used for custom uniforms if needed
    }
    //
    // selectedSculpture(selected) {
    //     // if(!this.pedestal.visible) {
    //     //     return;
    //     // }
    //     this.mesh.remove(this.pedestalEdges);
    //     if (selected) {
    //         // this.pedestalEdges = createPedestalEdges(2, 1, 0.015);
    //         // this.pedestalEdges.position.set(0, -1.5-this.sepBuffer, 0);
    //         // this.mesh.add(this.pedestalEdges);
    //     } else {
    //         // this.pedestalEdges = createPedestalEdges(2, 1);
	// 		// this.pedestalEdges.position.set(0, -1.5-this.sepBuffer, 0);
    //         // this.mesh.add(this.pedestalEdges);
    //     }
    //     this.selected = selected;
    // }
    //
    // setOpacity(value) {
    //     this.opacity = value;
    //     this.mesh.visible = value !== 0.0;
    //     this.pedestal.material.opacity = this.opacity;
    // }
    // setIsGlSl(value) {
    //     this.isGlSL = value;
    // }
    // setAudiolevel(value) {
    //     this.audiolevel = value;
    // }
    //
    refreshMaterial(newSource) {
        if (newSource) {
            this.source = newSource;
        }
        console.log('refreshMaterial called with source length:', this.source.length);

        try {
            this.texture.image.shader = this.source;
            console.log('Shader updated successfully');
            this.compileError = null;
        } catch(e) {
            console.error('Error updating shader:', e);
            this.compileError = e;
            throw(e);
        }
    }
    //
    update(uniforms) {
        // Update opacity
        this.mesh.material.opacity = this.opacity;

        // Render the ShadertoyTexture
        if (window.renderer) {
            this.texture.render(window.renderer);
        }

        // Handle any additional uniforms if needed
        // ShadertoyTexture handles most uniforms internally (iTime, iResolution, etc.)
    }
}

