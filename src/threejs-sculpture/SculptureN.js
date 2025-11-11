import { BoxGeometry, MeshBasicMaterial, Color, Mesh, Vector3, Matrix4 } from 'three';

import {createPedestalEdges} from './create-pedestal-edges.js'

import {sculptToThreeJSMaterial, sculptToThreeJSMesh, glslToThreeJSMaterial, glslToThreeJSMesh} from 'shader-park-core';
import {defaultFragSourceGLSL} from 'shader-park-core';

export class Sculpture {
    constructor(isGlsl, source, msdfTexture) {
        this.uniformsToExclude = { 'sculptureCenter': 0, 'msdf': 0, 'opacity': 0, 'time': 0, 'stepSize': 0, '_scale' : 1, 'resolution': 0};
        this.IsGLSL = isGlsl;
        this.payload = { msdfTexture}
        this.source = source;
        this.compileError = null;
        this.isMorphing = false;
        this.morphProgress = 0;
        this.meshNew = null; // Third mesh for additional sculpture
        console.log('isGlsl', isGlsl)
        if (isGlsl) {
            try {
                this.mesh = glslToThreeJSMesh(source, this.payload);
            } catch(error) {
                console.error(error);
                this.mesh = glslToThreeJSMesh(defaultFragSourceGLSL, this.payload);
                this.compileError = error;
                // throw(e);
            }

        } else {
            try {
                this.mesh = sculptToThreeJSMesh(source, this.payload);
            } catch (error) {
                console.error(error);
                this.mesh = sculptToThreeJSMesh('sphere(0.5);', this.payload);
                this.compileError = error;

            }
            this.uniforms = this.mesh.material.uniformDescriptions;
            this.uniforms = this.uniforms.filter(uniform => !(uniform.name in this.uniformsToExclude))
        }
        const pedestalGeom = new BoxGeometry(2, 1, 2);
        this.opacity = 0.0;
        this.stepSize = 0.8;
        this.audioLevel = 0.0;
        this._audioLevel = 0.0;
        const pedestalMat = new MeshBasicMaterial({ color: new Color(0.95, 0.95, 0.95), transparent: true, opacity: this.opacity });
        this.pedestal = new Mesh(pedestalGeom, pedestalMat);
        this.sepBuffer = 0.05; // Small gap between sculpture and pedestal prevents z-fighting
        this.pedestal.position.set(0, -1.5-this.sepBuffer, 0);
        this.mesh.add(this.pedestal);
        this.pedestalEdges = createPedestalEdges(2, 1);
        this.pedestalEdges.position.set(0, -1.5-this.sepBuffer, 0);
        // this.mesh.add(this.pedestalEdges);
        this.selected = false;
        this.setIsGlSl(isGlsl);
        this.setOpacity(1.0);
        this.setAudiolevel(0.0);
    }

    setMSDFTexture(texture) {
        // this.MSDFTexture = texture;
        this.payload.msdfTexture = texture;
        // this.refreshMaterial();
    }

    selectedSculpture(selected) {
        if(!this.pedestal.visible) {
            return;
        }
        this.mesh.remove(this.pedestalEdges);
        if (selected) {
            this.pedestalEdges = createPedestalEdges(2, 1, 0.015);
            this.pedestalEdges.position.set(0, -1.5-this.sepBuffer, 0);
            this.mesh.add(this.pedestalEdges);
        } else {
            this.pedestalEdges = createPedestalEdges(2, 1);
			this.pedestalEdges.position.set(0, -1.5-this.sepBuffer, 0);
            this.mesh.add(this.pedestalEdges);
        }
        this.selected = selected;
    }

    setOpacity(value) {
        this.opacity = value;
        this.mesh.visible = value !== 0.0;
        this.pedestal.material.opacity = this.opacity;
    }
    setIsGlSl(value) {
        this.isGlSL = value;
    }
    setAudiolevel(value) {
        this.audiolevel = value;
    }

    refreshMaterial(newSource) {
        if (newSource) {
            this.source = newSource;
        }
        console.log('w refreshMaterial this.IsGLSL: ' + this.IsGLSL)
        if (this.IsGLSL) {
            try {
                this.mesh.material = glslToThreeJSMaterial(this.source, this.payload);
            } catch(e) {
                console.error(e);
                throw(e)
            }

        } else {
            try {
                this.mesh.material = sculptToThreeJSMaterial(this.source, this.payload);
            } catch(e) {
                throw(e);

            }
            this.uniforms = this.mesh.material.uniformDescriptions;
            this.uniforms = this.uniforms.filter(uniform => !(uniform.name in this.uniformsToExclude))
        }
    }

    update(uniforms) {
        this.mesh.material.uniforms['opacity'].value = this.opacity;
         this.mesh.material.uniforms['msdf'].value = this.payload.msdfTexture;
        uniforms.forEach(uniform => {
            if(this.mesh.material.uniforms[uniform.name] && uniform && uniform.name && uniform.value) {
                this.mesh.material.uniforms[uniform.name].value = uniform.value;
            } else {
                // console.log('ten uniform jest zly i dziwny:', uniform.name, uniform.value, this.mesh.material.uniforms);
            }
        });

        // Update meshOld with same uniforms so it animates (but not controllable through UI)
        if (this.meshOld && this.meshOld.material && this.meshOld.material.uniforms) {
            this.meshOld.material.uniforms['opacity'].value = this.opacity;
            this.meshOld.material.uniforms['msdf'].value = this.payload.msdfTexture;
            uniforms.forEach(uniform => {
                if(this.meshOld.material.uniforms[uniform.name] && uniform && uniform.name && uniform.value) {
                    this.meshOld.material.uniforms[uniform.name].value = uniform.value;
                }
            });
        }

        // Update meshNew with same uniforms if it exists
        if (this.meshNew && this.meshNew.material && this.meshNew.material.uniforms) {
            this.meshNew.material.uniforms['opacity'].value = this.opacity;
            this.meshNew.material.uniforms['msdf'].value = this.payload.msdfTexture;
            uniforms.forEach(uniform => {
                if(this.meshNew.material.uniforms[uniform.name] && uniform && uniform.name && uniform.value) {
                    this.meshNew.material.uniforms[uniform.name].value = uniform.value;
                }
            });
        }

        // Update morphing if active
        if (this.isMorphing && this.meshOld) {
            this.updateMorph();
        }
    }

    // Create meshOld copy for morphing with different shader source
    createMeshOld() {
        console.log('createMeshOld called, current mesh exists:', !!this.mesh);

        if (this.meshOld) {
            // Remove existing meshOld from scene if it exists
            if (window.scene && window.scene.children.includes(this.meshOld)) {
                window.scene.remove(this.meshOld);
                console.log('Removed old meshOld from scene');
            }
        }

        if (this.mesh) {
            try {
                this.meshOld = this.mesh.clone();
                this.meshOld.geometry = this.mesh.geometry.clone();
                this.meshOld.material = this.mesh.material.clone();

                // Add to scene if not already there
                if (window.scene && !window.scene.children.includes(this.meshOld)) {
                    window.scene.add(this.meshOld);
                    console.log('Added meshOld to scene');
                }

                console.log('meshOld created successfully as clone');
            } catch (error) {
                console.error('Failed to create meshOld as clone:', error);
            }
        } else {
            console.error('Cannot create meshOld: this.mesh is null');
        }
    }

    // Load a third sculpture from different source
    loadThirdSculpture() {
        console.log('Loading third sculpture as a copy from history...');

        if (this.meshNew) {
            // Remove existing meshNew from scene if it exists
            if (window.scene && window.scene.children.includes(this.meshNew)) {
                window.scene.remove(this.meshNew);
                console.log('Removed old meshNew from scene');
            }
        }

        if (this.meshOld) {
            try {
                this.meshNew = this.meshOld.clone();
                this.meshNew.geometry = this.meshOld.geometry.clone();
                this.meshNew.material = this.meshOld.material.clone();

                // Position the third mesh
                this.meshNew.position.x = 0; // Center position
                this.meshNew.position.z = 0;

                // Add to scene
                if (window.scene && !window.scene.children.includes(this.meshNew)) {
                    window.scene.add(this.meshNew);
                    console.log('Added meshNew to scene as a clone of meshOld');
                }

                console.log('Third sculpture loaded successfully from history');
                return true;
            } catch (error) {
                console.error('Failed to load third sculpture from history:', error);
                return false;
            }
        } else {
             console.warn('Cannot create third sculpture from history: meshOld is null.');
             return false;
        }
    }

    // Start morphing animation
    startMorph(duration = 2000) {
        if (!this.meshOld) {
            this.createMeshOld();
        }

        this.isMorphing = true;
        this.morphProgress = 0;
        this.morphStartTime = performance.now();
        this.morphDuration = duration;

        // Set up morph targets if geometries are compatible
        if (this.mesh.geometry.attributes.position.count === this.meshOld.geometry.attributes.position.count) {
            this.setupMorphTargets();
        } else {
            // Fallback to position interpolation
            this.setupPositionMorph();
        }
    }

    // Set up morph targets for compatible geometries
    setupMorphTargets() {
        const targetMesh = this.meshOld || this.meshNew;
        if (!targetMesh) return;

        if (!this.mesh.morphTargetInfluences) {
            this.mesh.morphTargetInfluences = [0];
            this.mesh.geometry.morphAttributes = {
                position: [targetMesh.geometry.attributes.position.clone()]
            };
        }
    }

    // Set up position interpolation for incompatible geometries
    setupPositionMorph() {
        const targetMesh = this.meshOld || this.meshNew;
        if (!targetMesh) return;

        this.originalPositions = this.mesh.geometry.attributes.position.array.slice();
        this.targetPositions = targetMesh.geometry.attributes.position.array.slice();
        this.interpolatedPositions = new Float32Array(this.originalPositions.length);
    }

    // Update morphing animation - MELT effect (chaotic, destructive merging)
    updateMorph() {
        const elapsed = performance.now() - this.morphStartTime;
        const progress = Math.min(elapsed / this.morphDuration, 1.0);

        // Chaotic melt easing - starts slow, accelerates dramatically, then slows down
        const t = progress;
        this.morphProgress = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        // Get target mesh for morphing (prefer meshOld, fallback to meshNew)
        const targetMesh = this.meshOld || this.meshNew;
        if (!targetMesh) return;

        // MELT EFFECT: Add chaotic distortion during transition
        const meltIntensity = Math.sin(this.morphProgress * Math.PI) * 0.3; // Sine wave distortion

        // Check if geometries are compatible for morphing
        const sourceGeom = this.mesh.geometry;
        const targetGeom = targetMesh.geometry;

        if (sourceGeom.attributes.position.count === targetGeom.attributes.position.count) {
            // Compatible geometries - use morph targets with melt distortion
            if (!this.mesh.morphTargetInfluences) {
                this.setupMorphTargets();
            }

            if (this.mesh.morphTargetInfluences) {
                // Add chaotic melt influence
                const baseMorph = this.morphProgress;
                const meltOffset = (Math.random() - 0.5) * meltIntensity * 0.5;
                this.mesh.morphTargetInfluences[0] = Math.max(0, Math.min(1, baseMorph + meltOffset));

                // Move meshes closer with chaotic movement
                const separation = Math.abs(this.mesh.position.x - targetMesh.position.x);
                const moveDistance = this.morphProgress * (separation * 0.8);
                const chaoticOffset = (Math.random() - 0.5) * meltIntensity * 2;
                const direction = targetMesh.position.x > this.mesh.position.x ? 1 : -1;

                this.mesh.position.x += (moveDistance + chaoticOffset) * direction;
                targetMesh.position.x -= (moveDistance - chaoticOffset) * direction;

                // Add vertical melt displacement
                const verticalMelt = Math.sin(this.morphProgress * Math.PI * 3) * meltIntensity * 0.5;
                this.mesh.position.y += verticalMelt;
                targetMesh.position.y -= verticalMelt;
            }
        } else {
            // Incompatible geometries - manual melt interpolation with chaos
            if (!this.interpolatedPositions) {
                this.setupPositionMorph();
            }

            if (this.interpolatedPositions && this.originalPositions && this.targetPositions) {
                // Melt vertex positions with chaos
                for (let i = 0; i < Math.min(this.originalPositions.length, this.targetPositions.length); i++) {
                    const baseLerp = this.originalPositions[i] +
                        (this.targetPositions[i] - this.originalPositions[i]) * this.morphProgress;

                    // Add melt distortion
                    const chaosX = (Math.random() - 0.5) * meltIntensity * 0.2;
                    const chaosY = (Math.random() - 0.5) * meltIntensity * 0.2;
                    const chaosZ = (Math.random() - 0.5) * meltIntensity * 0.2;

                    this.interpolatedPositions[i] = baseLerp + chaosX;
                    if (i + 1 < this.interpolatedPositions.length) {
                        this.interpolatedPositions[i + 1] = this.interpolatedPositions[i + 1] || 0 + chaosY;
                    }
                    if (i + 2 < this.interpolatedPositions.length) {
                        this.interpolatedPositions[i + 2] = this.interpolatedPositions[i + 2] || 0 + chaosZ;
                    }
                }

                this.mesh.geometry.attributes.position.array = this.interpolatedPositions;
                this.mesh.geometry.attributes.position.needsUpdate = true;

                // Chaotic mesh movement during melt
                const separation = Math.abs(this.mesh.position.x - targetMesh.position.x);
                const moveDistance = this.morphProgress * (separation * 0.8);
                const chaoticDrift = (Math.random() - 0.5) * meltIntensity * 3;
                const direction = targetMesh.position.x > this.mesh.position.x ? 1 : -1;

                this.mesh.position.x += (moveDistance + chaoticDrift) * direction;
                targetMesh.position.x -= (moveDistance - chaoticDrift) * direction;

                // Add melting vertical displacement
                const meltDrop = Math.sin(this.morphProgress * Math.PI * 2) * meltIntensity;
                this.mesh.position.y -= meltDrop * 0.3;
                targetMesh.position.y += meltDrop * 0.3;
            }
        }

        // Chaotic material melting effect
        if (this.mesh.material.uniforms && targetMesh.material.uniforms) {
            const melt = this.morphProgress;
            const chaosOpacity = Math.max(0.1, 1.0 - melt * 0.8 + (Math.random() - 0.5) * meltIntensity);
            this.mesh.material.opacity = chaosOpacity;
            targetMesh.material.opacity = Math.max(0.1, 0.5 - melt * 0.3 + (Math.random() - 0.5) * meltIntensity);
        }

        if (progress >= 1.0) {
            this.isMorphing = false;
            console.log('MELTING complete - sculptures have merged chaotically!');
        }
    }

    // Stop morphing and reset
    stopMorph() {
        this.isMorphing = false;
        this.morphProgress = 0;

        if (this.mesh.morphTargetInfluences) {
            this.mesh.morphTargetInfluences[0] = 0;
        }

        // Reset positions for all meshes
        this.mesh.position.x = 0.8;
        if (this.meshOld) this.meshOld.position.x = -0.8;
        if (this.meshNew) {
            this.meshNew.position.x = 0;
            this.meshNew.position.z = 0;
        }

        // Reset materials
        this.mesh.material.opacity = 1.0;
        if (this.meshOld) this.meshOld.material.opacity = 1.0;
        if (this.meshNew) this.meshNew.material.opacity = 1.0;
    }

    // Deform mesh geometry with smooth falloff
    deformMesh(worldPoint, direction, strength = 0.5, radius = 1.0, targetMesh = null) {
        console.log('🫰 Deforming sculpture mesh at:', worldPoint, 'direction:', direction);

        // Determine which mesh to deform (main mesh by default, or specified target)
        const meshToDeform = targetMesh || this.mesh;

        if (!meshToDeform || !meshToDeform.geometry) {
            console.log('❌ No mesh or geometry to deform');
            return false;
        }

        // IMPORTANT: Make sure we have our own geometry instance, not shared
        if (!meshToDeform.geometry.userData.isDeformable) {
            console.log('🔄 Cloning geometry for deformation');
            meshToDeform.geometry = meshToDeform.geometry.clone();
            meshToDeform.geometry.userData.isDeformable = true;
        }

        // Get mesh world matrix for transforming points
        const worldMatrix = meshToDeform.matrixWorld;
        const inverseWorldMatrix = new Matrix4().copy(worldMatrix).invert();

        // Transform world point to local mesh space
        const localPoint = worldPoint.clone().applyMatrix4(inverseWorldMatrix);
        console.log('📍 Local point:', localPoint);

        // Get geometry attributes
        const positions = meshToDeform.geometry.attributes.position;

        if (!positions) {
            console.log('❌ No position attribute');
            return false;
        }

        console.log('📊 Geometry info:', {
            positionCount: positions.count,
            arrayLength: positions.array.length,
            itemSize: positions.itemSize,
            meshName: meshToDeform.name
        });

        // Create a copy of original positions if not exists
        if (!meshToDeform.geometry.userData.originalPositions) {
            meshToDeform.geometry.userData.originalPositions = new Float32Array(positions.array.length);
            meshToDeform.geometry.userData.originalPositions.set(positions.array);
            console.log('💾 Created original positions backup');
        }

        const originalPositions = meshToDeform.geometry.userData.originalPositions;

        let deformedVertices = 0;
        const deformationVector = direction.clone().multiplyScalar(strength);

        console.log('🎯 Applying deformation vector:', deformationVector, 'radius:', radius);

        // Deform vertices within radius
        for (let i = 0; i < positions.count; i++) {
            const vertex = new Vector3(
                originalPositions[i * 3],
                originalPositions[i * 3 + 1],
                originalPositions[i * 3 + 2]
            );

            const distance = vertex.distanceTo(localPoint);

            if (distance < radius) {
                // Smooth falloff using smoothstep function
                const falloff = 1.0 - this.smoothstep(0, radius, distance);
                const finalDeformation = deformationVector.clone().multiplyScalar(falloff);

                vertex.add(finalDeformation);

                // Update position attribute directly in the array
                positions.array[i * 3] = vertex.x;
                positions.array[i * 3 + 1] = vertex.y;
                positions.array[i * 3 + 2] = vertex.z;

                deformedVertices++;
            }
        }

        console.log('🔧 Deformed', deformedVertices, 'vertices out of', positions.count);

        if (deformedVertices > 0) {
            // Mark geometry as needing update - try multiple approaches
            positions.needsUpdate = true;
            meshToDeform.geometry.attributes.position.needsUpdate = true;
            meshToDeform.geometry.verticesNeedUpdate = true;

            // Force geometry update
            meshToDeform.geometry.computeVertexNormals();
            meshToDeform.geometry.computeBoundingSphere();
            meshToDeform.geometry.computeBoundingBox();

            console.log('✅ Geometry updated successfully');
            return true;
        } else {
            console.log('⚠️ No vertices were deformed');
            return false;
        }
    }

    // Reset mesh geometry to original
    resetMeshGeometry(targetMesh = null) {
        const meshToReset = targetMesh || this.mesh;

        if (!meshToReset || !meshToReset.geometry || !meshToReset.geometry.userData.originalPositions) {
            console.log('❌ Cannot reset mesh - no original positions stored');
            return false;
        }

        const positions = meshToReset.geometry.attributes.position;
        const originalPositions = meshToReset.geometry.userData.originalPositions;

        // Restore original positions
        positions.array.set(originalPositions);
        positions.needsUpdate = true;

        // Recalculate normals and bounding sphere
        meshToReset.geometry.computeVertexNormals();
        meshToReset.geometry.computeBoundingSphere();

        console.log('🔄 Mesh geometry reset to original');
        return true;
    }

    // Smoothstep function for falloff calculation
    smoothstep(edge0, edge1, x) {
        const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
        return t * t * (3 - 2 * t);
    }
}
