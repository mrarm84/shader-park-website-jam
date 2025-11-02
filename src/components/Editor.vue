<template>

<div :class="{embeded : isEmbeded}" :style="{width: currWidth}" class="editor">
    <div class="editor-container" :style="{minWidth: cachedWidth}">
        <v-dialog/>
        <div class="controls">
            <input @keyup="()=>{}"
                @keydown.stop="() => {}"
                @click.stop="()=>{}"
                v-bind:style="titleInput"
                classs="editor-input centerY"  v-model="sculptureTitle" placeholder="title">
            <span v-if="authorUsername !=='admin' && authorUsername" class="username centerY">by
                <router-link  :to="userProfileRoute" tag="a">{{authorUsername}}</router-link>
            </span>

            <!-- SP File Loader Icons -->
            <div class="sp-file-loaders">
                <button @click.stop="loadSPFile('sphere')" class="sp-loader-btn centerY" title="Load Sphere Example">
                    <span class="sp-icon">○</span>
                </button>
                <button @click.stop="loadSPFile('cube')" class="sp-loader-btn centerY" title="Load Cube Example">
                    <span class="sp-icon">□</span>
                </button>
                <button @click.stop="loadSPFile('torus')" class="sp-loader-btn centerY" title="Load Torus Example">
                    <span class="sp-icon">⭕</span>
                </button>
                <button @click.stop="loadSPFile('terrain')" class="sp-loader-btn centerY" title="Load Terrain Example">
                    <span class="sp-icon">▲</span>
                </button>
                <button @click.stop="loadSPFile('audio-reactive')" class="sp-loader-btn centerY" title="Load Audio Reactive Example">
                    <span class="sp-icon">🎵</span>
                </button>
            </div>
          <select class="select-sculpture" v-model="selectedSculptureId" @change="loadSculptureFromDB">
            <option value="">-- Select a sculpture --</option>
            <option v-for="sculpture in sculptures" :key="sculpture.id" :value="sculpture.id">
              {{ sculpture.title && sculpture.title.length > 55
                ? sculpture.title.slice(0, 55) + '...'
                : sculpture.title || 'Untitled Sculpture' }}
            </option>
          </select>
          <button @click.stop="loadRandomSculpture" class="random-sculpture editor-button centerY" style="margin-left:8px;">🎲</button>


            <button @click.stop="close" class="close centerY editor-button"></button>
            <button @click.stop="save" class="save centerY editor-button">{{saveText}}</button>


            <label class="autoUpdate-label centerY" for="AutoUpdate">Auto Update</label>
            <input  class="checkbox centerY" :style="{marginLeft: '10px'}" type="checkbox" value="AutoUpdate" v-model="autoUpdate">
            <button @click.stop="play" v-if="!autoUpdate" class="play centerY editor-button"></button>

            <label class="autoUpdate-label centerY" v-if="isAdmin" for="Example">Is Example</label>
            <input class="checkbox centerY" v-if="isAdmin" type="checkbox"  value="Example" v-model="isExample">
            <label class="autoUpdate-label centerY" v-if="isAdmin" for="Featured">Featured</label>
            <input class="checkbox centerY" v-if="isAdmin" type="checkbox"  value="Featured" v-model="isFeatured">



            <button v-if="displayDelete" @click.stop="deleteSculpture" class="delete centerY editor-button">Delete</button>
            <!-- <input type="text" id="editor-shader-title" size="60"></input> -->
            <!-- <span>by</span> -->
            <!-- <input type="text" id="editor-author-name" size="30"></input> -->
        </div>

        <!-- <div @keyup="()=>{}" @keydown.stop="()=>{removeEditorModalUI()}" @click.stop="()=>{}" ref="codeMirror" class="code-editor"> </div> -->
        <!-- <codemirror ref="myCm"
            :value="code"
            :options="cmOptions"
            @ready="onCmReady"
            @focus="onCmFocus"
            @input="onCmCodeChange">
        </codemirror> -->
        <codemirror ref="myCm"
            :value="code"
            :options="cmOptions"
            @ready="onCmReady"
            @input="onCmCodeChange" @keydown.stop="()=>{}" @click.stop="()=>{}">
        </codemirror>
        <div class="bottom-controls-container">
            <div class="console-controls">
                <!-- <button  @click.stop="errorMessages = []" class="editor-button centerY clear-console">Clear Console</button> -->
                <button  @click.stop="showHideConsole" class="editor-button centerY show-hide-console" ref=showHideConsole>^</button>
            </div>
            <div class="console-container" ref="consoleContainer">

                <div class="error-messages" v-html="consoleErrorMessages"></div>
                <!-- <button  @click.stop="download" class="centerY editor-button">Download Source</button> -->

            </div>
        </div>
    </div>
</div>

</template>

<script>

import { codemirror } from 'vue-codemirror'
import {sculptToThreeJSShaderSource, sculptToTouchDesignerShaderSource} from 'shader-park-core';

import 'codemirror/mode/javascript/javascript.js';
import 'codemirror/keymap/sublime.js';


export default {
    props: {
        cachedWidth: { type: String, default: '49vw' }
    },
    data () {
        return {
            sculptures: [],
            selectedSculptureId: '',
            cm: null,
            code: '',
            cmOptions: {
                tabSize: 4,
                mode: 'text/javascript',
                theme: 'default',
                lineNumbers: true,
                matchBrackets: true,
                keyMap: 'sublime',
                autoCloseBrackets: true,
                line: true,
                viewportMargin: Infinity,
            },
            initialized: false,
            isExample: false,
            isFeatured: false,
            autoUpdate: true,
            closed: false,
            editorContainsErrors: false,
            saved: true,
            titleInput: {
                width: '5ch',
                border: 'none',
                marginBottom: '5px',
                fontSize: '19px',
                marginLeft: '5px;',
                position: 'relative',
                top: '50%',
                transform: 'translateY(-50%)'
            },
            currWidth: '0px',
            editorHasDisplayedModal: false,
            dialog: false,
            errorMessages: []
        }
    },
    components: {
        codemirror
    },
    mounted() {
        // document.addEventListener('keydown', this.keypress.bind(null, true));

      this.$store.dispatch('fetchAllSculptures').then(sculptures => {
        if (sculptures) {
          sculptures.reverse();
          this.sculptures = sculptures;
        }
      });

      // Try restoring last edited code on mount
      try {
        const initialId = this.$store.state.selectedSculpture ? this.$store.state.selectedSculpture.id : null;
        const restored = this.getStoredCode(initialId);
        if (restored) {
          this.code = restored;
          if (this.$store.state.selectedSculpture) {
            this.$store.state.selectedSculpture.shaderSource = restored;

          }
        }
      } catch(e) {}
    },


  computed : {
        sculptureError() {
            return this.$store.getters.getSculptureError;
        },
        codemirror() {
            return this.$refs.myCm.codemirror;
        },
        consoleErrorMessages() {
            return this.errorMessages.join('<br/>');
        },
        saveText() {
            if(this.selectedSculpture) {
                if(!this.selectedSculpture.uid || this.$store.getters.getUser && this.$store.getters.getUser.uid == this.selectedSculpture.uid) {
                    if(this.selectedSculpture.saved) {
                        return 'Saved';
                    } else {
                        return 'Save';
                    }
                } else {
                    return 'Save as Fork';
                }
            }
            return 'Save';
        },
        selectedSculpture() {
            return this.$store.state.selectedSculpture;
        },
        currUser () {
			return this.$store.getters.getUser;
        },
        isAdmin() { //TEMPORARY TODO: add actual admin check
            return this.$store.getters.isAdmin;
        },
        displayDelete() {
            return this.selectedSculpture && this.currUser && this.currUser.uid && this.selectedSculpture.uid === this.currUser.uid;
        },
        authorUsername() {
            return this.selectedSculpture? this.selectedSculpture.username: null;
        },
        authorId() {
            return this.selectedSculpture? this.selectedSculpture.uid: null;
        },
        userProfileRoute() {
            return this.selectedSculpture? `/user/${this.selectedSculpture.username}`: $router.currentRoute.path;
        },
        sculptureTitle: {
            get : function() {
                return this.selectedSculpture? this.selectedSculpture.title: '';
            },
            set : function(value) {
                if(this.$store.state.selectedSculpture) {
                    this.$store.state.selectedSculpture.title = value;
                    this.titleInput.width = value.length + 1 + 'ch';
                }
            }
        },
        isEmbeded() {
            return this.$store.state.embedded;
        },
        allSculptures() {
            return this.$store.state.currentSculptures;
        }
    },
    watch : {
        sculptureError(error) {
            if(error) {
                this.errorMessages = [];
                let message = error.toString();
                let lastErrorIndex = this.errorMessages.length - 1;
                if(!this.errorMessages.length) { // empty, so push new message
                    this.errorMessages.push(message);
                } else if(this.errorMessages[lastErrorIndex] !== message) {
                    this.errorMessages.push(message);
                }

                setTimeout(() => { //wait for DOM to refresh to calculate height
                    let errorConsole = document.querySelector('.console-container');
                    errorConsole.scrollTop = errorConsole.scrollHeight;
                }, 1);

            }
        },
        cachedWidth(value) {
            if(this.currWidth != '0px') {
                this.currWidth = this.cachedWidth;
            }
        },
        autoUpdate(value) {
            if(value) {
                this.onCmCodeChange(this.code);
            }
            // if(this.cm) {
            //     this.cm.autoUpdate = value;
            // }
        },
        isExample(value) {
            this.selectedSculpture.isExample = value;
        },
        isFeatured(value) {
            this.selectedSculpture.featured = value;
        },
        selectedSculpture(obj) {
            if(obj) {
                if(obj.title) {
                    this.titleInput.width = obj.title.length + 'ch';
                }
                this.currWidth = this.cachedWidth;
                this.isExample = obj.isExample;
                this.isFeatured = obj.featured;
                // Use stored code if available; otherwise sculpture source or fallback default
                const restored = this.getStoredCode(obj.id);
                const fallbackCode = obj.shaderSource || 'sphere(0.5);';
                const codeToUse = restored || fallbackCode;
                this.code = codeToUse;
                obj.shaderSource = codeToUse;
                this.initialized = true;
                this.closed = false;
                this.errorMessages = [];
                this.cycleResizeWindows();
            } else {
                this.currWidth = '0px';
                this.cycleResizeWindows();
            }
        }
    },
    methods: {
        storageKey(id) { return id ? `sp:code:${id}` : null; },
        getStoredCode(id) {
            try {
                const perId = id ? localStorage.getItem(this.storageKey(id)) : null;
                return perId || localStorage.getItem('sp:lastCode');
            } catch(e) { return null; }
        },
        persistCode(code, id) {
            try {
                if (typeof code !== 'string') return;
                localStorage.setItem('sp:lastCode', code);
                if (id) localStorage.setItem(this.storageKey(id), code);
            } catch(e) {}
        },
        loadSPFile(filename) {
            fetch(`/sp-examples/${filename}.sp`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.text();
                })
                .then(spCode => {
                    // Insert custom code before audioLevel input for Shader Park sketches
                    let processedSPCode = spCode;
                    console.log('spCode', spCode)
                    if (this.selectedSculpture && this.selectedSculpture.type !== 'glsl') { // Only for Shader Park code, not GLSL

                    }

                    // Update the code in the editor
                    this.code = processedSPCode;
                    // Update the sculpture source
                    if (this.selectedSculpture) {
                        this.selectedSculpture.shaderSource = processedSPCode;
                        this.selectedSculpture.saved = false;
                        this.$store.commit('setUnsavedChanges', {[this.selectedSculpture.id] : false});
                    }
                    // Persist
                    const currId = this.selectedSculpture ? this.selectedSculpture.id : null;
                    this.persistCode(processedSPCode, currId);
                    console.log(`Loaded SP file: ${filename}.sp`);
                })
                .catch(error => {
                    console.error('Error loading SP file:', error);
                    alert(`Failed to load ${filename}.sp: ${error.message}`);
                });
        },
      loadSculptureFromDB(event) {
        const sculptureId = event.target.value;
        if (!sculptureId) return;

        // Fetch sculpture from Firebase via Vuex
        this.$store.dispatch('fetchSculpture', { id: sculptureId }).then(sculpture => {
          if (!sculpture) {
            console.error('Sculpture not found:', sculptureId);
            alert('Sculpture not found.');
            return;
          }

          if (!sculpture.shaderSource) {
            console.error('Sculpture has no shader source:', sculptureId);
            alert('This sculpture has no shader code to load.');
            return;
          }

          // Insert custom code before audioLevel input for Shader Park sketches
          let processedShaderSource = sculpture.shaderSource;
          console.log('spCode2', sculpture.shaderSource)

          if (sculpture.type !== 'glsl') { // Only for Shader Park code, not GLSL

          }

          // Update the code in the editor
          this.code = processedShaderSource;

          // Update the sculpture source if one is selected
          if (this.selectedSculpture) {
            this.selectedSculpture.shaderSource = processedShaderSource;
            this.selectedSculpture.saved = false;
            this.$store.commit('setUnsavedChanges', { [this.selectedSculpture.id]: false });
          }

          // Persist
          const currId = this.selectedSculpture ? this.selectedSculpture.id : null;
          this.persistCode(processedShaderSource, currId);
          console.log(`Loaded sculpture: "${sculpture.title}" by ${sculpture.username}`);

          // Reset the select to the placeholder
          event.target.value = '';
        }).catch(error => {
          console.error('Error fetching sculpture:', error);
          alert(`Failed to load sculpture: ${error.message}`);
        });
      },

      loadRandomSculpture() {
        if (!this.sculptures || this.sculptures.length === 0) return;
        const prevCode = this.code;
        const prevShader = this.selectedSculpture ? this.selectedSculpture.shaderSource : null;
        const random = this.sculptures[Math.floor(Math.random() * this.sculptures.length)];

        // Flash strong bokeh blur before switching
        this.enableBokehFlash();

        this.$store.dispatch('fetchSculpture', { id: random.id }).then(sculpture => {
          if (!sculpture || !sculpture.shaderSource) throw new Error('No shader in sculpture');

          // Insert custom code before audioLevel input for Shader Park sketches
          let processedShaderSource = sculpture.shaderSource;

          const pattern = /^let\s+audioLevel/;
          const pattern2 = /^\/\/let\s+audioLevel/;
          if (!pattern.test(processedShaderSource) && !pattern2.test(processedShaderSource)) {
         //   processedShaderSource = '\/\/let audioLevel = input();' + processedCode;
          }

          this.code = processedShaderSource;
          if (this.selectedSculpture) {
            this.selectedSculpture.shaderSource = processedShaderSource;
            this.selectedSculpture.saved = false;
            this.$store.commit('setUnsavedChanges', { [this.selectedSculpture.id]: false });
          }
        }).catch(err => {
          console.error('Random load failed:', err);
          // Revert to previous
          this.code = prevCode;
          if (this.selectedSculpture && prevShader != null) {
            this.selectedSculpture.shaderSource = prevShader;
          }
        }).finally(() => {
          // Disable the bokeh flash after change
          this.disableBokehFlash();
        });
      },

      enableBokehFlash() {
        try {
          if (window.effectController) {
            window.effectController.enabled = true;
            window.effectController.maxblur = 15.0;
            window.effectController.fstop = 1.5;
            // reflect in GUI if present
            if (window.gui && window.gui.controllers) {
              window.gui.controllers.forEach(c => {
                if (c.property === 'enabled') c.setValue(window.effectController.enabled);
                if (c.property === 'maxblur') c.setValue(window.effectController.maxblur);
                if (c.property === 'fstop') c.setValue(window.effectController.fstop);
              });
            }
          }
        } catch (e) { /* ignore */ }
      },

      disableBokehFlash() {
        try {
          if (window.effectController) {
            window.effectController.enabled = false;
            if (window.gui && window.gui.controllers) {
              window.gui.controllers.forEach(c => {
                if (c.property === 'enabled') c.setValue(window.effectController.enabled);
              });
            }
          }
        } catch (e) { /* ignore */ }
      },

      showHideConsole() {
            let cm = this.$refs.myCm.$el;
            let consoleContainer = this.$refs.consoleContainer;
            let showHideConsole = this.$refs.showHideConsole;
            console.log('showHideConsole',cm, consoleContainer);
            if(cm && consoleContainer) {
                if(cm.classList.contains('max')) {
                    cm.classList.remove('max');
                    consoleContainer.classList.remove('max')
                    showHideConsole.classList.remove('max');

                } else {
                    cm.classList.add('max');
                    consoleContainer.classList.add('max');
                    showHideConsole.classList.add('max');
                }
            }
            console.log('showHideConsole',cm, consoleContainer);
        },
        cycleResizeWindows() {
            let interval = setInterval(() => {
                this.codemirror.refresh();
                window.onCanvasResize();
            }, .1);
            setTimeout(() => {
                this.codemirror.refresh()
                window.onCanvasResize()
                clearInterval(interval);
            }, 1000);
        },
        onCmReady(cm) {
            window.cm = cm;
        },
        onCmFocus(cm) {
        },
        onCmCodeChange(newCode) {

            if (this.selectedSculpture && newCode !== this.selectedSculpture.shaderSource) {
                this.selectedSculpture.saved = false;
                this.$store.commit('setUnsavedChanges', { [this.selectedSculpture.id]: false });
            }
          let processedCode = newCode;
          const pattern = /^let\s+audioLevel/;
          const pattern2 = /^\/\/let\s+audioLevel/;
          if (!pattern.test(newCode) && !pattern2.test(newCode)) {
            processedCode = '\/\/let audioLevel = input();\n' + processedCode;
          }

            this.code = processedCode;


            if(this.autoUpdate) {
                if(this.selectedSculpture){

                    this.selectedSculpture.shaderSource = processedCode;
                }
            }
            // Persist current code (global + per-sculpture)
            const currId = this.selectedSculpture ? this.selectedSculpture.id : null;
            this.persistCode(this.code, currId);
        },
        save() {
            return new Promise((resolve, reject) => {
                if(this.currUser != null) {
                    let id = this.selectedSculpture.id;
                    this.$store.dispatch('saveSculpture', this.selectedSculpture).then(() => {
                        this.selectedSculpture.saved = true;
                        this.$store.currSculpture = this.selectedSculpture;
                        this.$store.commit('setUnsavedChanges', {[id] : true});
                        resolve();
                    }).catch(e => {
                        console.error(e);
                        alert(e);
                        reject(e);
                    })
                } else {
                    // this.$router.push('sign-in');
                    this.$store.commit('displayLogin', true);
                    reject();
                }
            });
        },
        play() {
            if(this.selectedSculpture){
                // Insert custom code before audioLevel input for Shader Park sketches
                let processedCode = this.code;
                // if (this.selectedSculpture.type !== 'glsl') { // Only for Shader Park code, not GLSL
                //
                // }
              console.log('this.type2', this.type)
              const pattern = /^let\s+audioLevel/;
              const pattern2 = /^\/\/let\s+audioLevel/;
              if (!pattern.test(newCode) && !pattern2.test(newCode)) {
                processedCode = '\/\/let audioLevel = input();\n' + processedCode;
              }
                this.selectedSculpture.shaderSource = processedCode;
            }
        },
        download() {
            let output = sculptToThreeJSShaderSource(this.code);
            let out2 = sculptToTouchDesignerShaderSource(this.code);

            let spExport = output.geoGLSL + '\n' + output.colorGLSL;
            output['spExport'] = spExport;
            output['touchDesignerExport'] = out2.frag;
            console.log(output);
        },
        exportSculpture() {
            //Unused
        },
        close() {
            let close = () => {
                this.closed = true;
                this.$store.state.selectedSculpture = null;
                this.$store.state.selectedObject = null;
            };
            if(this.selectedSculpture.saved) {
                close();
            } else {
                this.dialog = true;


                this.$modal.show('dialog', {
                    title: 'Unsaved Changes',
                    text: 'Do you want to save before closing the editor?',
                    buttons: [{
                        title: 'Cancel',
                        handler: () => this.$modal.hide('dialog')
                    },
                    {
                        title: 'Close',       // Button title
                        handler: () => {
                            close();
                            this.$modal.hide('dialog')
                        }
                    },
                    {
                        title: 'Save & Close',       // Button title
                        default: true,    // Will be triggered by default if 'Enter' pressed.
                        handler: () => {
                            this.save().then(() => {
                                this.$modal.hide('dialog');
                                close();
                            });
                        }
                    }]
                })

            }
        },
        deleteSculpture() {
            this.$modal.show('dialog', {
                title: 'Delete Sculpture',
                text: 'Are you sure you want to delete this sculpture?',
                buttons: [{
                    title: 'Cancel',
                    handler: () => this.$modal.hide('dialog')
                },
                {
                    title: 'Delete',       // Button title
                    default: true,    // Will be triggered by default if 'Enter' pressed.
                    handler: () => {
                        this.$store.dispatch('deleteSculpture', this.selectedSculpture).then(() => {
                            this.$store.dispatch('removeSelectedSculptureFromScene');
                            this.$store.state.selectedSculpture = null;
                        })
                        this.$modal.hide('dialog');
                    }
                }]
            })
        },
        keypress(down, e) {
            if (e.key === 'Escape') {
            	this.close();
            }
            // if (e.key === 'Enter') {
            //     if(this.selectedSculpture) {
            //         this.play();
            //     }

            // }
        },
        removeEditorModalUI() {
            if(this.cm && this.cm.helpers.activeModal && this.cm.helpers.activeModal.isVisible){
                if(this.editorHasDisplayedModal) {
                    cm.helpers.activeModal.removeModal();
                    this.editorHasDisplayedModal = false;
                } else {
                    this.editorHasDisplayedModal = true;
                }
            } else {
                this.editorHasDisplayedModal = false;
            }
        }
    }
}

</script>
<style scoped>

/* @import 'codemirror/lib/codemirror.css'; */
</style>

<style lang="less" scoped>

// @import '/codemirror/glslEditor.css';
// @import "codemirror/lib/codemirror.css";
// @import '../client/codemirror/codemirror.css';
@import '../client/codemirror/glslEditor.css';
// @import '~codemirror/lib/codemirror.css';
// @import '~@codemirror/lib/codemirror.css';
// @import '~@material/react-button/index.scss';

.editor-button {
    padding: 5px 15px 5px 15px;
    border-radius: 50px;
    /* border: 1px solid lightgrey; */
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.15);
    margin-bottom: 5px;
    transition: color 300ms ease-in-out, box-shadow 300ms ease-in-out ;
        color: #777;
    -webkit-transition: color 300ms ease-in-out, box-shadow 300ms ease-in-out ;
    &:hover {
        color: #000;
        box-shadow: 0 1px 4px 0 rgba(0, 0, 0, 0.2);
    }

}

.centerY{
    position: relative;
    top:50%;
    transform: translateY(-50%);
}

.username {
    position: absolute !important;
    font-size: 17px;
}

.controls {
    border-bottom: 2px solid #f5f5f5;
}

.controls{
    min-height: 50px;
    position: relative;
    height: 12vh;

    padding-left: 20px;
    padding-right: 20px;
    overflow: hidden;
}

.bottom-controls-container {
    width: 100%;
    border-top: 2px solid #f5f5f5;
    position: absolute;
    bottom: 0px;

    .console-controls {
        height: 4vh;
        position: absolute;
        left: 0;
        right: 0;
        pointer-events: none;
        //border-bottom: 2px solid #f5f5f5;

        .show-hide-console {
            position: absolute;
            pointer-events: initial !important;
            padding-bottom: 1px;
            right: 10px;
            line-height: 20px;
            margin: 0px;
            margin-top: -7px;
            left: auto;
            transform: rotate(0deg);
            transition: transform 300ms ease-in-out, box-shadow 300ms ease-in-out;
            &.max {
                box-shadow: 0 -1px -3px 0 rgba(0, 0, 0, 0.15);
                transform: rotate(180deg);
            }
        }
    }

    .console-container {
        overflow: scroll;
        height: 12vh;
        padding-left: 10px;
        transition: height 300ms ease-in-out;

        &.max {
            height: 45vh;
        }
        // padding-bottom: 10px;
        // padding-top: 10px;
    }
}

.save {
    margin-left: 5px;
}

.sp-file-loaders {
    float: right;
    margin-left: 10px;
    margin-right: 10px;
    display: flex;
    gap: 5px;
    padding-top: 16px;
}

.sp-loader-btn {
    width: 32px;
    height: 32px;
    border-radius: 6px;
    border: 1px solid #ddd;
    background: #f9f9f9;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 200ms ease;
    font-size: 16px;
    padding: 0;

    &:hover {
        background: #e9e9e9;
        border-color: #ccc;
        transform: scale(1.05);
    }

    &:active {
        background: #ddd;
        transform: scale(0.95);
    }
}

.sp-icon {
    font-size: 18px;
    font-weight: bold;
    color: #666;
    line-height: 1;
}

.db-sculptures-selector {
    float: right;
    margin-left: 10px;
  min-width: 140px;
  max-width: 160px;

  margin-right: 10px;
}

.sculpture-select {
    height: 32px;
    padding: 4px 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #f9f9f9;
    color: #333;
    font-size: 12px;
    cursor: pointer;
    min-width: 140px;
    max-width: 160px;

    &:hover {
        border-color: #ccc;
        background: #f0f0f0;
    }

    &:focus {
        outline: none;
        border-color: #4CAF50;
        box-shadow: 0 0 0 2px rgba(76, 175, 80, 0.2);
    }
}

.control-button {
    opacity: 0.6;
    background-repeat: no-repeat;
    // box-shadow: none;
    transition: opacity 300ms ease-in-out;
    -webkit-transition: opacity 300ms ease-in-out;
    &:hover {
        // box-shadow: none;
        opacity: 1.0;
    }
}

.close {
    background-color: #777;
    color:white;
    transition: bacground-color 300ms ease-in-out, filter 300ms ease-in-out;
    -webkit-transition: background-color 300ms ease-in-out, filter 300ms ease-in-out;
    width: 28px;
    height: 28px;
    border-style: none;
    background-image: url('../client/images/close-white.svg');
    background-position: 50% 50%;
    background-size: 16px;
    background-repeat: no-repeat;
    background-attachment: scroll;
    filter: invert(0);
    &:hover {
        filter: invert(1);
        // fill: black;
        background-color: black;
    }
}

.play {
    .control-button();
    height: 30px;
    width: 30px;
    background-position: 65% 50%;
    background-size: 16px;
    background-image: url('../client/images/play.svg');
}

.delete, .close, .save, .autoUpdate-label, .checkbox, .play {
    float: right;
    top: -10px
}

.autoUpdate-label {
    font-weight: normal;
    margin-left: 5px !important;
    color: #777;
}
.dialog-c-text {
    padding: 0px 20px 10px 20px;
}
.dialog-c-title {
    text-align: center;
    font-size: 17px;
}

.vue-dialog-button {
    font-size: 14px !important;
}

label {
    display: inline;
}

.checkbox {
    margin-left: 5px;
    margin-right: 5px;
}

.CodeMirror-scroll {
    height: auto;
    overflow: scroll !important;
    // max-height: 81vh;
    // max-width: 100%;
    // &.max{
    //     max-height: 48vh;
    // }
    // &.embed {
    //     max-height: 92vh;
    // }
}

.CodeMirror {
    margin-top: 0px !important;
}

.ge_canvas {
    display: none;
}

.editor {
    &.embeded {
        top: 0px;
    }
    overflow: hidden;
    // position: absolute;
    // top: 85px;
    position: relative;
    // right: 0px;
}

.vue-codemirror {
    max-height: calc(70vh - 2px);
    &.max{
        max-height: calc(37vh - 2px);
    }
    transition: max-height 300ms ease-in-out;
    overflow: scroll;
}

.CodeMirror-hints{
    z-index: 100;
}

.select-sculpture{
  margin-top: 39px;
  float: none;
  display: flex;
}

</style>
