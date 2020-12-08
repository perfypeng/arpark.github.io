/**
 * The Hough transform is a feature extraction technique used in image analysis,
 * computer vision, and digital image processing. The purpose of the technique
 * is to find imperfect instances of objects within a certain class of shapes by
 * a voting procedure. This voting procedure is carried out in a parameter
 * space, from which object candidates are obtained as local maxima in a 
 * so-called accumulator space that is explicitly constructed by the algorithm
 * for computing the Hough transform.
 */
 
"use strict";

(function(filters) {

const shaderSourceCircle = `
  precision mediump float;

  // our texture
  uniform sampler2D u_image;
  uniform vec2 u_textureSize;
  uniform float u_r;
  #define M_PI 3.1415926535897932384626433832795
  #define PHI_STEP M_PI/180.0

  void main() {
    vec2 onePixel = vec2(1.0, 1.0) / u_textureSize;
    vec2 textCoord = gl_FragCoord.xy / u_textureSize;
    vec4 sum = vec4(0.0);
    float phi = 0.0;
    for (int i = 0; i < 360; i++)
    {
      phi += PHI_STEP;
      sum += texture2D(u_image, textCoord + onePixel*vec2(u_r*cos(phi), u_r*sin(phi)));
    }
    
    gl_FragColor = vec4(vec3(sum / 360.0), 1.0);
  }`;


filters.houghCircle = function(r) {
	var gl = this.gl;
	var program = this.createProgram("houghCircle", shaderSourceCircle);
	
	gl.useProgram(program);
	gl.uniform1f(gl.getUniformLocation(program, "u_r"), r);
	
	this.execute(program);
}

})(window.GPU);