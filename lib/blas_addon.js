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
var sgemm_glsl		 	= glslify('./glsl/blas/sgemm.glsl'),
	sgemm_c_glsl		= glslify('./glsl/blas/sgemm_c.glsl')
	
	gl.sgemm_program	= gl.createProgram( sgemm_glsl )
	gl.sgemm_c_program	= gl.createProgram( sgemm_c_glsl )

//	WebGL
function sgemm_gl( M, N, alpha, tensorA, tensorB, beta, tensorC, result ) {
	this.program = tensorC == null ? this.sgemm_program : this.sgemm_c_program
	this.selectProgram( this.program )

	var W = N // cols
	var H = M // rows
	var K = tensorA.shape[1]
	
	this.bindUniform( 'uniform1i', K, 'K' )
	this.bindUniform( 'uniform1f', (1 / K), 'K_step' )
	this.bindUniform( 'uniform1f', (1 / K) * 0.5, 'K_hstep' )

	this.bindUniform( 'uniform1f', alpha, 'alpha' )
	
	this.bindInputTexture( tensorA.texture, this.context.TEXTURE0, 'A' )
	this.bindUniform( 'uniform1i', tensorA.texture_slot, 'A_channel' )
	
	this.bindInputTexture( tensorB.texture, this.context.TEXTURE1, 'B' )
	this.bindUniform( 'uniform1i', tensorB.texture_slot, 'B_channel' )
	
	if ( tensorC != null ) {
		this.bindUniform( 'uniform1f', beta, 'beta' )
		this.bindInputTexture( tensorC.texture, this.context.TEXTURE2, 'C' )
		this.bindUniform( 'uniform1i', tensorC.texture_slot, 'C_channel' )
	}
		
	this.bindUniform( 'uniform1i', result.texture_slot, 'write_channel' )

	var out = result.texture
	this.bindOutputTexture( H, W, out )

	this.context.drawElements( this.context.TRIANGLES, /*num items*/6, this.context.UNSIGNED_SHORT, 0 )

	this.unbindInputTexture( this.context.TEXTURE0 )
	this.unbindInputTexture( this.context.TEXTURE1 )
	
	if ( tensorC != null ) {
		this.unbindInputTexture( this.context.TEXTURE2 )
	}
}

//var WebGL	= require('../node_modules/weblas/lib/webgl')
var WebGL = weblas.gpu.gl.__proto__.constructor
WebGL.prototype.sgemm = sgemm_gl

//	Tensor
function sgemm_fnc() {
	var args = sgemm_args( arguments )
	//var [M, N, alpha, A, B, beta, C] = sgemm_args( arguments ) // this will be fun
	var M = args[0], N = args[1]
	var alpha = args[2], A = args[3], B = args[4]
	var beta = args[5] , C = args[6]

	if ( A.packed || B.packed ) throw new Error('sgemm(): Only unpacked textures supported.')
	if ( C != null ) { if ( C.packed ) throw new Error('sgemm(): Only unpacked textures supported.') }
	
	var AM = A.shape[0], // 3 = rows = M = H
		AN = A.shape[1], // 2 = cols = N = W
		BM = B.shape[0], // 2 = rows = M = H
		BN = B.shape[1]	 // 4 = cols = N = W
	
	if ( AN != BM ) throw new Error('sgemm(): A / B incompatible dimensions (' + AN + ' != ' + BM + ')' )
	
	// create new tensor to hold result
	var product = new weblas.unpacked.Tensor( [AM, BN], null )

	// invoke shader
	gl.sgemm( AM, BN, alpha, A, B, beta, C, product )

	return product
}
module.exports.sgemm = sgemm_fnc

function sgemm_args() {
	var args = arguments[0]
	var M, N, alpha, A, B, beta, C
	switch( args.length ) {
		case 2: // A, B
			alpha = 1, A = args[0], B = args[1], beta = 1
			M = A.shape[0], N = B.shape[1]
			C = null
		break
		case 3:
			if ( typeof args[0] == 'number' ) { // alpha, A, B
				alpha = args[0], A = args[1], B = args[2], beta = 1
				M = A.shape[0], N = B.shape[1]
				C = null
			} else { // A, B, C
				alpha = 1, A = args[0], B = args[1], beta = 1
				M = A.shape[0], N = B.shape[1]
				C = args[2]
			}
		break
		case 4:
			if ( typeof args[0] == 'number' ) { // alpha, A, B, C
				alpha = args[0], A = args[1], B = args[2], beta = 1
				M = A.shape[0], N = B.shape[1]
				C = args[3]
			} else { // A, B, beta, C
				alpha = 1, A = args[0], B = args[1], beta = args[2]
				M = A.shape[0], N = B.shape[1]
				C = args[3]
			}
		break
		case 5: // alpha, A, B, beta, C
			alpha = args[0], A = args[1], B = args[2], beta = args[3]
			M = A.shape[0], N = B.shape[1]
			C = args[4]
		break
		default:
			throw new Error('sgemm(): unexpected arguments.' )
		break
	}
	return [M, N, alpha, A, B, beta, C]
}