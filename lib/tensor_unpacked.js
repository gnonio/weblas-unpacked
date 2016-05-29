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
	
	channel will be used to select the channel to read from in-shader
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

var weblas = require('weblas')
var gl, float_support

var HOST
try {
	HOST = weblas.gpu.gl.__proto__.constructor
	gl = weblas.gpu.gl
	float_support = gl.hasFloat
} catch ( error ) { console.info( 'tensor_unpacked', error ) }

try {
	HOST = TCompute
	if ( window.tcompute === undefined ) {
		window.tcompute = new TCompute()
	}
	gl = window.tcompute
	float_support = gl.float_support
} catch ( error ) { console.info( 'tensor_unpacked', error ) }

function Tensor( shape, data/*, format, type*/ ) {
	/*if ( shape[0] * shape[1] != data.length )
		throw new Error('Shape must check with Data size ( ' + shape[0] + '*' + shape[1] + ' != ' + data.length + ' )')*/

	var M = shape[0],
		N = shape[1]

	this.shape = shape

	this.gl = gl
	
	this.requires_padding = N % 4 != 0
	this.requires_encode = !float_support

	this.packed = false

	this.mixed = []

	if ( data === undefined || data === null || data.length === 0 ) {
		var glFormat = gl.context.RGBA
		var glType = gl.context.FLOAT
		/*if ( format !== undefined ) glFormat = gl.context[ format ]
		if ( type !== undefined ) glType = gl.context[ type ]*/
		this.texture = gl.setupTexture( M, N, null, false, glFormat, glType )
		this.channel = 0
	} else {
		if ( !( data instanceof Float32Array ) ) data = Float32Array.from( data )
		this.texture = gl.setupTexture( M, N, data, false, gl.context.LUMINANCE, gl.context.FLOAT )
		this.channel = 0 // 0 = RED, 1 = GREEN, 2 = BLUE, 3 = ALPHA
	}
	// Create THREE texture
	try {
		if ( Number( THREE.REVISION ) >= 76 ) {
			var texture = new THREE.GpuTexture( this.texture, this.shape[1], this.shape[0], THREE.RGBAFormat, THREE.FloatType )
			this.THREE = texture
		}
	} catch ( error ) {}

}
module.exports = Tensor

Tensor.prototype.delete = function() {
	var gl = this.gl
	
	gl.context.deleteTexture( this.texture )
	this.texture = null
	this.shape = null
	
	this.requires_padding = null
	this.requires_encode = null
	this.packed = null
	this.channel = null
	
	this.mixed = null
}

Tensor.prototype.transfer = function( keep ) {
	var gl = this.gl
	
	if ( !this.packed ) {
		console.info('transfer(): Unpacked texture - using download()')
		return this.download( keep )
	}

	var M = this.shape[0],
		N = this.shape[1],
		out,
		result

	if ( this.requires_encode ) {
		console.info('transfer(): using float encode.')
		console.warn('transfer(): Packed texture - requires encode not yet supported.')
		// Fixme: using textures in different gl.contexts
		
		// create output texture
		out = weblas.gpu.gl.createOutputTexture( M, N )
		// float extraction
		weblas.gpu.gl.encode( M, N, this.texture, out )
		result = new Float32Array( weblas.gpu.gl.readData( M, N ) )
		
		// clean up
		weblas.gpu.gl.context.deleteTexture(out)
	} else {
		// direct read floats, functions deal with adjusting ouput texture format/shape
		out = gl.setupTexture( M, N, null, true, gl.context.RGBA, gl.context.FLOAT )
		gl.read( M, N, this, out )
		result = gl.readFloat( M, N, true )
		
		// clean up
		gl.context.deleteTexture(out)
	}

	if ( !keep ) {
		this.delete()
	}

	return result
}

Tensor.prototype.transpose = function( keep ) {
	var gl = this.gl
	
	var M = this.shape[0],
		N = this.shape[1]

	// create new texture to hold tranpose
	var tT
	
	if ( this.packed ) {
		tT = new weblas.pipeline.Tensor( [N, M], null )
		gl.transpose_packed( M, N, this.texture, tT.texture )
	} else {
		tT = new weblas.unpacked.Tensor( [N, M], null )
		gl.transpose( M, N, this, tT )
	}

	if ( !keep ) {
		this.delete()
	}

	return tT
}

/*	Facility to convert in-GPU unpacked textures to packed
 */
Tensor.prototype.pack = function() {
	var gl = this.gl
	
	if ( this.packed ) {
		console.warn('pack(): Tensor is already packed to an RGBA texture.')
		return
	}

	var M = this.shape[0],
		N = this.shape[1],
		out
	
	// create output texture	
	out = gl.setupTexture( M, N, null, true, gl.context.RGBA, gl.context.FLOAT )
	// invoke shader
	gl.pack( M, N, this, out )
	// clean up
	gl.context.deleteTexture( this.texture )

	this.packed = true
	//this.format = gl.context.RGBA
	this.channel = null
	this.texture = out
}

/*	Facility to convert in-GPU packed textures to unpacked
	optionaly receives a slot selection - 0 by default
 */
Tensor.prototype.unpack = function( slot ) {
	var gl = this.gl
	
	if ( !this.packed ) {
		console.warn('unpack(): Tensor is already unpacked to an RGBA texture.')
		return
	}

	var M = this.shape[0],
		N = this.shape[1],
		out
	
	this.channel = typeof slot == 'undefined' ? 0 : slot

	// create output texture
	out = gl.setupTexture( M, N, null, false, gl.context.RGBA, gl.context.FLOAT )
	// invoke shader
	gl.unpack( M, N, this, out )
	// clean up
	gl.context.deleteTexture( this.texture )
	
	this.packed = false
	//this.format = gl.context.RGBA
	this.texture = out
}

/*	Facility akin to transfer() for unpacked textures
	optionally allows to output as unpacked texture
	defaults to packed type as that is what we usually need on the CPU side
 */
Tensor.prototype.download = function( keep, unpacked ) {
	var gl = this.gl
	
	if ( this.packed ) {
		console.info('download(): Packed texture - using transfer()')
		return this.transfer( keep )
	}
	if ( !gl.context.isTexture( this.texture ) )
		throw new Error('download(): Texture is void.')

	var M = this.shape[0],
		N = this.shape[1],
		out,
		result
	
	var packed = typeof unpacked == 'undefined' ? true : !unpacked
	
	// create output texture	
	out = gl.setupTexture( M, N, null, packed, gl.context.RGBA, gl.context.FLOAT )
	// invoke shader
	gl.render( M, N, this, out, packed )
	result = gl.readFloat( M, N, packed )
	
	// clean up
	gl.context.deleteTexture( out )
	
	if ( !keep ){
		this.delete()
	}
	return result
}

/*	Facility to clone textures, for in-GPU staged computations
	a logical duplication is insuficient since data may be updated
	and pre-update values required (ie. self addition a += b)
 */
Tensor.prototype.duplicate = function() {
	var gl = this.gl
	
	var M = this.shape[0],
		N = this.shape[1]

	// create new tensor to hold duplicate
	var clone

	if ( this.requires_encode ) {
		var duplicate = this.transfer( true )
		clone = new weblas.pipeline.Tensor( this.shape, duplicate )
	} else {
		if ( this.packed ) {
			console.warn('duplicate(): Packed texture - duplicate not yet supported.')
			// Fixme: using textures in different gl.contexts
			//clone = new weblas.unpacked.Tensor( this.shape, null, 'RGBA', 'UNSIGNED_BYTE' )
			//gl.duplicate( M, N, this, clone, false )
			
			clone = new weblas.pipeline.Tensor( this.shape, new Float32Array( M * N ) )
			weblas.gpu.gl.duplicate( M, N, this, clone, true )
		} else {
			clone = new weblas.unpacked.Tensor( this.shape, null )
			gl.duplicate( M, N, this, clone, false )
		}
	}
	return clone
}
Tensor.prototype.mixin = function ( red, green, blue, alpha ) {
	//var gl = this.gl
	
	//var old_texture = this.texture
	
	var mix = mixin.apply( this, red, green, blue, alpha )
	this.mixed = mix.mixed
	this.texture = mix.texture
	
	this.THREE.image.webgltexture = mix.texture
	this.THREE.needsUpdate = true
	
	// delete
	//gl.context.deleteTexture( old_texture )
}

function selfout( tensors, self ) {
	var include = []
	for ( var t in tensors ) {
		if ( tensors[ t ] != self ) include.push( tensors[ t ] )
	}
	return include
}
/*	Facility to combine Tensors together
 */
function mixin( red, green, blue, alpha ) {
	// first non null tensor defines shape
	var tensors = []
	var mtensors = []
	for ( var t in arguments ) {		
		if ( arguments[t] instanceof weblas.unpacked.Tensor ) {
			tensors.push( arguments[t] )
			mtensors.push( arguments[t] )
		}
	}

	if ( tensors.length > 0 ) {
		for ( var t in tensors ) {		
			if ( tensors[t].shape[0] != tensors[0].shape[0] ||
				 tensors[t].shape[1] != tensors[0].shape[1] )
				throw new Error('mixin(): Tensors must have same shape.')
		}
	}

	var M = tensors[0].shape[0],
		N = tensors[0].shape[1]

	var mix = new weblas.unpacked.Tensor( tensors[0].shape, null )

	var gl = tensors[0].gl // must fetch gl from first tensor, we're out of scope

	gl.mixin( M, N, red, green, blue, alpha, mix )

	// mtensors.push( mix )

	// some memory management before updating tensors
	for ( var t in arguments ) {
		var tensor = arguments[ t ]
		if ( tensor != null ) {
			// delete original texture if not shared anymore
			if ( tensor.mixed.length == 0 ) {
				//gl.context.deleteTexture( tensor.texture )
			} else {
				// just remove itself from other Tensor's mixed with references
				for ( var tt in tensor.mixed ) {
					tensor.mixed[ tt ].mixed = selfout( tensor.mixed[ tt ].mixed, tensor )
				}
			}
		}
	}

	// final updates - should this really be done in stages?
	// 				 - playing safe, textures might stay around, worse... unreferenced
	for ( var t in arguments ) {
		var tensor = arguments[ t ]
		if ( tensor != null ) {
			// update Tensor reference to new texture
			tensor.texture = mix.texture
			// update Tensor reference to new slot
			tensor.channel = Number( t )
			// update Tensors mixed with ( including the mixer tensor (or not) )
			tensor.mixed = selfout( mtensors, tensor )
		}
	}

	mix.mixed = tensors

	//console.log( tensors )

	return mix
}
module.exports.mixin = mixin