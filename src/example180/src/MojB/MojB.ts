import * as THREE from 'three';

import { ShadertoyTexture } from "three-shadertoy-texture";
import bufferA from './bufferA.frag';
import { ExampleShader } from '..';

// This is a more complex ShaderToy that involves buffers and common shared code:
// Credit here: https://www.shadertoy.com/view/mdtSR7

export const MojB = new ShadertoyTexture(1024, 1024);

MojB.bufferA.shader = bufferA;
const loader = new THREE.TextureLoader();

MojB.bufferA.iChannel[0] = loader.load("/MojB/iChannel0.jpg");
MojB.bufferB.iChannel[0] = MojB.bufferA;




export const MojBExample : ExampleShader = {
    texture: MojB,
    title: "b",
    link: "https://www.shadertoy.com/view/mdtSR7",
    author: "SnoopethDuckDuck",
    button: "bbbb"
}
