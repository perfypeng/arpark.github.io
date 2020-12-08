/**
 * log-polar coordinates
 * In mathematics, log-polar coordinates (or logarithmic polar coordinates) is 
 * a coordinate system in two dimensions, where a point is identified by two 
 * numbers, one for the logarithm of the distance to a certain point, and one 
 * for an angle. Log-polar coordinates are closely connected to polar 
 * coordinates, which are usually used to describe domains in the plane with 
 * some sort of rotational symmetry. In areas like harmonic and complex 
 * analysis, the log-polar coordinates are more canonical than polar coordinates.
 */
"use strict";

(function(filters) {

const shaderSource = `
  precision mediump float;

  // our texture
  uniform sampler2D u_image;
  uniform vec2 u_textureSize;
  const float PI = atan(1.0, 0.0)*2.0;
  const float PI_2 = 2.0*PI;
  #define IN_RANGE(v_) (((v_) >= 0.0) && ((v_) <= 1.0))

  void main() {
    vec2 p = gl_FragCoord.xy / u_textureSize;
    float radius = (exp(p.x) - 1.0)/1.718281828459045;
    float angle = PI + PI_2*p.y;
    vec2 polar = vec2(radius*cos(angle), radius*sin(angle)) + vec2(0.5);
    if (IN_RANGE(polar.x) && IN_RANGE(polar.y))
      gl_FragColor = texture2D(u_image, polar);
    else
      gl_FragColor = vec4(vec3(0.0), 1.0);
  }`;

// Transformation from Cartesian to Log-Polar plane
filters.logpolar = function() {
	var gl = this.gl;
	var program = this.createProgram("logpolar", shaderSource);
	gl.useProgram(program);

	this.execute(program);
}

})(window.GPU);
