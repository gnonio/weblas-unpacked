/*
Copyright (c) 2016 Pedro Soares

webgl_addin.js

	RGBA unpacked type
	weblas webgl support for unpacked type

*/

var glslify	 = require('glslify'),
	weblas = require('weblas')

var gl = weblas.gpu.gl
var WebGL = weblas.gpu.gl.__proto__.constructor

/*	Basic wraper for some gl methods if THREE not present
	allows sharing of webgl context
 */
function WebGLState( gl ) {
	this.gl = gl // remove
}

gl.state = new WebGLState( gl.context )

WebGLState.prototype.initAttributes = function() {}

WebGLState.prototype.enableAttribute = function( attribute ) {
	this.gl.enableVertexAttribArray( attribute )
}

WebGLState.prototype.disableUnusedAttributes = function() {}
	
WebGLState.prototype.activeTexture = function( unit ) {
	this.gl.activeTexture( unit )
}

WebGLState.prototype.bindTexture = function( textureType, texture ) {
	this.gl.bindTexture( textureType, texture )
}

WebGLState.prototype.texImage2D = function() {
	//target, level, internalformat, width, height, border, format, type, pixels
	this.gl.texImage2D.apply( this.gl, arguments )
}

WebGLState.prototype.viewport = function( viewport ) {
	this.gl.viewport( viewport.x, viewport.y, viewport.z, viewport.w )
}

WebGLState.prototype.resetGL = function() {}

// Buffers
WebGL.prototype.setupBuffers = function() {
	var gl = this.context
	
	this.buffers = {}
	
	var framequad = {}
	
	// Quad Vertices
	var quad_vertices = new Float32Array( [
		-1.0, -1.0, 0.0,	// bottom left
		 1.0, -1.0, 0.0,	// bottom right
		 1.0,  1.0, 0.0,	// top right
		-1.0,  1.0, 0.0		// top left
	] )
	framequad.vertexBuffer = gl.createBuffer()
	gl.bindBuffer( gl.ARRAY_BUFFER, framequad.vertexBuffer )
	gl.bufferData( gl.ARRAY_BUFFER, quad_vertices, gl.STATIC_DRAW )
	
	// Quad UVs
	var quad_uvs = new Float32Array( [
		0.0, 0.0,
		1.0, 0.0,
		1.0, 1.0,
		0.0, 1.0
	] )
	framequad.uvBuffer = gl.createBuffer()
	gl.bindBuffer( gl.ARRAY_BUFFER, framequad.uvBuffer )
	gl.bufferData( gl.ARRAY_BUFFER, quad_uvs, gl.STATIC_DRAW )
	
	// Quad Indices
	var quad_faces = new Uint16Array( [
		0, 1, 2,	// bottom right triangle
		0, 2, 3		// top left triangle
	] )
	framequad.elementBuffer = gl.createBuffer()
	gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, framequad.elementBuffer )
	gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, quad_faces, gl.STATIC_DRAW )
	
	framequad.elements_length = quad_faces.length
	
	this.buffers.framequad = framequad
}
gl.setupBuffers()

// Shaders
WebGL.prototype.setupShader = function( shader_source, type ) {
	var gl = this.context

	// Compile shader
	var shader = gl.createShader( type )
	gl.shaderSource( shader, shader_source )
	gl.compileShader( shader )

	// Check compile
	var shaderInfoLog = gl.getShaderInfoLog( shader )
	
	if ( gl.getShaderParameter( shader, gl.COMPILE_STATUS ) === false ) {
		console.error( 'setupShader(): Shader compile failed.' )
	}
	if ( shaderInfoLog !== '' ) {
		console.warn( 'setupShader(): ', type === gl.VERTEX_SHADER ? 'vertex' : 'fragment' )
		console.warn( 'gl.getShaderInfoLog(): ', shaderInfoLog, addLineNumbers( shader_source ) )
	}
	
	return shader
}

WebGL.prototype.setupProgram = function( vertexShader, fragmentShader ) {
	var gl = this.context

	// Link program
	var program = gl.createProgram()
	gl.attachShader( program, vertexShader )
	gl.attachShader( program, fragmentShader )
	gl.linkProgram( program )
	
	// Check link
	var programInfoLog = gl.getProgramInfoLog( program )
	
	if ( gl.getProgramParameter( program, gl.LINK_STATUS ) === false ) {
		console.error( 'setupProgram(): ', gl.getError() )
		console.error( 'gl.VALIDATE_STATUS: ', gl.getProgramParameter( program, gl.VALIDATE_STATUS ) )
		console.error( 'gl.getProgramInfoLog(): ', programInfoLog )
	}
	if ( programInfoLog !== '' ) {
		console.warn( 'setupProgram(): ' )
		console.warn( 'gl.getProgramInfoLog(): ', programInfoLog )
	}

	return program
}

WebGL.prototype.addProgram = function( name, shader_source ) {
	var gl = this.context

	this.shaders_src[ name ] = shader_source
	
	this.shaders[ name ] = this.setupShader( this.shaders_src[ name ], gl.FRAGMENT_SHADER )
	this.programs[ name ]= this.setupProgram( this.shaders.pass_through, this.shaders[ name ] )
}

WebGL.prototype.setupPrograms = function() {
	var gl = this.context
	
	// Shader list sources
	this.shaders_src = {
		pass_through:		glslify('./glsl/pass_through.glsl'),
		
		read_packed:		glslify('./glsl/read_packed.glsl'),
		read_packed_padded:	glslify('./glsl/read_packed_padded.glsl'),
		pack:				glslify('./glsl/pack.glsl'),
		unpack:				glslify('./glsl/unpack.glsl'),
		render_packed:		glslify('./glsl/render_packed.glsl'),
		render_unpacked:	glslify('./glsl/render_unpacked.glsl'),
		
		mixin:				glslify('./glsl/mixin.glsl'), // base shader for dynamic generation
		
		duplicate:			glslify('./glsl/duplicate.glsl'),
		//duplicate_full:		glslify('./glsl/duplicate_full.glsl'),
		duplicate_packed:	glslify('./glsl/duplicate_packed.glsl'),
		
		transpose_unpacked:	glslify('./glsl/transpose_unpacked.glsl')
	}

	// Create Shaders	
	this.shaders = {}

	for ( var shader in this.shaders_src ) {
		var shaderSource = this.shaders_src[ shader ]
		var shaderType = gl.FRAGMENT_SHADER
		if ( shader === 'pass_through' ) shaderType = gl.VERTEX_SHADER
		this.shaders[ shader ] = this.setupShader( shaderSource, shaderType )
	}
	
	// Create Programs
	this.programs = {}

	for ( var shader in this.shaders ) {
		if ( shader !== 'pass_through' ) {
			this.programs[ shader ] = this.setupProgram( this.shaders.pass_through, this.shaders[ shader ] )
		}
	}
}
gl.setupPrograms()

WebGL.prototype.setupTexture = function( M, N, data, packed, glFormat, glType ) {
	var gl = this.context
	
	var W = packed ? Math.ceil( N / 4 ) : N
	var H = M

	var texture = gl.createTexture()
	
	this.state.bindTexture( gl.TEXTURE_2D, texture )
	
	gl.pixelStorei( gl.UNPACK_FLIP_Y_WEBGL, false )
	gl.pixelStorei( gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false )
	//gl.pixelStorei( gl.UNPACK_ALIGNMENT, 4 )

	this.state.texImage2D( gl.TEXTURE_2D, 0, glFormat, W, H, 0, glFormat, glType, data )
	
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE )
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE )

	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
	
	this.state.bindTexture( gl.TEXTURE_2D, null )

	return texture
}

WebGL.prototype.setupFramebuffer = function() {
	var gl = this.context
	
	var currentViewport = gl.getParameter( gl.VIEWPORT )
	var targetViewport = { x: 0, y: 0, z: 2, w: 2 }
	
	this.state.viewport( targetViewport )
	
	this.framebuffer = gl.createFramebuffer()
	
	var texture = this.setupTexture( 2, 2, null, false, gl.RGBA, gl.FLOAT )
	this.state.bindTexture( gl.TEXTURE_2D, texture )
	
	this.state.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, gl.FLOAT, null )
	gl.bindFramebuffer( gl.FRAMEBUFFER, this.framebuffer )
	gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0 )

	if( gl.checkFramebufferStatus( gl.FRAMEBUFFER ) != gl.FRAMEBUFFER_COMPLETE )
		console.error( 'bindFramebuffer(): Framebuffer not complete' )

	gl.bindFramebuffer( gl.FRAMEBUFFER, null )
}
gl.setupFramebuffer()

// BINDING
WebGL.prototype.bindBuffers = function( buffers ) {
	var gl = this.context
		
	var position = gl.getAttribLocation( this.program, 'position' )
	var texture = gl.getAttribLocation( this.program, 'uv' )
	
	this.state.initAttributes()
	this.state.enableAttribute( position )
	this.state.enableAttribute( texture )
	this.state.disableUnusedAttributes()	
		
	gl.bindBuffer( gl.ARRAY_BUFFER, buffers.vertexBuffer )
	gl.vertexAttribPointer( position, 3, gl.FLOAT, false, 0, 0 )

	gl.bindBuffer( gl.ARRAY_BUFFER, buffers.uvBuffer )	
	gl.vertexAttribPointer( texture, 2, gl.FLOAT, false, 0, 0 )

	gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, buffers.elementBuffer )
}

WebGL.prototype.bindUniforms = function( uniforms ) {
	for ( var location in uniforms ) {
		var uniform = uniforms[ location ]
		this.bindUniform( uniform.type, uniform.value, location )
	}
}
/* uniform binding one-liner resembling texture binding
	instead of:
		var N_in_gl = this.context.getUniformLocation( this.program, 'N' )
		this.context.uniform1f( N_in_gl, N )
	we do:
		this.bindUniform( 'uniform1f', N, 'N' )
	akin to:		
		this.bindInputTexture( texture0, this.context.TEXTURE0, 'A' )
	
	we could further level the order of arguments too,
	or even unify these methods (at the cost of a type check)
*/
WebGL.prototype.bindUniform = function( type, data, name ) {
	var uniform_gl = this.context.getUniformLocation( this.program, name )
	this.context[type]( uniform_gl, data )
}

WebGL.prototype.bindTextures = function( tensors ) {
	var unit = 0
	for ( var location in tensors ) {
		var tensor = tensors[ location ]
		this.bindTexture( tensor.texture, unit, location )
		this.bindUniform( 'uniform1i', tensor.channel, location + '_channel' )
		unit++
	}
}

WebGL.prototype.bindTexture = function( texture, unit, location ) {
	var gl = this.context
	
	this.state.activeTexture( gl.TEXTURE0 + unit )	
	this.state.bindTexture( gl.TEXTURE_2D, texture )

	var uniform_gl = gl.getUniformLocation( this.program, location )
	gl.uniform1i( uniform_gl, unit )

}

WebGL.prototype.unbindTextures = function( textures ) {
	var unit = 0
	for ( var texture in textures ) {
		this.unbindTexture( unit )
		unit++
	}
}

WebGL.prototype.unbindTexture = function( unit ) {
	var gl = this.context
	
	this.state.activeTexture( gl.TEXTURE0 + unit )	
	this.state.bindTexture(	gl.TEXTURE_2D, null )
}


WebGL.prototype.bindFramebuffer = function( M, N, texture ) {
	var gl = this.context
	
	var currentViewport = gl.getParameter( gl.VIEWPORT )
	var targetViewport = { x: 0, y: 0, z: N, w: M }
	
	this.state.viewport( targetViewport )
	
	if ( viewportsEqual( currentViewport, targetViewport ) ) {
		this.framebuffer = this.framebuffer ? this.framebuffer : gl.createFramebuffer()
	} else {
		if ( this.framebuffer ) gl.deleteFramebuffer( this.framebuffer )
		this.framebuffer = gl.createFramebuffer()
	}
	
	gl.bindFramebuffer( gl.FRAMEBUFFER, this.framebuffer )
	gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0 )

	if( gl.checkFramebufferStatus( gl.FRAMEBUFFER ) != gl.FRAMEBUFFER_COMPLETE )
		console.error( 'bindFramebuffer(): Framebuffer not complete' )
}

/* Read data out as floats
	for ouput purposes only we are 'deferring' all null data (found in padded textures)
	to the end of the array instead of having padded 0s per each row to prevent any user postprocessing
	this is done at the shader level but must be handled when generating the CPU array
*/
WebGL.prototype.readFloat = function( M, N, packed ) {
	var gl = this.context

	var W = packed ? Math.ceil( N / WebGL.COMPONENTS_PER_TEXEL ) : N
	var H = M
	var size = H * W * Float32Array.BYTES_PER_ELEMENT * 4

	// create destination buffer
	var rawbuffer = new ArrayBuffer( size )
	
	var readBuffer = new Float32Array( rawbuffer )
	gl.readPixels( 0, 0, W, H, gl.RGBA, gl.FLOAT, readBuffer )

	var sub_end = ( size - M * N * Float32Array.BYTES_PER_ELEMENT ) / WebGL.COMPONENTS_PER_TEXEL
	
	// !!?? subarray() must use negative indexes of the relevant part else the full typed array is returned
	// Must use negative indexes
	return !packed || sub_end == 0 ? readBuffer : readBuffer.subarray( -size, -sub_end )
}

WebGL.prototype.renderPass = function( output, program, buffers, uniforms, textures ) {
	var gl = this.context
	
	this.program = program
	
	gl.useProgram( program )
	
	this.bindBuffers( buffers )
	
	this.bindUniforms( uniforms )
	
	this.bindTextures( textures )
	
	this.bindFramebuffer( output.height, output.width, output.texture )
	
	gl.drawElements( gl.TRIANGLES, buffers.elements_length, gl.UNSIGNED_SHORT, 0 )
	
	this.unbindTextures( textures )
	
	// handoff context
	this.state.resetGL()
}

/*	float texture read, allows output as packed+deferred or unpacked
 */
WebGL.prototype.render = function( M, N, tensor, out, packed ) {
	var output = { width: N, height: M, texture: out }
	
	var uniforms = {}

	if ( packed ) {
		var W = Math.ceil( N / 4 )
		var H = M
		
		output.width = W
		
		var pad = W * 4 - N
		
		uniforms = {
			cols: 			{ type: 'uniform1f', value: W },
			col_hstep: 		{ type: 'uniform1f', value: ( 1 / W ) * 0.5 },
			rows: 			{ type: 'uniform1f', value: H },
			row_hstep: 		{ type: 'uniform1f', value: ( 1 / H ) * 0.5 },
			
			up_cols: 		{ type: 'uniform1f', value: W * 4 },
			up_col_hstep: 	{ type: 'uniform1f', value: ( 1 / (W * 4) ) * 0.5 },
			up_cols_padded: { type: 'uniform1f', value: W * 4 - pad }
		}
	}
	
	var textures = {
		A: tensor
	}
	
	// Dynamic generation occurs here
	// we have uniforms and textures set and can now include them in shader
	
	// -> extend ability to common functions get/set_channel_value and do without glslify
	
	// -> use caching for generated programs, follow similar method of generate_mixin_program()
	
	// -> externalize ability to write frag shader main() from outside
	var program = packed ? this.programs.render_packed : this.programs.render_unpacked
	
	var buffers = this.buffers.framequad
	
	this.renderPass( output, program, buffers, uniforms, textures )
}

/*	direct texture float data read (no float encode) - requires OES_texture_float support
 */
WebGL.prototype.read = function( M, N, tensor, out ) {
	var output = { width: N, height: M, texture: out }
	
	var uniforms = {}

	if ( tensor.requires_padding ) {
		var W = Math.ceil( N / 4 )
		var H = M
		
		output.width = W
		
		var pad = W * 4 - N
		
		uniforms = {
			cols: 			{ type: 'uniform1f', value: W },
			col_hstep: 		{ type: 'uniform1f', value: ( 1 / W ) * 0.5 },
			rows: 			{ type: 'uniform1f', value: H },
			row_hstep: 		{ type: 'uniform1f', value: ( 1 / H ) * 0.5 },
			
			up_cols: 		{ type: 'uniform1f', value: W * 4 },
			up_col_hstep: 	{ type: 'uniform1f', value: ( 1 / (W * 4) ) * 0.5 },
			
			pad: 			{ type: 'uniform1f', value: pad },
			up_cols_padded: { type: 'uniform1f', value: W * 4 - pad }
		}
	}
	
	var textures = {
		A: tensor
	}

	var program = tensor.requires_padding ? this.programs.read_packed_padded : this.programs.read_packed
	
	var buffers = this.buffers.framequad
	
	this.renderPass( output, program, buffers, uniforms, textures )
}

/*	duplicate texture (use in iterative calculations)
 */
WebGL.prototype.duplicate = function( M, N, tensor, out, packed ) {
	var output = { width: N, height: M, texture: out.texture }
	
	var uniforms = {}

	if ( !packed ) {		
		uniforms = {
			write_channel:	{ type: 'uniform1i', value: out.channel }
		}
	}
	
	var textures = {
		A: tensor
	}

	var program = !packed ? this.programs.duplicate : this.programs.duplicate_packed
	
	var buffers = this.buffers.framequad
	
	this.renderPass( output, program, buffers, uniforms, textures )
}

/*	used to convert a unpacked texture into a packed texture
 */
WebGL.prototype.pack = function( M, N, tensor, out ) {
	var output = { width: N, height: M, texture: out }
	
	var uniforms = {}

	var W = Math.ceil( N / 4 )
	var H = M
	
	uniforms = {
		cols: 			{ type: 'uniform1f', value: W },
		col_hstep: 		{ type: 'uniform1f', value: ( 1 / W ) * 0.5 },
		rows: 			{ type: 'uniform1f', value: H },
		row_hstep: 		{ type: 'uniform1f', value: ( 1 / H ) * 0.5 },
		
		up_cols: 		{ type: 'uniform1f', value: N },
		up_col_hstep: 	{ type: 'uniform1f', value: ( 1 / N ) * 0.5 }
	}
	
	var textures = {
		A: tensor
	}

	var program = this.programs.pack
	
	var buffers = this.buffers.framequad
	
	this.renderPass( output, program, buffers, uniforms, textures )
}

/*	used to convert a packed texture (data is held in all RGBA channels)
	into an unpacked texture (data is held in a selected channel)
 */
WebGL.prototype.unpack = function( M, N, tensor, out ) {
	var output = { width: N, height: M, texture: out }
	
	var uniforms = {}

	var W = N
	var H = M
	
	uniforms = {
		cols: 			{ type: 'uniform1f', value: W },
		col_hstep: 		{ type: 'uniform1f', value: ( 1 / W ) * 0.5 },
		rows: 			{ type: 'uniform1f', value: H },
		row_hstep: 		{ type: 'uniform1f', value: ( 1 / H ) * 0.5 },
		
		p_cols: 		{ type: 'uniform1f', value: Math.ceil( W / 4 ) },
		p_col_hstep: 	{ type: 'uniform1f', value: ( 1 / Math.ceil( W / 4 ) ) * 0.5 },
		
		write_channel:	{ type: 'uniform1i', value: tensor.channel }
	}
	
	var textures = {
		A: tensor
	}

	var program = this.programs.unpack
	
	var buffers = this.buffers.framequad
	
	this.renderPass( output, program, buffers, uniforms, textures )
}

/* tranpose a texture where input has M rows and N columns
 */
WebGL.prototype.transpose_packed = WebGL.prototype.transpose

/* tranpose a texture where input has M rows and N columns
 */
WebGL.prototype.transpose = function( M, N, tensor, out ) {
	// WARNING! SWITCHED M | N 
	var output = { width: M, height: N, texture: out.texture }
	
	var uniforms = {}

	uniforms = {
		write_channel:	{ type: 'uniform1i', value: out.channel }
	}
	
	var textures = {
		A: tensor
	}

	var program = this.programs.transpose_unpacked	
	
	var buffers = this.buffers.framequad
	
	this.renderPass( output, program, buffers, uniforms, textures )
}

/*	combine texture channels
 */
WebGL.prototype.mixin = function( M, N, red, green, blue, alpha, mix ) {
	var output = { width: N, height: M, texture: mix.texture }
	
	var uniforms = {}
	var textures = {}

	if ( red != null ) textures.RED = red
	if ( green != null ) textures.GREEN = green
	if ( blue != null )	textures.BLUE = blue
	if ( alpha != null ) textures.ALPHA = alpha

	var program = this.generate_mixin_program( red, green, blue, alpha )
	
	var buffers = this.buffers.framequad
	
	this.renderPass( output, program, buffers, uniforms, textures )
}

WebGL.prototype.generate_mixin_program = function( red, green, blue, alpha ) {
	var gl = this.context
	
	var r = red != null ? 'r' : 'n'
	var g = green != null ? 'g' : 'n'
	var b = blue != null ? 'b' : 'n'
	var a = alpha != null ? 'a' : 'n'
	
	// compose name along the pattern "mixin_rgba_program"
	// where each channel is replaced with "n" if null
	var program_name = 'mixin_' + r + g + b + a + '_program'
	
	// generate only if program is inexistent
	if ( !this.programs.hasOwnProperty( program_name ) ) {

		var new_frag = this.shaders_src.mixin // dynamic shader base struture

		// glsify appends a numeric code to each 'glsified' shader function
		// we must source the fragment with this renamed function
		var get_channel_value_fnc = new RegExp( '(get_channel_value_)(\\d+)' ).exec( new_frag )

		var uniforms = { 'RED': red, 'GREEN': green, 'BLUE': blue, 'ALPHA': alpha }
		var values = { 'RED': '0.0', 'GREEN': '0.0', 'BLUE': '0.0', 'ALPHA': '0.0' }

		for ( var key in uniforms ) {
			if ( uniforms[ key ] != null ) {
				var new_frag_uniform = 	'uniform sampler2D	' + key + '; 				// texture with unpacked data ' + key + '\r\n' +
										'uniform int			' + key + '_channel; 		// channel to read data from\r\n'

				var new_frag_value = 	'float ' + key + ' = ' + get_channel_value_fnc[0] + '( ' + key + ', ' + key + '_channel, UVs );\r\n'

				new_frag = new_frag.replace( '// u' + key + '\r\n', new_frag_uniform )
				new_frag = new_frag.replace( '// m' + key + '\r\n', new_frag_value )

				values[ key ] = key
			}
		}

		var new_glfragcolor = 'gl_FragColor = vec4( ' + values[ 'RED' ] + ', ' +
														values[ 'GREEN' ] + ', ' +
														values[ 'BLUE' ] + ', ' +
														values[ 'ALPHA' ] + ' );\r\n'

		new_frag = new_frag.replace( '// glFG\r\n', new_glfragcolor )

		this.shaders[ program_name ] = this.setupShader( new_frag, gl.FRAGMENT_SHADER )
		this.programs[ program_name ] = this.setupProgram( this.shaders.pass_through, this.shaders[ program_name ] )
	}
	return this.programs[ program_name ]
}


// Utils
// check viewports
function viewportsEqual( cv, tv ) {
	if ( cv[0] === tv.x && cv[1] === tv.y && cv[2] === tv.z && cv[3] === tv.w ) {
		return true
	} else {
		return false
	}
}
// addLineNumbers from THREE.WebGLShader
function addLineNumbers( string ) {
	var lines = string.split( '\n' )
	for ( var i = 0; i < lines.length; i ++ ) {
		lines[ i ] = ( i + 1 ) + ': ' + lines[ i ]
	}
	return lines.join( '\n' )
}