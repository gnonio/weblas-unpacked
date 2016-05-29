/*
Copyright (c) 2016 Pedro Soares

weblas-unpacked.js

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

//var weblas = require('./node_modules/weblas/index.js')
var weblas = require('weblas')

// Unpacked additions
var	tensor_unpacked = require('./lib/tensor_unpacked')

var	webgl_addin		= require('./lib/webgl_addin'),
	tensor_addin	= require('./lib/tensor_addin')

// Compute additions
var	blas_addon		= require('./lib/blas_addon'),
	nn_addon		= require('./lib/nn_addon')

// export within weblas
weblas.unpacked = {
	'Tensor'	: tensor_unpacked,
	'mixin'		: tensor_unpacked.mixin,
	'blas'		: blas_addon,
	'nn'		: nn_addon
}

// standalone export
module.exports = {
	'Tensor'	: tensor_unpacked,
	'mixin'		: tensor_unpacked.mixin,
	'blas'		: blas_addon,
	'nn'		: nn_addon
}
