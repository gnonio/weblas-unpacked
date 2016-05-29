/*
Copyright (c) 2016 Pedro Soares

nn_addon.js

	RGBA unpacked type
	Neural Network computations
	
	ReLU
	Append bias column

*/

var glslify	 = require('glslify')

var weblas = require('weblas')
var gl

var HOST
try {
	HOST = weblas.gpu.gl.__proto__.constructor
	gl = weblas.gpu.gl
} catch ( error ) { console.info( 'nn_addon', error ) }

try {
	HOST = TCompute
	gl = window.tcompute
} catch ( error ) { console.info( 'nn_addon', error ) }

//	ReLU
//	Shader	
gl.addProgram( 'relu', glslify('./glsl/nn/relu.glsl') )

//	WebGL
function relu_gl( M, N, tensorA, result ) {
	var gl = this.context
	
	this.program = this.programs.relu	
	gl.useProgram( this.program )
	
	this.bindBuffers( this.buffers.framequad )

	var W = N // cols
	var H = M // rows

	this.bindTexture( tensorA.texture, 0, 'A' )
	this.bindUniform( 'uniform1i', tensorA.channel, 'A_channel' )
	
	this.bindUniform( 'uniform1i', result.channel, 'write_channel' )

	this.bindFramebuffer( H, W, result.texture )

	gl.drawElements( this.context.TRIANGLES, 6, this.context.UNSIGNED_SHORT, 0 )

	this.unbindTexture( this.context.TEXTURE0 )
	
	// handoff context
	this.state.resetGL()
}
HOST.prototype.relu = relu_gl

//	Tensor
function relu_fnc( A ) {
	if ( A.packed ) throw new Error('relu(): Only unpacked textures supported.')
		
	var M = A.shape[0],
		N = A.shape[1]
		
	// create new tensor to hold result
	var relu = new weblas.unpacked.Tensor( [M, N], null )
	
	// invoke shader
	gl.relu( M, N, A, relu )

	return relu
}
module.exports.relu = relu_fnc

//	Append bias column
//	might be useful to generalize this further (ie. scale bias, or arbitrary value)
//	Shader	
gl.addProgram( 'append_bias', glslify('./glsl/nn/append_bias.glsl') )

//	WebGL
function append_bias_gl( M, N, tensorA, result ) {
	var gl = this.context

	this.program = this.programs.append_bias	
	gl.useProgram( this.program )

	this.bindBuffers( this.buffers.framequad )

	var W = N // cols
	var H = M // rows

	// number of columns
	this.bindUniform( 'uniform1f', W, 'cols' )
	this.bindUniform( 'uniform1f', (1 / W) * 0.5, 'col_hstep' )
	// number of rows
	this.bindUniform( 'uniform1f', H, 'rows')
	this.bindUniform( 'uniform1f', (1 / H) * 0.5, 'row_hstep' )

	this.bindTexture( tensorA.texture, 0, 'A' )
	this.bindUniform( 'uniform1i', tensorA.channel, 'A_channel' )

	this.bindUniform( 'uniform1f', W - 1, 'A_cols' )
	this.bindUniform( 'uniform1f', ( 1 / (W - 1) ) * 0.5, 'A_col_hstep' )

	this.bindUniform( 'uniform1i', result.channel, 'write_channel' )

	this.bindFramebuffer( H, W, result.texture )

	this.context.drawElements( this.context.TRIANGLES, 6, this.context.UNSIGNED_SHORT, 0 )

	this.unbindTexture( 0 )

	// handoff context
	this.state.resetGL()
}
HOST.prototype.append_bias = append_bias_gl

//	Tensor
function append_bias_fnc( A ) {
	if ( A.packed ) throw new Error('append_bias(): Only unpacked textures supported.')
		
	var M = A.shape[0],
		N = A.shape[1],
		BiasN = N + 1
		
	// create new tensor to hold result
	var bias = new weblas.unpacked.Tensor( [M, BiasN], null )
	
	// invoke shader
	gl.append_bias( M, BiasN, A, bias )

	return bias
}
module.exports.append_bias = append_bias_fnc