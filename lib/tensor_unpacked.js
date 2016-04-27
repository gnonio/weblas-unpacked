/*
Copyright (c) 2016 Pedro Soares

tensor_unpacked.js

	RGBA unpacked type
	attempts to optimize in favour of more computations and fewer reads
	using RGBA channels to hold up to 4 data textures of same shape
	
	input data by default is still uploaded packed in an RGBA format
	
	intermediate computations are necessarily output in RGBA format in any case
	implying somes wastes in length of output width (4x), but...
	waste in memory may be recovered via the combination of multiple textures into one
	waste in compute cycles may be recovered via saves in padding/packing/float conversion computations
	gains in glsl logic simplification (ie. transposing is achieved by switiching texture coordinates dims)
	
	texture_slot will be used to select the channel to read from in-shader
	we might devise a memory RGBA texture manager considering texture binding efficiency
	picking the first free slot of an attributed RGBA texture, newly created or already existing
	
	some computation stages may output auxiliary variables in addition to results at once (ie. Softmax?)
	variables (in RGBA texture + slot) to be used in later distinct computations
	
		Alernatively LUMINANCE format should be more efficient to upload data to GPU
		preventing preprocessing, due to padding requirements of the data
		mantains compatibility with logic for proposed RGBA unpacked

		set type = false to use LUMINANCE
		(ie. values will be present in each red, green and blue channels, with alpha set to 1)
		
		when reading values from an internal unpacked type, the padding, if any,
		is deferred to the end of the typed array and will contain garbage if read
		related functions should preferably subarray() or alternatively slice() such texture outputs
		!!?? subarray() must use negative indexes of the relevant part else the full typed array is returned

*/

/*var globals	 = require('./globals')

var gl = globals.gl*/

var weblas = require('weblas')
var gl = weblas.gpu.gl

function Tensor( shape, data ) {
	/*if ( shape[0] * shape[1] != data.length )
		throw new Error('Shape must check with Data size ( ' + shape[0] + '*' + shape[1] + ' != ' + data.length + ' )');*/

	var M = shape[0],
		N = shape[1]
	
	this.shape = shape
	
	this.requires_padding = N % gl.constructor.COMPONENTS_PER_TEXEL != 0	
	this.requires_encode = !gl.hasFloat
	
	this.packed = false
	
	if ( typeof data == 'undefined' || data == null || data.length == 0 ) {
		this.texture = gl.createFloatTexture( M, N, false )
		this.texture_slot = 0
	} else {
		this.texture = gl.createInputTexture( M, N, Float32Array.from( data ) )
		this.texture_slot = 0 // 0 = RED, 1 = GREEN, 2 = BLUE, 3 = ALPHA			

	}
}
module.exports = Tensor

Tensor.prototype.delete_ = function() {
	gl.context.deleteTexture( this.texture )
	this.texture = null
	this.shape = null
	
	this.requires_padding = null
	this.requires_encode = null
	this.packed = null
	this.texture_slot = null
}

Tensor.prototype.transfer = function( keep ) {
	if ( !this.packed ) {
		//throw new Error('Warning - transfer(): Unpacked texture - using download()')
		console.log('Warning - transfer(): Unpacked texture - using download()')
		return this.download( keep )
	}

	var M = this.shape[0],
		N = this.shape[1],
		out,
		result;

	if ( this.requires_encode ) {
		console.log('Warning transfer(): using float encode.')
		// create output texture
		out = gl.createOutputTexture( M, N )
		// float extraction
		gl.encode( M, N, this.texture, out )
		result = new Float32Array( gl.readData( M, N ) )
	} else {
		// direct read floats, functions deal with adjusting ouput texture format/shape
		out = gl.createFloatTexture( M, N, true )
		gl.read( M, N, this, out )
		result = gl.readFloat( M, N, true )
	}
	
	// clean up
	gl.context.deleteTexture(out);

	if ( !keep ) {
		this.delete_()
	}

	return result
}

Tensor.prototype.transpose = function( keep ) {
	var M = this.shape[0],
		N = this.shape[1]

	// create new texture to hold tranpose
	var tT
	
	if ( this.packed ) {
		tT = new weblas.pipeline.Tensor( [N, M], null )
		// invoke shader
		gl.transpose( M, N, this.texture, tT.texture )
	} else {
		tT = new weblas.unpacked.Tensor( [N, M], null )
		// invoke shader
		gl.transpose_unpacked( M, N, this, tT.texture )
	}

	if ( !keep ) {
		this.delete_()
	}

	return tT
}

/*	Facility to convert in-GPU unpacked textures to packed
 */
Tensor.prototype.pack = function() {
	if ( this.packed ) throw new Error('pack(): Tensor is already packed to an RGBA texture.')

	var M = this.shape[0],
		N = this.shape[1],
		out
	
	// create output texture	
	out = gl.createFloatTexture( M, N, true )
	// invoke shader
	gl.pack( M, N, this, out )
	// clean up
	gl.context.deleteTexture( this.texture )

	this.packed = true
	this.format = gl.context.RGBA
	this.texture_slot = null
	this.texture = out
}

/*	Facility to convert in-GPU packed textures to unpacked
	optionaly receives a slot selection - 0 by default
 */
Tensor.prototype.unpack = function( slot ) {
	if ( !this.packed ) throw new Error('unpack(): Tensor is already unpacked to an RGBA texture.')

	var M = this.shape[0],
		N = this.shape[1],
		out
	
	this.texture_slot = typeof slot == 'undefined' ? 0 : slot

	// create output texture
	out = gl.createFloatTexture( M, N, false )
	// invoke shader
	gl.unpack( M, N, this, out )
	// clean up
	gl.context.deleteTexture( this.texture )
	
	this.packed = false
	this.format = gl.context.RGBA
	this.texture = out
}

/*	Facility akin to transfer() for unpacked textures
	optionally allows to output as unpacked texture
	defaults to packed type as that is what we usually need on the CPU side
 */
Tensor.prototype.download = function( keep, unpacked ) {
	if ( this.packed ) {
		console.log('Warning - download(): Packed texture - using transfer()')
		return this.transfer( keep )
	}

	var M = this.shape[0],
		N = this.shape[1],
		out,
		result
	
	var packed = typeof unpacked == 'undefined' ? true : !unpacked
	
	// create output texture	
	out = gl.createFloatTexture( M, N, packed )
	// invoke shader
	gl.render( M, N, this, out, packed )
	result = gl.readFloat( M, N, packed )
	// clean up
	gl.context.deleteTexture( out )
	
	if ( !keep ){
		this.delete_()
	}
	return result
}

/*	Facility to clone textures, for in-GPU staged computations
	a logical duplication is insuficient since data may be updated
	and pre-update values required (ie. self addition a += b)
 */
Tensor.prototype.duplicate = function( destination ) {
	var M = this.shape[0],
		N = this.shape[1]

	// create new tensor to hold duplicate
	var clone

	if ( this.requires_encode ) {
		var duplicate = this.transfer( true )
		clone = new weblas.pipeline.Tensor( this.shape, duplicate )
	} else {
		if ( this.packed ) {
			// invoke shader
			clone = new weblas.pipeline.Tensor( this.shape, new Float32Array( M * N ) )
			gl.duplicate_packed( M, N, this, clone.texture )
		} else {
			if ( typeof destination == 'undefined' ) {
				/*	must trigger RGBA tensor creation
					LUM format can not be writen to except as a CPU-GPU upload (AMD limitation?)				
				*/
				clone = new weblas.unpacked.Tensor( this.shape, null ) // null for RGBA tensor creation
			} else { // will write to an existing given texture
				clone = destination
			}
			gl.duplicate( M, N, this, clone )
		}
	}
	return clone
}