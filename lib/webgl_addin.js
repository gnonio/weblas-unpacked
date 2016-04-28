/*
Copyright (c) 2016 Pedro Soares

webgl_addin.js

	RGBA unpacked type
	weblas webgl support for unpacked type

*/

var glslify	 = require('glslify'),
	weblas = require('weblas')

/*var globals	 = require('../node_modules/weblas/lib/globals'),
WebGL	 = require('../node_modules/weblas/lib/webgl')

var gl = globals.gl*/
var gl = weblas.gpu.gl
var WebGL = weblas.gpu.gl.__proto__.constructor

// Basic shaders
var read_packed			 = glslify('./glsl/read_packed.glsl'),
	read_packed_padded	 = glslify('./glsl/read_packed_padded.glsl'),
	pack				 = glslify('./glsl/pack.glsl'),
	unpack				 = glslify('./glsl/unpack.glsl'),
	render_packed		 = glslify('./glsl/render_packed.glsl'),
	render_unpacked		 = glslify('./glsl/render_unpacked.glsl'),
	duplicate			 = glslify('./glsl/duplicate.glsl'),
	duplicate_full		 = glslify('./glsl/duplicate_full.glsl'),
	duplicate_packed	 = glslify('./glsl/duplicate_packed.glsl'),
	transpose_unpacked	 = glslify('./glsl/transpose_unpacked.glsl')

	gl.read_packed_program			 = gl.createProgram( read_packed )
	gl.read_packed_padded_program	 = gl.createProgram( read_packed_padded )
	gl.pack_program					 = gl.createProgram( pack )
	gl.unpack_program				 = gl.createProgram( unpack )
	gl.render_packed_program		 = gl.createProgram( render_packed )
	gl.render_unpacked_program		 = gl.createProgram( render_unpacked )
	gl.duplicate_program			 = gl.createProgram( duplicate )
	gl.duplicate_full_program		 = gl.createProgram( duplicate_full )
	gl.duplicate_packed_program		 = gl.createProgram( duplicate_packed )
	gl.transpose_unpacked_program	 = gl.createProgram( transpose_unpacked )

/*	direct texture float data read (no float encode) - requires OES_texture_float support
 */
WebGL.prototype.read = function( M, N, tensor, out ) {
	this.program = tensor.requires_padding ? this.read_packed_padded_program : this.read_packed_program
	this.selectProgram(this.program)
	
	var W = Math.ceil( N / WebGL.COMPONENTS_PER_TEXEL )
	var H = M
	
	if ( tensor.requires_padding ) {	
		// number of columns
		this.bindUniform( 'uniform1f', W, 'cols' )
		this.bindUniform( 'uniform1f', (1 / W) * 0.5, 'col_hstep' )
		// number of rows
		this.bindUniform( 'uniform1f', H, 'rows')
		this.bindUniform( 'uniform1f', (1 / H) * 0.5, 'row_hstep' )
		
		// number of unpacked columns
		this.bindUniform( 'uniform1f', W * 4, 'up_cols' )
		this.bindUniform( 'uniform1f', ( 1.0 / (W * 4) ) * 0.5, 'up_col_hstep' )
		
		// padding
		var pad = W * WebGL.COMPONENTS_PER_TEXEL - N
		this.bindUniform( 'uniform1f', pad, 'pad' )
		this.bindUniform( 'uniform1f', W * 4 - pad, 'up_cols_padded' )
	}

	this.bindInputTexture( tensor.texture, this.context.TEXTURE0, 'A' )

	this.bindOutputTexture( H, W, out )

	this.context.drawElements( this.context.TRIANGLES, /*num items*/6, this.context.UNSIGNED_SHORT, 0 )

	this.unbindInputTexture( this.context.TEXTURE0 )
}

/*	used to convert a unpacked texture into a packed texture
 */
WebGL.prototype.pack = function( M, N, tensor, out ) {
	this.program = this.pack_program
	this.selectProgram( this.program )
	
	var W = Math.ceil( N / WebGL.COMPONENTS_PER_TEXEL )
	var H = M
	// number of columns
	this.bindUniform( 'uniform1f', W, 'cols' )
	this.bindUniform( 'uniform1f', (1 / W) * 0.5, 'col_hstep' )
	// number of rows
	this.bindUniform( 'uniform1f', H, 'rows')
	this.bindUniform( 'uniform1f', (1 / H) * 0.5, 'row_hstep' )
	
	// number of unpacked columns
	this.bindUniform( 'uniform1f', N, 'up_cols' )
	this.bindUniform( 'uniform1f', ( 1.0 / N ) * 0.5, 'up_col_hstep' )
	
	this.bindInputTexture( tensor.texture, this.context.TEXTURE0, 'A' )
	
	this.bindUniform( 'uniform1i', tensor.texture_slot, 'A_channel' )

	this.bindOutputTexture( H, W, out )

	this.context.drawElements( this.context.TRIANGLES, /*num items*/6, this.context.UNSIGNED_SHORT, 0 )

	this.unbindInputTexture( this.context.TEXTURE0 )
}

/*	used to convert a packed texture (data is held in all RGBA channels)
	into an unpacked texture (data is held in a selected channel)
 */
WebGL.prototype.unpack = function( M, N, tensor, out ) {
	this.program = this.unpack_program
	this.selectProgram( this.program )
	
	var W = N
	var H = M
	
	// number of columns
	this.bindUniform( 'uniform1f', W, 'cols' )
	this.bindUniform( 'uniform1f', (1 / W) * 0.5, 'col_hstep' )
	// number of rows
	this.bindUniform( 'uniform1f', H, 'rows')
	this.bindUniform( 'uniform1f', (1 / H) * 0.5, 'row_hstep' )
	
	// number of packed columns
	this.bindUniform( 'uniform1f', Math.ceil( W / 4 ), 'p_cols' )
	this.bindUniform( 'uniform1f', ( 1.0 / Math.ceil( W / 4 ) ) * 0.5, 'p_col_hstep' )
	
	this.bindInputTexture( tensor.texture, this.context.TEXTURE0, 'A' )

	this.bindUniform( 'uniform1i', tensor.texture_slot, 'write_channel' )

	this.bindOutputTexture( H, W, out )

	this.context.drawElements( this.context.TRIANGLES, /*num items*/6, this.context.UNSIGNED_SHORT, 0 )

	this.unbindInputTexture( this.context.TEXTURE0 )
}

/*	unpacked float texture read, allows output as packed+deferred or unpacked
 */
WebGL.prototype.render = function( M, N, tensor, out, packed ) {
	this.program = packed ? this.render_packed_program : this.render_unpacked_program
	this.selectProgram( this.program )
	
	var W = packed ? Math.ceil( N / WebGL.COMPONENTS_PER_TEXEL ) : N
	var H = M
	
	if ( packed ) {
		// number of columns
		this.bindUniform( 'uniform1f', W, 'cols' )
		this.bindUniform( 'uniform1f', (1 / W) * 0.5, 'col_hstep' )
		// number of rows
		this.bindUniform( 'uniform1f', H, 'rows')
		this.bindUniform( 'uniform1f', (1 / H) * 0.5, 'row_hstep' )

		// number of unpacked columns		
		this.bindUniform( 'uniform1f', W * 4, 'up_cols' )
		this.bindUniform( 'uniform1f', ( 1.0 / (W * 4) ) * 0.5, 'up_col_hstep' )

		// number of unpacked columns accounting padding
		var pad = Math.ceil( N / WebGL.COMPONENTS_PER_TEXEL ) * WebGL.COMPONENTS_PER_TEXEL - N
		this.bindUniform( 'uniform1f', W * 4 - pad, 'up_cols_padded' )
	}
	
	this.bindInputTexture( tensor.texture, this.context.TEXTURE0, 'A' )	
	this.bindUniform( 'uniform1i', tensor.texture_slot, 'A_channel' )

	this.bindOutputTexture( H, W, out )

	this.context.drawElements( this.context.TRIANGLES, /*num items*/6, this.context.UNSIGNED_SHORT, 0 )

	this.unbindInputTexture( this.context.TEXTURE0 )
}

/*	duplicate texture (use in iterative calculations)
 */
WebGL.prototype.duplicate = function( M, N, tensor, out, full ) {
	this.program = typeof full == 'undefined' ? this.duplicate_program : this.duplicate_full_program
	this.selectProgram( this.program )
	
	var W = N
	var H = M
	
	this.bindInputTexture( tensor.texture, this.context.TEXTURE0, 'A' )
	this.bindUniform( 'uniform1i', tensor.texture_slot, 'A_channel' )
	
	this.bindUniform( 'uniform1i', out.texture_slot, 'write_channel' )

	this.bindOutputTexture( H, W, out.texture )

	this.context.drawElements( this.context.TRIANGLES, /*num items*/6, this.context.UNSIGNED_SHORT, 0 )

	this.unbindInputTexture( this.context.TEXTURE0 )
}

/*	duplicate texture (use in iterative calculations)
 */
WebGL.prototype.duplicate_packed = function( M, N, tensor, out ) {
	this.program = this.duplicate_packed_program
	this.selectProgram( this.program )
	
	var W = Math.ceil( N / WebGL.COMPONENTS_PER_TEXEL )
	var H = M
	
	this.bindInputTexture( tensor.texture, this.context.TEXTURE0, 'A' )

	this.bindOutputTexture( H, W, out )

	this.context.drawElements( this.context.TRIANGLES, /*num items*/6, this.context.UNSIGNED_SHORT, 0 )

	this.unbindInputTexture( this.context.TEXTURE0 )
}

/* tranpose a texture where input has M rows and N columns
 */
WebGL.prototype.transpose_unpacked = function( M, N, tensor, out ) {
	this.program = this.transpose_unpacked_program
	this.selectProgram( this.program )

	var W = M
	var H = N

	this.bindInputTexture( tensor.texture, this.context.TEXTURE0, 'A' )

	this.bindUniform( 'uniform1i', tensor.texture_slot, 'A_channel' )

	this.bindOutputTexture( H, W, out )

	this.context.drawElements( this.context.TRIANGLES, /*num items*/6, this.context.UNSIGNED_SHORT, 0 )

	this.unbindInputTexture( this.context.TEXTURE0 )
}

/* create LUMINANCE texture of width w from given texels
   if texels is null, an empty texture is created.
 */
WebGL.prototype.createInputTexture = function( height, width, texels ) {
	var gl = this.context

	// create the texture from our floats
	var texture = gl.createTexture()

	gl.bindTexture( gl.TEXTURE_2D, texture )
	
	gl.texImage2D( gl.TEXTURE_2D, 0, gl.LUMINANCE, width, height, 0, gl.LUMINANCE, gl.FLOAT, texels)
	
	// clamp to edge to support non-power of two textures
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE )
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE )

	// don't interpolate when getting data from texture
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST )
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST )

	// we're done with setup, so unbind current texture
	gl.bindTexture( gl.TEXTURE_2D, null )

	return texture;
}

WebGL.prototype.createFloatTexture = function( M, N, packed ) {
	var gl = this.context;
	
	var W = packed ? Math.ceil( N / WebGL.COMPONENTS_PER_TEXEL ) : N
	var H = M

	// create the texture from our floats
	var texture = gl.createTexture()

	gl.bindTexture( gl.TEXTURE_2D, texture )
	
	gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.FLOAT, null)
	
	// clamp to edge to support non-power of two textures
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE )
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE )

	// don't interpolate when getting data from texture
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)

	// we're done with setup, so unbind current texture
	gl.bindTexture( gl.TEXTURE_2D, null )

	return texture
}

/* Read data out as floats */
WebGL.prototype.readFloat = function( M, N, packed ) {
	var gl = this.context;

	var W = packed ? Math.ceil( N / WebGL.COMPONENTS_PER_TEXEL ) : N
	var size = M * W * Float32Array.BYTES_PER_ELEMENT * WebGL.COMPONENTS_PER_TEXEL

	// create destination buffer
	var rawbuffer = new ArrayBuffer( size )
	
	var readBuffer = new Float32Array( rawbuffer )
	gl.readPixels( 0, 0, W, M, gl.RGBA, gl.FLOAT, readBuffer )

	var sub_end = ( size - M * N * Float32Array.BYTES_PER_ELEMENT ) / WebGL.COMPONENTS_PER_TEXEL
	
	// !!?? subarray() must use negative indexes of the relevant part else the full typed array is returned
	// Must use negative indexes
	return !packed || sub_end == 0 ? readBuffer : readBuffer.subarray( -size, -sub_end )
}

/* uniform binding one-liner */
WebGL.prototype.bindUniform = function( type, data, name ) {
	var uniform_gl = this.context.getUniformLocation( this.program, name )
	this.context[type]( uniform_gl, data )
}