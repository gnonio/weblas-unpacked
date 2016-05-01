/*
Copyright (c) 2016 Pedro Soares

tensor_addin.js

	RGBA unpacked type
	weblas webgl support for unpacked type

*/

var weblas = require('weblas'),
	Tensor_unpacked	 = require('./tensor_unpacked')
	
var gl = weblas.gpu.gl

// PACKED
/*
	original weblas tensor class update to cleanly coexist with unpacked type

	we can't update the constructor so we postinit some helper properties
	once we run one of the overriden or appended functions

	this is still cumbersome
	
*/
//var Tensor	 = require('../node_modules/weblas/lib/tensor')

// constructor pseudo-patching
var Tensor = weblas.pipeline.Tensor

// Level out packed and unpacked types properties
Tensor.prototype.postinit = function() {
	if ( this.packed == null ) {
		this.requires_padding = this.shape[1] % gl.constructor.COMPONENTS_PER_TEXEL != 0	
		this.requires_encode = this.requires_encode || !gl.hasFloat
		this.packed = true
	}
}
// Prototype overrides
Tensor.prototype.delete = function() {
	this.postinit()
	return Tensor_unpacked.prototype.delete.call( this )
}
Tensor.prototype.transfer = function( keep ) {
	this.postinit()
	return Tensor_unpacked.prototype.transfer.call( this, keep )
}
Tensor.prototype.transpose = function( keep ) {
	this.postinit()
	return Tensor_unpacked.prototype.transpose.call( this, keep )
}

// Crosschange
Tensor.prototype.pack = function() {
	this.postinit()
	return Tensor_unpacked.prototype.pack.call( this )
}
Tensor.prototype.unpack = function( slot ) {
	this.postinit()
	return Tensor_unpacked.prototype.unpack.call( this, slot )
}
Tensor.prototype.download = function( keep, unpacked ) {
	this.postinit()
	return Tensor_unpacked.prototype.download.call( this, keep, unpacked )
}
Tensor.prototype.duplicate = function() {
	this.postinit()
	return Tensor_unpacked.prototype.duplicate.call( this )
}