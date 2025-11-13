import { ExampleShader } from "..";
import { ShadertoyTexture } from "three-shadertoy-texture";
import image from './image.frag';

// This is a relatively simple ShaderToy that only requires an "image" shader.
// No channels or buffers or common code.
// source: https://www.shadertoy.com/view/cdV3DW

const MojTexture = new ShadertoyTexture(1024, 1024);
MojTexture.image.shader = image;

export const MojExample : ExampleShader = {
    texture: MojTexture,
    title: "a",
    link: "https://www.shadertoy.com/view/cdV3DW",
    author: "mrange",
    button: "a"
}
