/*
Copyright (c) 2016 Pedro Soares

blas_addon.js

	RGBA unpacked type
	blas computation for unpacked type
	
	SGEMM - http://www.netlib.org/blas/#_level_3

*/

var glslify	 = require('glslify')

/*var globals	 = require('./globals')

var gl = globals.gl*/
var weblas = require('weblas')
var gl = weblas.gpu.gl

//	Shader
var sgemm_glsl		 	= glslify('./glsl/blas/sgemm.glsl')
	gl.sgemm_program	= gl.createProgram( sgemm_glsl )

//	WebGL
function sgemm_gl( M, N, tensorA, tensorB, tensorC, result ) {
	this.program = this.sgemm_program
	this.selectProgram( this.program )

	var W = N // cols
	var H = M // rows
	var K = tensorA.shape[1]
	
	this.bindUniform( 'uniform1i', K, 'K' )
	this.bindUniform( 'uniform1f', (1 / K), 'K_step' )
	this.bindUniform( 'uniform1f', (1 / K) * 0.5, 'K_hstep' )

	this.bindInputTexture( tensorA.texture, this.context.TEXTURE0, 'A' )
	this.bindUniform( 'uniform1i', tensorA.texture_slot, 'A_channel' )
	
	this.bindInputTexture( tensorB.texture, this.context.TEXTURE1, 'B' )
	this.bindUniform( 'uniform1i', tensorB.texture_slot, 'B_channel' )
	
	this.bindUniform( 'uniform1i', 1, 'CSUM' )
	this.bindInputTexture( tensorC.texture, this.context.TEXTURE2, 'C' )
	this.bindUniform( 'uniform1i', tensorC.texture_slot, 'C_channel' )
	
	this.bindUniform( 'uniform1i', result.texture_slot, 'write_channel' )

	var out = result.texture
	this.bindOutputTexture( H, W, out )

	this.context.drawElements( this.context.TRIANGLES, /*num items*/6, this.context.UNSIGNED_SHORT, 0 )

	this.unbindInputTexture( this.context.TEXTURE0 )
}

//var WebGL	= require('../node_modules/weblas/lib/webgl')
var WebGL = weblas.gpu.gl.__proto__.constructor
WebGL.prototype.sgemm = sgemm_gl

//	Tensor
function sgemm_fnc( A, B, C_ ) {
	if ( A.packed ) throw new Error('multiply(): Only unpacked textures supported.')
		
	var AM = A.shape[0], // 3 = rows = M = H
		AN = A.shape[1], // 2 = cols = N = W
		BM = B.shape[0],	// 2 = rows = M = H
		BN = B.shape[1]		// 4 = cols = N = W

	if ( AN != BM ) throw new Error('multiply(): A / B incompatible dimensions (' + AN + ' != ' + BM + ')' )
		
	var C = typeof C_ == 'undefined' || C_ == null ? new weblas.unpacked.Tensor( [AM, BN], null ) : C_
		
	// create new tensor to hold result
	var product = new weblas.unpacked.Tensor( [AM, BN], null )
	
	// invoke shader
	gl.sgemm( AM, BN, A, B, C, product )

	return product
}
module.exports.sgemm = sgemm_fnc