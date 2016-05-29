/*
Copyright (c) 2016 Pedro Soares

tensor_addin.js

	RGBA unpacked type
	weblas webgl support for unpacked type

*/

var weblas = require('weblas'),
	Tensor_unpacked	 = require('./tensor_unpacked')
	
var gl, float_support

var HOST
try {
	HOST = weblas.gpu.gl.__proto__.constructor
	gl = weblas.gpu.gl
	float_support = gl.hasFloat
} catch ( error ) { console.info( 'tensor_addin', error ) }

try {
	HOST = TCompute
	gl = window.tcompute
	float_support = gl.float_support
} catch ( error ) { console.info( 'tensor_addin', error ) }

// PACKED
/*
	original weblas tensor class update to cleanly coexist with unpacked type

	we can't update the constructor so we postinit some helper properties
	once we run one of the overriden or appended functions

	this is still cumbersome
	
*/

// constructor pseudo-patching
var Tensor = weblas.pipeline.Tensor

// Level out packed and unpacked types properties
Tensor.prototype.postinit = function() {
	if ( this.packed == null ) {
		this.gl = gl
		this.requires_padding = this.shape[1] % 4 != 0
		this.requires_encode = !float_support
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