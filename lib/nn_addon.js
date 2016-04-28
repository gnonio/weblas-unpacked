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
var gl = weblas.gpu.gl

//var WebGL	= require('../node_modules/weblas/lib/webgl')
var WebGL = weblas.gpu.gl.__proto__.constructor


//	ReLU

//	Shader
var relu_glsl		 	= glslify('./glsl/nn/relu.glsl')
	gl.relu_program	= gl.createProgram( relu_glsl )

//	WebGL
function relu_gl( M, N, tensorA, result ) {
	this.program = this.relu_program
	this.selectProgram( this.program )

	var W = N // cols
	var H = M // rows

	this.bindInputTexture( tensorA.texture, this.context.TEXTURE0, 'A' )
	this.bindUniform( 'uniform1i', tensorA.texture_slot, 'A_channel' )
	
	this.bindUniform( 'uniform1i', result.texture_slot, 'write_channel' )

	this.bindOutputTexture( H, W, result.texture )

	this.context.drawElements( this.context.TRIANGLES, /*num items*/6, this.context.UNSIGNED_SHORT, 0 )

	this.unbindInputTexture( this.context.TEXTURE0 )
}
WebGL.prototype.relu = relu_gl

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
var append_bias_glsl		 	= glslify('./glsl/nn/append_bias.glsl')
	gl.append_bias_program	= gl.createProgram( append_bias_glsl )

//	WebGL
function append_bias_gl( M, N, tensorA, result ) {
	this.program = this.append_bias_program
	this.selectProgram( this.program )

	var W = N // cols
	var H = M // rows
	
	// number of columns
	this.bindUniform( 'uniform1f', W, 'cols' )
	this.bindUniform( 'uniform1f', (1 / W) * 0.5, 'col_hstep' )
	// number of rows
	this.bindUniform( 'uniform1f', H, 'rows')
	this.bindUniform( 'uniform1f', (1 / H) * 0.5, 'row_hstep' )

	this.bindInputTexture( tensorA.texture, this.context.TEXTURE0, 'A' )
	this.bindUniform( 'uniform1i', tensorA.texture_slot, 'A_channel' )
	
	this.bindUniform( 'uniform1f', W - 1, 'A_cols' )
	this.bindUniform( 'uniform1f', ( 1 / (W - 1) ) * 0.5, 'A_col_hstep' )
	
	this.bindUniform( 'uniform1i', result.texture_slot, 'write_channel' )

	this.bindOutputTexture( H, W, result.texture )

	this.context.drawElements( this.context.TRIANGLES, /*num items*/6, this.context.UNSIGNED_SHORT, 0 )

	this.unbindInputTexture( this.context.TEXTURE0 )
}
WebGL.prototype.append_bias = append_bias_gl

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