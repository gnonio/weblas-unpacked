/*
Copyright (c) 2016 Pedro Soares

blas_addon.js

	RGBA unpacked type
	blas computation for unpacked type
	
	SGEMM - http://www.netlib.org/blas/#_level_3

*/

var glslify	 = require('glslify')

var weblas = require('weblas')
var gl

var HOST
try {
	HOST = weblas.gpu.gl.__proto__.constructor
	gl = weblas.gpu.gl
} catch ( error ) { console.info( 'blas_addon', error ) }

try {
	HOST = TCompute
	gl = window.tcompute
} catch ( error ) { console.info( 'blas_addon', error ) }

//	Shader
gl.addProgram( 'sgemm', glslify('./glsl/blas/sgemm.glsl') )
gl.addProgram( 'sgemm_c', glslify('./glsl/blas/sgemm_c.glsl') )

//	WebGL
function sgemm_gl( M, N, alpha, tensorA, tensorB, beta, tensorC, result ) {
	var output = { width: N, height: M, texture: result.texture }
	
	var uniforms = {}
	
	var K = tensorA.shape[1]

	uniforms = {
		K: 				{ type: 'uniform1i', value: K },
		K_step: 		{ type: 'uniform1f', value: (1 / K) },
		K_hstep: 		{ type: 'uniform1f', value: (1 / K) * 0.5 },

		alpha: 			{ type: 'uniform1f', value: alpha },

		write_channel: 	{ type: 'uniform1i', value: result.channel }
	}

	var textures = {}	
	textures.A = tensorA
	textures.B = tensorB
	
	if ( tensorC != null ) {
		uniforms.beta = { type: 'uniform1f', value: beta }
		
		textures.C = tensorC
	}

	var program = tensorC == null ? this.programs.sgemm : this.programs.sgemm_c
	
	var buffers = this.buffers.framequad
	
	this.renderPass( output, program, buffers, uniforms, textures )
}
HOST.prototype.sgemm = sgemm_gl

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

//	Shader
gl.addProgram( 'sscal', glslify('./glsl/blas/sscal.glsl') )

//	WebGL
function sscal_gl( M, N, alpha, tensorX, result ) {
	var output = { width: N, height: M, texture: result.texture }
	
	var uniforms = {}	
	uniforms.alpha = 			{ type: 'uniform1f', value: alpha }
	uniforms.write_channel = 	{ type: 'uniform1i', value: result.channel }

	var textures = {}	
	textures.X = tensorX	

	var program = this.programs.sscal
	
	var buffers = this.buffers.framequad
	
	this.renderPass( output, program, buffers, uniforms, textures )
}
HOST.prototype.sscal = sscal_gl

//	Tensor
function sscal_fnc() {
	var args = sscal_args( arguments )
	
	var M = args[0], N = args[1], alpha = args[2], X = args[3]

	if ( X.packed ) throw new Error('sscal(): Only unpacked textures supported.')
	
	// create new tensor to hold result
	var result = new weblas.unpacked.Tensor( [M, N], null )

	// invoke shader
	gl.sscal( M, N, alpha, X, result )

	return result
}
module.exports.sscal = sscal_fnc

function sscal_args() {
	var args = arguments[0]
	var M, N, alpha, X
	switch( args.length ) {
		case 2: // alpha, X
			M = args[1].shape[0], N = args[1].shape[1]
			alpha = args[0], X = args[1]
		break
		default:
			throw new Error('sscal(): unexpected arguments.' )
		break
	}
	return [M, N, alpha, X]
}