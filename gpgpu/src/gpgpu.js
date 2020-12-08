"use strict";
/**
\cond HIDDEN_SYMBOLS
*/
function GPU(){
  /**
   * get the webGL canvas context
   * 
   * @param {webGL canvas} canvas - webGL Canvas 
   */
	function getWebGLContext(canvas){
		try {
			return (canvas.getContext("webgl", {premultipliedAlpha: false}) || canvas.getContext("experimental-webgl", {premultipliedAlpha: false}));
		} catch(e) {
			console.log("ERROR: %o", e);
		}
		return null;
	}
	
	/**
   * create webGL 2D texture and set default parameters
   * 
   * @param {Object} gl - webGL Obejct 
   */
	function createTexture(gl){
		let texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);

		// Flip the image's Y axis to match the WebGL texture coordinate space.
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		
		// Set the parameters so we can render any size image.
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		
		return texture;
	}
  
  /**
   * GPU Object data member
   */
  let GPU = this;
  
  GPU.gl = null;	
	GPU.params = {};                          // GPU parameters.
	GPU.programs = {};                        // GPU programs list.
	GPU.sources = {};                         // GPU GLSL sources. 

  /** GPU function number */

  /**
   * create GPU program and add program into GPU program list. 
   * 
   * @param {String} name - program name.
   * @param {String} fragmentSource - fragment source.
   * @param {String} vertexSource - vertex source.
   */
	GPU.createProgram = function(name, fragmentSource, vertexSource){
		let gl = this.gl;
		let	shaderProgram = this.programs[name];
    let vertexShader;
    let fragmentShader;

    // check the program with program name, if the program has been compile,
    // return program directly
		if (shaderProgram){
      gl.useProgram(shaderProgram);
			return shaderProgram;
		}
    
    // create GLSL shader
		function createShader(type, source){
			let shader = gl.createShader(type); // gl.FRAGMENT_SHADER or gl.VERTEX_SHADER
			
			gl.shaderSource(shader, source);

			// Compile the shader program
			gl.compileShader(shader);  

			// See if it compiled successfully
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {  
				console.log("An error occurred compiling the shaders: " + gl.getShaderInfoLog(shader));  
				return null;  
			}
			
			return shader;
		}
		// create vertex shader
		if (!vertexSource){
			vertexShader = createShader(gl.VERTEX_SHADER,   `attribute vec2 a_position;
															void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`
															);
		} else {
			vertexShader = createShader(gl.VERTEX_SHADER, vertexSource);
    }
    // create fragment shader
		fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentSource);
		
		shaderProgram = gl.createProgram();
		gl.attachShader(shaderProgram, vertexShader);
		gl.attachShader(shaderProgram, fragmentShader);
		gl.linkProgram(shaderProgram);

		// If creating the shader program failed, alert
		if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
			console.log("Unable to initialize the shader program.");
		} else {
			this.programs[name] = shaderProgram;
		}
		
		gl.useProgram(shaderProgram);
		return shaderProgram;
	}
  
  /**
   * delete GLSL program.
   * 
   * @param {String} name - program name
   */
	GPU.deleteProgram = function(name){
		let gl = this.gl,
			shaderProgram = this.programs[name];
		
		if (shaderProgram){
			gl.deleteProgram(shaderProgram);
			this.programs[name] = null;
		}
	}
  
  /**
   * initialize GPU object: set canvas width and height, create default 
   * texture and frame buffer
   * 
   * @param {int} width - canvas width 
   * @param {int} height - canvas height
   */
	GPU.initialize = function(canvasSource, width, height){
    // init webGL
    if(this.gl === null) {
      if(canvasSource instanceof Object) {
        this.gl = getWebGLContext(canvasSource);  // GPU object webGL object
	    } else {
		    console.log("Canvas error");
	    }
    }

    let self = this;
		let gl = self.gl;
    let canvas = gl.canvas;
		// If we are using the same dimensions then just return
		if (this.originalImageTexture && canvas.width == width && canvas.height == height){
      return;
		}
		
		canvas.width = width;
    canvas.height = height;
		if (this.originalImageTexture){
			for (let i = 0; i < this.textures.length; i++){
				gl.bindTexture(gl.TEXTURE_2D, this.textures[i]);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 
							canvas.width, canvas.height, 0, 
							gl.RGBA, this.texType, null);
			}
			return;
		}
		
		this.originalImageTexture = createTexture(gl);
		this.texType = ((gl.getExtension('OES_texture_float')) ? gl.FLOAT : gl.UNSIGNED_BYTE);
		
		// create 2 textures and attach them to frame buffers.
		let textures = [];
		let framebuffers = [];
		for (let ii = 0; ii < 2; ++ii) {
			let texture = createTexture(gl);
			textures.push(texture);

			// make the texture the same size as the image
			gl.texImage2D(
				gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0,
				gl.RGBA, this.texType, null);

			// Create a framebuffer
			let fbo = gl.createFramebuffer();
			framebuffers.push(fbo);
			gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

			// Attach a texture to it.
			gl.framebufferTexture2D(
				gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
		}
		
		// provide texture coordinates for the rectangle.
		let positionBuffer = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
		  -1.0, -1.0, 
		   1.0, -1.0, 
		  -1.0,  1.0, 
		  -1.0,  1.0, 
		   1.0, -1.0, 
		   1.0,  1.0]), gl.STATIC_DRAW);
		
		GPU.textures = textures;
		GPU.framebuffers = framebuffers;
		GPU.count = 0;
	}
	
	/**
   * load data from CPU -> GPU.
   * 
   * @param {Array} source - source matrix data 
   * @param {int} width - matrix width
   * @param {int} height - matrix height
   */
	GPU.load = function(canvas, source, width, height){
    
	this.initialize(canvas, width, height);
  
    let self = this;
    let gl = self.gl;

    // console.log("source: ", source[0], source[1], source[2], source[3]);
		// start with the original image
		// let startTime = new Date();
	gl.bindTexture(gl.TEXTURE_2D, this.originalImageTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
    
    // let data = new Uint8Array(4);
    // this.gl.readPixels(0, 0, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, data);
    // console.log("data 1: ", data[0], data[1], data[2], data[3]);
		// let endTime = new Date();
		// console.log("Data[ CPU ---> GPU] " + " Width: " + width.toString() 
		// 			+ " Height: " + height.toString() 
		// 			+ " Time: " + (endTime - startTime).toString(), " ms");
	}
	
  
  /**
   * render GPU data
   * 
   * @param {object} program - GLSL program
   * @param {object} fbo - frame buffer object
   */
	GPU.render = function(program, fbo){
		//look up where the vertex data needs to go.
		let positionLocation = this.gl.getAttribLocation(program, "a_position"); 

		// look up uniform locations
		let u_imageLoc = this.gl.getUniformLocation(program, "u_image");
		let textureSizeLocation = this.gl.getUniformLocation(program, "u_textureSize");
		
		//let startTime = window.performance.now();
		//gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
		this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, 0, 0);
		this.gl.enableVertexAttribArray(positionLocation);
		
		let width = this.gl.canvas.width;
		let	height = this.gl.canvas.height;
		
		// make this the framebuffer we are rendering to.
		this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fbo);

		// Tell the shader the resolution of the framebuffer.
		this.gl.uniform2f(textureSizeLocation, width, height);
		
		this.gl.uniform1i(u_imageLoc, 0);
		
		// Tell webgl the viewport setting needed for framebuffer.
		this.gl.viewport(0, 0, width, height);
		
		// Draw the rectangle.
		this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

		// for the next draw, use the texture we just rendered to.
		// this.gl.bindTexture(gl.TEXTURE_2D, texture);
	}
  
  /**
   * draw out render result.
   */
	GPU.draw = function(){
    let gl = this.gl;
    let	program = this.createProgram("draw", `precision mediump float;
			  										uniform sampler2D u_image;
				  									uniform vec2 u_textureSize;
					  								void main() {
						  								vec2 textCoord = gl_FragCoord.xy / u_textureSize;
							  							gl_FragColor = texture2D(u_image, textCoord);
								  					}`);
    
    this.render(program, null);
    this.count = 0;
	// let data = this.readPixels();
	// console.log(data);												  	
    // let data = new Uint8Array(4);
    // this.gl.readPixels(0, 0, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, data);
    // console.log("data 2: ", data[0], data[1], data[2], data[3]);
    
    // if (canvas){
		// 	canvas.getContext("2d").drawImage(gl.canvas, 0, 0);
		// }
	}
  
  /**
   * make texture image 2D
   * 
   * @param {object} program - GLSL program
   * @param {int} id - texture ID
   * @param {string} name - texture name in GPU
   * @param {int} width - texture width
   * @param {int} height - texture height
   * @param {format} format - data format
   * @param {type} type - data type
   * @param {Array} pixels - data buffer
   */
	GPU.makeTextImage2D = function(program, id, name, width, height, format, type, pixels){
		let gl = this.gl;
		let texture = gl.createTexture();
		gl.activeTexture(gl.TEXTURE0 + id);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, format, width, height, 0, format, type, pixels);
		let u_textureLoc = gl.getUniformLocation(program, name);
		gl.uniform1i(u_textureLoc, id);
		// restore back the active TEXTURE0
		gl.activeTexture(gl.TEXTURE0);
	}
  
  /**
   * read pixels from frame buffer
   * 
   * @param {Array} pixels - frame buffer pixels 
   */
	GPU.readPixels = function(pixels){
		let gl = this.gl;
		
		if (!pixels){
			pixels = {data: new Uint8Array(gl.canvas.width*gl.canvas.height*4), width: gl.canvas.width, height: gl.canvas.height};
		}
		gl.readPixels(0, 0, gl.canvas.width, gl.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels.data);
		
		return pixels;
	}
  
  /**
   * get image data from frame buffer
   * @param {int} x - left top - x  
   * @param {int} y - left top -y
   * @param {int} width - image width
   * @param {int} height - image height
   */
	GPU.getImageData = function(x, y, width, height){
		let gl = this.gl;
		let data = new Float32Array(width*height*4);
		gl.readPixels(x, gl.drawingBufferHeight - y - height, width, height, gl.RGBA, gl.FLOAT, data);
		return {data: data, width: width, height: height};
	}
  
  /**
   * execute GPU program
   * 
   * @param {Object} program - GPU program 
   */
	GPU.execute = function(program){
		let GPU = this;
		let gl = GPU.gl;
    this.render(program, this.framebuffers[this.count % 2]);
		// for the next draw, use the texture we just rendered to.
		gl.bindTexture(gl.TEXTURE_2D, this.textures[this.count % 2]);
		// increment count so we use the other texture next time.
    ++this.count;
    
	}
}

GPU.params = {};
GPU.sources = {};
GPU.sourceText = function(name, credits){ return GPU.sources[name]; }

// const app = getApp();
window.GPU = new GPU();

// module.exports = {
// 	GPU,
// };

/**
 \end file
*/
