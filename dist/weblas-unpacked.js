(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.weblas_unpacked = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
/*
Copyright (c) 2016 Pedro Soares

blas_addon.js

	RGBA unpacked type
	blas computation for unpacked type
	
	SGEMM - http://www.netlib.org/blas/#_level_3

*/



var weblas = (typeof window !== "undefined" ? window['weblas'] : typeof global !== "undefined" ? global['weblas'] : null)
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
gl.addProgram( 'sgemm', "// DOTPRODUCT UNPACKED\r\nprecision highp float;\n\nprecision highp int;\n#define GLSLIFY 1\n\nvarying vec2      \tUVs;\t\t\t// texture coords of row/column to calculate\r\n\nuniform int\t\t\tK;\t\t\t\t// \r\nuniform float\t\tK_step;\t\t\t// \r\nuniform float\t\tK_hstep;\t\t// \r\n\nuniform float\t\talpha;\t\t\t// \r\n\nuniform sampler2D \tA;\t\t\t\t// texture with data A\r\nuniform int\t\t\tA_channel;\t\t// channel to read data from\r\n\nuniform sampler2D \tB;\t\t\t\t// texture with data B\r\nuniform int\t\t\tB_channel;\t\t// channel to read data from\r\n\nuniform int\t\t\twrite_channel;\t// channel to write data to\r\n\nfloat get_channel_value_1540259130( sampler2D texture, int channel, vec2 xy ) {\n\n\tfloat value = 0.0;\n\n\tif ( channel == 0 ) {\n\n\t\tvalue = texture2D( texture, xy ).r;\n\n\t} else if ( channel == 1 ) {\n\n\t\tvalue = texture2D( texture, xy ).g;\n\n\t} else if ( channel == 2 ) {\n\n\t\tvalue = texture2D( texture, xy ).b;\n\n\t} else if ( channel == 3 ) {\n\n\t\tvalue = texture2D( texture, xy ).a;\n\n\t}\t\n\n\treturn value;\n\n}\n\nvec4 set_channel_value_1604150559( int channel, float value ) {\t\n\n\tif ( channel == 0 ) {\n\n\t\treturn vec4( value, 0.0, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 1 ) {\n\n\t\treturn vec4( 0.0, value, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 2 ) {\n\n\t\treturn vec4( 0.0, 0.0, value, 0.0 );\n\n\t}\n\n\tif ( channel == 3 ) {\n\n\t\treturn vec4( 0.0, 0.0, 0.0, value );\n\n\t}\t\n\n\treturn vec4( 0.0, 0.0, 0.0, 0.0 );\t// should not happen\r\n}\n\nvoid main( void ) {\n\n\tfloat row_t = UVs.y;\n\n\tfloat col_t = UVs.x;\n\n\t\n\n\tfloat hstep = K_hstep;// position for shared dimension on source textures\r\n\tfloat sum = 0.0;\n\n\tfor ( int l = 0 ; l < 4096 ; ++l ) {\n\n\t\tif ( l >= K ) break;    // stop when we finish the row/column\r\n\t\t// l is in pixel space, so we divide by four\r\n\n\t\t// read value from each texture\r\n\t\tfloat a_ik = get_channel_value_1540259130( A, A_channel, vec2( hstep, row_t ) );\n\n\t\tfloat b_kj = get_channel_value_1540259130( B, B_channel, vec2( col_t, hstep ) );\n\n\t\tsum += a_ik * b_kj;\n\n\t\thstep += K_step;\n\n\t}\n\n\tgl_FragColor = set_channel_value_1604150559( write_channel, alpha * sum );\n\n}" )
gl.addProgram( 'sgemm_c', "// DOTPRODUCT UNPACKED\r\nprecision highp float;\n\nprecision highp int;\n#define GLSLIFY 1\n\nvarying vec2      \tUVs;\t\t\t// texture coords of row/column to calculate\r\n\nuniform int\t\t\tK;\t\t\t\t// \r\nuniform float\t\tK_step;\t\t\t// \r\nuniform float\t\tK_hstep;\t\t// \r\n\nuniform float\t\talpha;\t\t\t// \r\n\nuniform sampler2D \tA;\t\t\t\t// texture with data A\r\nuniform int\t\t\tA_channel;\t\t// channel to read data from\r\n\nuniform sampler2D \tB;\t\t\t\t// texture with data B\r\nuniform int\t\t\tB_channel;\t\t// channel to read data from\r\n\nuniform float\t\tbeta;\t\t\t// \r\n\nuniform sampler2D \tC;\t\t\t\t// texture with data B\r\nuniform int\t\t\tC_channel;\t\t// channel to read data from\r\n\nuniform int\t\t\twrite_channel;\t// channel to write data to\r\n\nfloat get_channel_value_1540259130( sampler2D texture, int channel, vec2 xy ) {\n\n\tfloat value = 0.0;\n\n\tif ( channel == 0 ) {\n\n\t\tvalue = texture2D( texture, xy ).r;\n\n\t} else if ( channel == 1 ) {\n\n\t\tvalue = texture2D( texture, xy ).g;\n\n\t} else if ( channel == 2 ) {\n\n\t\tvalue = texture2D( texture, xy ).b;\n\n\t} else if ( channel == 3 ) {\n\n\t\tvalue = texture2D( texture, xy ).a;\n\n\t}\t\n\n\treturn value;\n\n}\n\nvec4 set_channel_value_1604150559( int channel, float value ) {\t\n\n\tif ( channel == 0 ) {\n\n\t\treturn vec4( value, 0.0, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 1 ) {\n\n\t\treturn vec4( 0.0, value, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 2 ) {\n\n\t\treturn vec4( 0.0, 0.0, value, 0.0 );\n\n\t}\n\n\tif ( channel == 3 ) {\n\n\t\treturn vec4( 0.0, 0.0, 0.0, value );\n\n\t}\t\n\n\treturn vec4( 0.0, 0.0, 0.0, 0.0 );\t// should not happen\r\n}\n\nvoid main( void ) {\n\n\tfloat row_t = UVs.y;\n\n\tfloat col_t = UVs.x;\n\n\tfloat c = beta * get_channel_value_1540259130( C, C_channel, UVs );\n\n\t\n\n\tfloat hstep = K_hstep;// position for shared dimension on source textures\r\n\tfloat sum = 0.0;\n\n\tfor ( int l = 0 ; l < 4096 ; ++l ) {\n\n\t\tif ( l >= K ) break;    // stop when we finish the row/column\r\n\t\t// l is in pixel space, so we divide by four\r\n\n\t\t// read value from each texture\r\n\t\tfloat a_ik = get_channel_value_1540259130( A, A_channel, vec2( hstep, row_t ) );\n\n\t\tfloat b_kj = get_channel_value_1540259130( B, B_channel, vec2( col_t, hstep ) );\n\n\t\tsum += a_ik * b_kj;\n\n\t\thstep += K_step;\n\n\t}\n\n\tgl_FragColor = set_channel_value_1604150559( write_channel, alpha * sum + c );\n\n}" )

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
gl.addProgram( 'sscal', "// SSCAL UNPACKED\r\nprecision highp float;\n\nprecision highp int;\n#define GLSLIFY 1\n\nvarying vec2      \tUVs;\t\t\t// texture coords of row/column to calculate\r\n\nuniform float\t\talpha;\t\t\t// scalar\r\n\nuniform sampler2D \tX;\t\t\t\t// texture with data X\r\nuniform int\t\t\tX_channel;\t\t// channel to read data from\r\n\nuniform int\t\t\twrite_channel;\t// channel to write data to\r\n\nfloat get_channel_value_1540259130( sampler2D texture, int channel, vec2 xy ) {\n\n\tfloat value = 0.0;\n\n\tif ( channel == 0 ) {\n\n\t\tvalue = texture2D( texture, xy ).r;\n\n\t} else if ( channel == 1 ) {\n\n\t\tvalue = texture2D( texture, xy ).g;\n\n\t} else if ( channel == 2 ) {\n\n\t\tvalue = texture2D( texture, xy ).b;\n\n\t} else if ( channel == 3 ) {\n\n\t\tvalue = texture2D( texture, xy ).a;\n\n\t}\t\n\n\treturn value;\n\n}\n\nvec4 set_channel_value_1604150559( int channel, float value ) {\t\n\n\tif ( channel == 0 ) {\n\n\t\treturn vec4( value, 0.0, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 1 ) {\n\n\t\treturn vec4( 0.0, value, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 2 ) {\n\n\t\treturn vec4( 0.0, 0.0, value, 0.0 );\n\n\t}\n\n\tif ( channel == 3 ) {\n\n\t\treturn vec4( 0.0, 0.0, 0.0, value );\n\n\t}\t\n\n\treturn vec4( 0.0, 0.0, 0.0, 0.0 );\t// should not happen\r\n}\n\nvoid main( void ) {\n\n\t\n\n\tfloat x_value = get_channel_value_1540259130( X, X_channel, UVs );\n\n\tgl_FragColor = set_channel_value_1604150559( write_channel, alpha * x_value );\n\n}" )

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
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],2:[function(require,module,exports){
(function (global){
/*
Copyright (c) 2016 Pedro Soares

nn_addon.js

	RGBA unpacked type
	Neural Network computations
	
	ReLU
	Append bias column

*/



var weblas = (typeof window !== "undefined" ? window['weblas'] : typeof global !== "undefined" ? global['weblas'] : null)
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
gl.addProgram( 'relu', "// RELU UNPACKED\r\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2      \tUVs;\t\t\t// texture coords of row/column to calculate\r\n\nuniform sampler2D \tA;\t\t\t\t// texture with data A\r\nuniform int\t\t\tA_channel;\t\t// channel to read data from\r\n\nuniform int\t\t\twrite_channel;\t// channel to write data to\r\n\nfloat get_channel_value_1540259130( sampler2D texture, int channel, vec2 xy ) {\n\n\tfloat value = 0.0;\n\n\tif ( channel == 0 ) {\n\n\t\tvalue = texture2D( texture, xy ).r;\n\n\t} else if ( channel == 1 ) {\n\n\t\tvalue = texture2D( texture, xy ).g;\n\n\t} else if ( channel == 2 ) {\n\n\t\tvalue = texture2D( texture, xy ).b;\n\n\t} else if ( channel == 3 ) {\n\n\t\tvalue = texture2D( texture, xy ).a;\n\n\t}\t\n\n\treturn value;\n\n}\n\nvec4 set_channel_value_1604150559( int channel, float value ) {\t\n\n\tif ( channel == 0 ) {\n\n\t\treturn vec4( value, 0.0, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 1 ) {\n\n\t\treturn vec4( 0.0, value, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 2 ) {\n\n\t\treturn vec4( 0.0, 0.0, value, 0.0 );\n\n\t}\n\n\tif ( channel == 3 ) {\n\n\t\treturn vec4( 0.0, 0.0, 0.0, value );\n\n\t}\t\n\n\treturn vec4( 0.0, 0.0, 0.0, 0.0 );\t// should not happen\r\n}\n\nvoid main( void ) {\n\n\t// get the implied row and column from .y and .x of passed (output)\r\n\t// texture coordinate. These map directly to input texture space when\r\n\t// the relevant dimensions are the same.\r\n\tfloat row_t = UVs.y;\n\n\tfloat col_t = UVs.x;\n\n\tfloat value = get_channel_value_1540259130( A, A_channel, UVs );\n\n\tfloat relu = max( value, 0.0 );\n\n\tgl_FragColor = set_channel_value_1604150559( write_channel, relu );\n\n}" )

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
gl.addProgram( 'append_bias', "// APPEND BIAS UNPACKED\r\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2      \tUVs;\t\t\t// texture coords of row/column to calculate\r\n\nuniform float\t\tcols;\t\t\t// number of columns\r\nuniform float\t\tcol_hstep;\t\t// half step in texture space\r\nuniform float\t\trows;\t\t\t// number of rows\r\nuniform float\t\trow_hstep;\t\t// half step in texture space\r\n\nuniform sampler2D \tA;\t\t\t\t// texture with data A\r\nuniform int\t\t\tA_channel;\t\t// channel to read data from\r\n\nuniform float\t\tA_cols;\t\t\t// number of columns\r\nuniform float\t\tA_col_hstep;\t// half step in texture space\r\n\nuniform int\t\t\twrite_channel;\t// channel to write data to\r\n\nvec2 get_indices_1540259130( float col_t, float cols, float row_t, float rows ) {\t\n\n\tfloat col_index = floor(col_t * cols);\n\n\tfloat row_index = floor(row_t * rows);\n\n\t\n\n\treturn vec2(col_index, row_index);\n\n}\n\nvec2 get_coords_1604150559( float index, float cols, float cols_hstep, float rows, float row_hstep ) {\n\n\tfloat col_index = mod( index + 0.1, cols );// +0.1 prevents rounding error in next set of ops\r\n\tfloat row_index = floor( (index + 0.1) / cols );\n\n\t\n\n\t//float index = row_index * cols + col_index;\r\n\t\n\n\treturn vec2( col_index / cols + cols_hstep, row_index / rows + row_hstep );\n\n}\n\nfloat get_channel_value_1117569599( sampler2D texture, int channel, vec2 xy ) {\n\n\tfloat value = 0.0;\n\n\tif ( channel == 0 ) {\n\n\t\tvalue = texture2D( texture, xy ).r;\n\n\t} else if ( channel == 1 ) {\n\n\t\tvalue = texture2D( texture, xy ).g;\n\n\t} else if ( channel == 2 ) {\n\n\t\tvalue = texture2D( texture, xy ).b;\n\n\t} else if ( channel == 3 ) {\n\n\t\tvalue = texture2D( texture, xy ).a;\n\n\t}\t\n\n\treturn value;\n\n}\n\nvec4 set_channel_value_2281831123( int channel, float value ) {\t\n\n\tif ( channel == 0 ) {\n\n\t\treturn vec4( value, 0.0, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 1 ) {\n\n\t\treturn vec4( 0.0, value, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 2 ) {\n\n\t\treturn vec4( 0.0, 0.0, value, 0.0 );\n\n\t}\n\n\tif ( channel == 3 ) {\n\n\t\treturn vec4( 0.0, 0.0, 0.0, value );\n\n\t}\t\n\n\treturn vec4( 0.0, 0.0, 0.0, 0.0 );\t// should not happen\r\n}\n\nvoid main( void ) {\n\n\t// get the implied row and column from .y and .x of passed (output)\r\n\t// texture coordinate. These map directly to input texture space when\r\n\t// the relevant dimensions are the same.\r\n\tfloat row_t = UVs.y;\n\n\tfloat col_t = UVs.x;\n\n\t\n\n\tvec2 rowcol = get_indices_1540259130( col_t, cols, row_t, rows );\n\n\t\n\n\tfloat A_col = rowcol.x;\n\n\tfloat A_row = rowcol.y;\n\n\t\n\n\tfloat A_value = 1.0;\n\n\tif ( A_col < A_cols ) {\n\n\t\tfloat A_index = A_row * A_cols + A_col;\n\n\t\t\n\n\t\tvec2 A_st = get_coords_1604150559( A_index, A_cols, A_col_hstep, rows, row_hstep );\n\n\t\tA_value = get_channel_value_1117569599( A, A_channel, A_st );\n\n\t}\n\n\tgl_FragColor = set_channel_value_2281831123( write_channel, A_value );\n\n}" )

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
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],3:[function(require,module,exports){
(function (global){
/*
Copyright (c) 2016 Pedro Soares

tensor_addin.js

	RGBA unpacked type
	weblas webgl support for unpacked type

*/

var weblas = (typeof window !== "undefined" ? window['weblas'] : typeof global !== "undefined" ? global['weblas'] : null),
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
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./tensor_unpacked":4}],4:[function(require,module,exports){
(function (global){
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

var weblas = (typeof window !== "undefined" ? window['weblas'] : typeof global !== "undefined" ? global['weblas'] : null)
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
	
	//gl.renderPass( output, program, mesh, uniforms, textures )
	
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
			console.warn('duplicate(): Packed texture - duplicate not fully supported.')
			// Fixme: if using TCompute we must keep using it's own context
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
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],5:[function(require,module,exports){
(function (global){
/*
Copyright (c) 2016 Pedro Soares

webgl_addin.js

	RGBA unpacked type
	weblas webgl support for unpacked type

*/

var weblas = (typeof window !== "undefined" ? window['weblas'] : typeof global !== "undefined" ? global['weblas'] : null);

var gl = weblas.gpu.gl
var WebGL = weblas.gpu.gl.__proto__.constructor

/*	Basic wraper for some gl methods if THREE not present
	allows sharing of webgl context
 */
function WebGLState( gl ) {
	this.gl = gl // remove
}

gl.state = new WebGLState( gl.context )

WebGLState.prototype.initAttributes = function() {}

WebGLState.prototype.enableAttribute = function( attribute ) {
	this.gl.enableVertexAttribArray( attribute )
}

WebGLState.prototype.disableUnusedAttributes = function() {}
	
WebGLState.prototype.activeTexture = function( unit ) {
	this.gl.activeTexture( unit )
}

WebGLState.prototype.bindTexture = function( textureType, texture ) {
	this.gl.bindTexture( textureType, texture )
}

WebGLState.prototype.texImage2D = function() {
	//target, level, internalformat, width, height, border, format, type, pixels
	this.gl.texImage2D.apply( this.gl, arguments )
}

WebGLState.prototype.viewport = function( viewport ) {
	this.gl.viewport( viewport.x, viewport.y, viewport.z, viewport.w )
}

WebGLState.prototype.resetGL = function() {}

// Buffers
WebGL.prototype.setupBuffers = function() {
	var gl = this.context
	
	this.buffers = {}
	
	var framequad = {}
	
	// Quad Vertices
	var quad_vertices = new Float32Array( [
		-1.0, -1.0, 0.0,	// bottom left
		 1.0, -1.0, 0.0,	// bottom right
		 1.0,  1.0, 0.0,	// top right
		-1.0,  1.0, 0.0		// top left
	] )
	framequad.vertexBuffer = gl.createBuffer()
	gl.bindBuffer( gl.ARRAY_BUFFER, framequad.vertexBuffer )
	gl.bufferData( gl.ARRAY_BUFFER, quad_vertices, gl.STATIC_DRAW )
	
	// Quad UVs
	var quad_uvs = new Float32Array( [
		0.0, 0.0,
		1.0, 0.0,
		1.0, 1.0,
		0.0, 1.0
	] )
	framequad.uvBuffer = gl.createBuffer()
	gl.bindBuffer( gl.ARRAY_BUFFER, framequad.uvBuffer )
	gl.bufferData( gl.ARRAY_BUFFER, quad_uvs, gl.STATIC_DRAW )
	
	// Quad Indices
	var quad_faces = new Uint16Array( [
		0, 1, 2,	// bottom right triangle
		0, 2, 3		// top left triangle
	] )
	framequad.elementBuffer = gl.createBuffer()
	gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, framequad.elementBuffer )
	gl.bufferData( gl.ELEMENT_ARRAY_BUFFER, quad_faces, gl.STATIC_DRAW )
	
	framequad.elements_length = quad_faces.length
	
	this.buffers.framequad = framequad
}
gl.setupBuffers()

// Shaders
WebGL.prototype.setupShader = function( shader_source, type ) {
	var gl = this.context

	// Compile shader
	var shader = gl.createShader( type )
	gl.shaderSource( shader, shader_source )
	gl.compileShader( shader )

	// Check compile
	var shaderInfoLog = gl.getShaderInfoLog( shader )
	
	if ( gl.getShaderParameter( shader, gl.COMPILE_STATUS ) === false ) {
		console.error( 'setupShader(): Shader compile failed.' )
	}
	if ( shaderInfoLog !== '' ) {
		console.warn( 'setupShader(): ', type === gl.VERTEX_SHADER ? 'vertex' : 'fragment' )
		console.warn( 'gl.getShaderInfoLog(): ', shaderInfoLog, addLineNumbers( shader_source ) )
	}
	
	return shader
}

WebGL.prototype.setupProgram = function( vertexShader, fragmentShader ) {
	var gl = this.context

	// Link program
	var program = gl.createProgram()
	gl.attachShader( program, vertexShader )
	gl.attachShader( program, fragmentShader )
	gl.linkProgram( program )
	
	// Check link
	var programInfoLog = gl.getProgramInfoLog( program )
	
	if ( gl.getProgramParameter( program, gl.LINK_STATUS ) === false ) {
		console.error( 'setupProgram(): ', gl.getError() )
		console.error( 'gl.VALIDATE_STATUS: ', gl.getProgramParameter( program, gl.VALIDATE_STATUS ) )
		console.error( 'gl.getProgramInfoLog(): ', programInfoLog )
	}
	if ( programInfoLog !== '' ) {
		console.warn( 'setupProgram(): ' )
		console.warn( 'gl.getProgramInfoLog(): ', programInfoLog )
	}

	return program
}

WebGL.prototype.addProgram = function( name, shader_source ) {
	var gl = this.context

	this.shaders_src[ name ] = shader_source
	
	this.shaders[ name ] = this.setupShader( this.shaders_src[ name ], gl.FRAGMENT_SHADER )
	this.programs[ name ]= this.setupProgram( this.shaders.pass_through, this.shaders[ name ] )
}

WebGL.prototype.setupPrograms = function() {
	var gl = this.context
	
	// Shader list sources
	this.shaders_src = {
		pass_through:		"// Quad pass-through\r\nprecision highp float;\n#define GLSLIFY 1\n\nattribute vec3 position;\n\nattribute vec2 uv;\n\nvarying vec2   UVs;\n\nvoid main( void ) {\n\n\tgl_Position = vec4( position, 1.0 );\n\n\tUVs = uv;\n\n}\n\n",
		
		read_packed:		"// PACKED TO PACKED (UNPADDED)\r\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2      UVs;\t// texture coords of row/column to calculate\r\nuniform sampler2D A;\t\t// texture with data from padded A\r\n\nvoid main( void ) {\t\n\n\tgl_FragColor = texture2D( A, UVs );\n\n}",
		read_packed_padded:	"// PACKED TO PACKED (PADDED)\r\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2\t\tUVs;\t\t\t// texture coords of row/column to calculate\r\n\nuniform float\t\tcols;\t\t\t// number of columns\r\nuniform float\t\tcol_hstep;\t\t// half step in texture space\r\nuniform float\t\trows;\t\t\t// number of rows\r\nuniform float\t\trow_hstep;\t\t// half step in texture space\r\n\nuniform float\t\tup_cols;\t\t// number of unpacked columns\r\nuniform float\t\tup_col_hstep;\t// half step in texture space\r\n\nuniform float\t\tpad;\t\t\t// number of unpacked columns accounting padding\r\nuniform float\t\tup_cols_padded;\t// number of unpacked columns accounting padding\r\n\nuniform sampler2D\tA;\t\t\t\t// texture with data from padded A\r\n\nvec2 get_indices_1540259130( float col_t, float cols, float row_t, float rows ) {\t\n\n\tfloat col_index = floor(col_t * cols);\n\n\tfloat row_index = floor(row_t * rows);\n\n\t\n\n\treturn vec2(col_index, row_index);\n\n}\n\nvec2 get_coords_1604150559( float index, float cols, float cols_hstep, float rows, float row_hstep ) {\n\n\tfloat col_index = mod( index + 0.1, cols );// +0.1 prevents rounding error in next set of ops\r\n\tfloat row_index = floor( (index + 0.1) / cols );\n\n\t\n\n\t//float index = row_index * cols + col_index;\r\n\t\n\n\treturn vec2( col_index / cols + cols_hstep, row_index / rows + row_hstep );\n\n}\n\nfloat get_channel_value_1117569599( sampler2D texture, int channel, vec2 xy ) {\n\n\tfloat value = 0.0;\n\n\tif ( channel == 0 ) {\n\n\t\tvalue = texture2D( texture, xy ).r;\n\n\t} else if ( channel == 1 ) {\n\n\t\tvalue = texture2D( texture, xy ).g;\n\n\t} else if ( channel == 2 ) {\n\n\t\tvalue = texture2D( texture, xy ).b;\n\n\t} else if ( channel == 3 ) {\n\n\t\tvalue = texture2D( texture, xy ).a;\n\n\t}\t\n\n\treturn value;\n\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .t and .s of passed (output) texture coordinate.\r\n\tfloat col_t = UVs.s;\n\n\tfloat row_t = UVs.t;\n\n\t\n\n\t// get the implied row and column indices\r\n\tvec2 rowcol = get_indices_1540259130( col_t, cols, row_t, rows );\n\n\t\n\n\t// this pixel index as if unpacked (up_cols = cols * 4.0)\r\n\tfloat index = rowcol.y * up_cols + rowcol.x * 4.0;\n\n\t\n\n\t// expanded indices per channel\r\n\tfloat index_r = index + 0.1;\n\n\tfloat index_g = index + 1.1;\n\n\tfloat index_b = index + 2.1;\n\n\tfloat index_a = index + 3.1;\n\n\t\n\n\t// number of padded elements(pixels) up to this index\r\n\tfloat pads_r = floor( index_r / up_cols_padded );\n\n\tfloat pads_g = floor( index_g / up_cols_padded );\n\n\tfloat pads_b = floor( index_b / up_cols_padded );\n\n\tfloat pads_a = floor( index_a / up_cols_padded );\n\n\t\n\n\t// new index accounting padding\r\n\tfloat nindex_r = index_r + pads_r * pad;\n\n\tfloat nindex_g = index_g + pads_g * pad;\n\n\tfloat nindex_b = index_b + pads_b * pad;\n\n\tfloat nindex_a = index_a + pads_a * pad;\n\n\t// new channel based on new index ( these get shifted )\r\n\tfloat nchannel_r = floor( mod( nindex_r, 4.0 ) );\n\n\tfloat nchannel_g = floor( mod( nindex_g, 4.0 ) );\n\n\tfloat nchannel_b = floor( mod( nindex_b, 4.0 ) );\n\n\tfloat nchannel_a = floor( mod( nindex_a, 4.0 ) );\n\n\t\n\n\t// can be optimized, at most 2 pixels should be read\r\n\t// get the sequence of coordinates of texture as if unpacked\r\n\tvec2 up_s = get_coords_1604150559( nindex_r, up_cols, up_col_hstep, rows, row_hstep );\n\n\tvec2 up_t = get_coords_1604150559( nindex_g, up_cols, up_col_hstep, rows, row_hstep );\n\n\tvec2 up_p = get_coords_1604150559( nindex_b, up_cols, up_col_hstep, rows, row_hstep );\n\n\tvec2 up_q = get_coords_1604150559( nindex_a, up_cols, up_col_hstep, rows, row_hstep );\n\n\t\n\n\t// read four values from texture considering the new channels \r\n\tfloat r = get_channel_value_1117569599( A, int(nchannel_r), up_s );\n\n\tfloat g = get_channel_value_1117569599( A, int(nchannel_g), up_t );\n\n\tfloat b = get_channel_value_1117569599( A, int(nchannel_b), up_p );\n\n\tfloat a = get_channel_value_1117569599( A, int(nchannel_a), up_q );\n\n\t\n\n\tgl_FragColor = vec4( r, g, b, a );\n\n}",
		pack:				"// UNPACKED to PACKED+UNDEFERRED\r\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2      UVs;\t// texture coords of row/column to calculate\r\n\nuniform float\t\tcols;\t\t\t// number of columns\r\nuniform float\t\tcol_hstep;\t\t// half step in texture space\r\nuniform float\t\trows;\t\t\t// number of rows\r\nuniform float\t\trow_hstep;\t\t// half step in texture space\r\n\nuniform float\t\tup_cols;\t\t// number of unpacked columns\r\nuniform float\t\tup_col_hstep;\t// half step in texture\r\n\nuniform sampler2D\tA;\t\t\t\t// texture with unpacked data A\r\nuniform int\t\t\tA_channel;\t\t// channel to read data from\r\n\nvec2 get_indices_1540259130( float col_t, float cols, float row_t, float rows ) {\t\n\n\tfloat col_index = floor(col_t * cols);\n\n\tfloat row_index = floor(row_t * rows);\n\n\t\n\n\treturn vec2(col_index, row_index);\n\n}\n\nvec2 get_coords_1117569599( float index, float cols, float cols_hstep, float rows, float row_hstep ) {\n\n\tfloat col_index = mod( index + 0.1, cols );// +0.1 prevents rounding error in next set of ops\r\n\tfloat row_index = floor( (index + 0.1) / cols );\n\n\t\n\n\t//float index = row_index * cols + col_index;\r\n\t\n\n\treturn vec2( col_index / cols + cols_hstep, row_index / rows + row_hstep );\n\n}\n\nfloat get_channel_value_1604150559( sampler2D texture, int channel, vec2 xy ) {\n\n\tfloat value = 0.0;\n\n\tif ( channel == 0 ) {\n\n\t\tvalue = texture2D( texture, xy ).r;\n\n\t} else if ( channel == 1 ) {\n\n\t\tvalue = texture2D( texture, xy ).g;\n\n\t} else if ( channel == 2 ) {\n\n\t\tvalue = texture2D( texture, xy ).b;\n\n\t} else if ( channel == 3 ) {\n\n\t\tvalue = texture2D( texture, xy ).a;\n\n\t}\t\n\n\treturn value;\n\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .t and .s of passed (output) texture coordinate.\r\n\tfloat col_t = UVs.s;\n\n\tfloat row_t = UVs.t;\n\n\t\n\n\t// get the implied row and column indices\r\n\tvec2 rowcol = get_indices_1540259130( col_t, cols, row_t, rows );\n\n\t\n\n\t// unpacked row and column index (columns are multiplied by 4 channels)\r\n\tfloat up_col = rowcol.x * 4.0;\n\n\tfloat up_row = rowcol.y / rows + row_hstep;\n\n\t\n\n\t// set a sequence of four indices\r\n\tvec4 seq_col_indices = vec4( up_col, up_col + 1.0, up_col + 2.0, up_col + 3.0 );\n\n\t\n\n\t// get the sequence of coordinates of unpacked texture\r\n\tvec2 up_s = vec2( seq_col_indices.x / up_cols + up_col_hstep, up_row );\n\n\tvec2 up_t = vec2( seq_col_indices.y / up_cols + up_col_hstep, up_row );\n\n\tvec2 up_p = vec2( seq_col_indices.z / up_cols + up_col_hstep, up_row );\n\n\tvec2 up_q = vec2( seq_col_indices.w / up_cols + up_col_hstep, up_row );\n\n\t\n\n\t// read four values from unpacked texture\r\n\tfloat r = get_channel_value_1604150559( A, A_channel, up_s );\n\n\tfloat g = get_channel_value_1604150559( A, A_channel, up_t );\n\n\tfloat b = get_channel_value_1604150559( A, A_channel, up_p );\n\n\tfloat a = get_channel_value_1604150559( A, A_channel, up_q );\n\n\tgl_FragColor = vec4( r, g, b, a );\n\n}",
		unpack:				"// PACKED+UNDEFERRED TO UNPACKED\r\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2\t\tUVs;\t\t// texture coords of row/column to calculate\r\n\nuniform float\t\tcols;\t\t\t// number of columns\r\nuniform float\t\tcol_hstep;\t\t// half step in texture space\r\nuniform float\t\trows;\t\t\t// number of rows\r\nuniform float\t\trow_hstep;\t\t// half step in texture space\r\n\nuniform float\t\tp_cols;\t\t\t// number of packed columns\r\nuniform float\t\tp_col_hstep;\t// half step in texture space\r\n\nuniform sampler2D\tA;\t\t\t\t// texture with single channel data from A\r\n\nuniform int\t\t\twrite_channel;\t// channel to write texture to\r\n\nvec2 get_indices_1604150559( float col_t, float cols, float row_t, float rows ) {\t\n\n\tfloat col_index = floor(col_t * cols);\n\n\tfloat row_index = floor(row_t * rows);\n\n\t\n\n\treturn vec2(col_index, row_index);\n\n}\n\nvec2 get_coords_1540259130( float index, float cols, float cols_hstep, float rows, float row_hstep ) {\n\n\tfloat col_index = mod( index + 0.1, cols );// +0.1 prevents rounding error in next set of ops\r\n\tfloat row_index = floor( (index + 0.1) / cols );\n\n\t\n\n\t//float index = row_index * cols + col_index;\r\n\t\n\n\treturn vec2( col_index / cols + cols_hstep, row_index / rows + row_hstep );\n\n}\n\nfloat get_channel_value_1117569599( sampler2D texture, int channel, vec2 xy ) {\n\n\tfloat value = 0.0;\n\n\tif ( channel == 0 ) {\n\n\t\tvalue = texture2D( texture, xy ).r;\n\n\t} else if ( channel == 1 ) {\n\n\t\tvalue = texture2D( texture, xy ).g;\n\n\t} else if ( channel == 2 ) {\n\n\t\tvalue = texture2D( texture, xy ).b;\n\n\t} else if ( channel == 3 ) {\n\n\t\tvalue = texture2D( texture, xy ).a;\n\n\t}\t\n\n\treturn value;\n\n}\n\nvec4 set_channel_value_2281831123( int channel, float value ) {\t\n\n\tif ( channel == 0 ) {\n\n\t\treturn vec4( value, 0.0, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 1 ) {\n\n\t\treturn vec4( 0.0, value, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 2 ) {\n\n\t\treturn vec4( 0.0, 0.0, value, 0.0 );\n\n\t}\n\n\tif ( channel == 3 ) {\n\n\t\treturn vec4( 0.0, 0.0, 0.0, value );\n\n\t}\t\n\n\treturn vec4( 0.0, 0.0, 0.0, 0.0 );\t// should not happen\r\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .t and .s of passed (output) texture coordinate.\r\n\tfloat col_t = UVs.s;\n\n\tfloat row_t = UVs.t;\n\n\t\n\n\tvec2 rowcol = get_indices_1604150559( col_t, cols, row_t, rows );\n\n\tfloat p_col_index = floor( rowcol.x / 4.0 );\t\n\n\tfloat p_index = floor( rowcol.y * p_cols + p_col_index ); //  + 0.1\r\n\t\n\n\tint A_channel = int( mod( rowcol.x, 4.0 ) );\n\n\tvec2 packed_st = get_coords_1540259130( p_index, p_cols, p_col_hstep, rows, row_hstep );\t\n\n\tfloat value = get_channel_value_1117569599( A, A_channel, packed_st );\n\n\t\n\n\tgl_FragColor = set_channel_value_2281831123( write_channel, value );\n\n}\n\n",
		render_packed:		"// UNPACKED to PACKED+DEFERRED\r\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2\t\tUVs;\t\t\t// texture coords of row/column to calculate\r\n\nuniform float\t\tcols;\t\t\t// number of columns\r\nuniform float\t\tcol_hstep;\t\t// half step in texture space\r\nuniform float\t\trows;\t\t\t// number of rows\r\nuniform float\t\trow_hstep;\t\t// half step in texture space\r\n\nuniform float\t\tup_cols;\t\t// number of unpacked columns\r\nuniform float\t\tup_col_hstep;\t// half step in texture space\r\nuniform float\t\tup_cols_padded;\t// number of unpacked columns accounting padding\r\n\nuniform sampler2D\tA;\t\t\t\t// texture with single channel data\r\nuniform int\t\t\tA_channel;\t\t// channel to read data from\r\n\nvec2 get_indices_1540259130( float col_t, float cols, float row_t, float rows ) {\t\n\n\tfloat col_index = floor(col_t * cols);\n\n\tfloat row_index = floor(row_t * rows);\n\n\t\n\n\treturn vec2(col_index, row_index);\n\n}\n\nvec2 get_coords_1604150559( float index, float cols, float cols_hstep, float rows, float row_hstep ) {\n\n\tfloat col_index = mod( index + 0.1, cols );// +0.1 prevents rounding error in next set of ops\r\n\tfloat row_index = floor( (index + 0.1) / cols );\n\n\t\n\n\t//float index = row_index * cols + col_index;\r\n\t\n\n\treturn vec2( col_index / cols + cols_hstep, row_index / rows + row_hstep );\n\n}\n\nfloat get_channel_value_1117569599( sampler2D texture, int channel, vec2 xy ) {\n\n\tfloat value = 0.0;\n\n\tif ( channel == 0 ) {\n\n\t\tvalue = texture2D( texture, xy ).r;\n\n\t} else if ( channel == 1 ) {\n\n\t\tvalue = texture2D( texture, xy ).g;\n\n\t} else if ( channel == 2 ) {\n\n\t\tvalue = texture2D( texture, xy ).b;\n\n\t} else if ( channel == 3 ) {\n\n\t\tvalue = texture2D( texture, xy ).a;\n\n\t}\t\n\n\treturn value;\n\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .t and .s of passed (output) texture coordinate.\r\n\tfloat col_t = UVs.s;\n\n\tfloat row_t = UVs.t;\n\n\t\n\n\t// get the implied row and column indices\r\n\tvec2 rowcol = get_indices_1540259130( col_t, cols, row_t, rows );\n\n\t\n\n\t// unpacked index (columns are multiplied by 4 channels)\r\n\tfloat up_index = rowcol.y * cols * 4.0 + rowcol.x * 4.0;\n\n\t\n\n\t// set a sequence of four indices\r\n\tvec4 seq_indices = vec4( up_index, up_index + 1.0, up_index + 2.0, up_index + 3.0 );\n\n\t\n\n\t// get the sequence of coordinates of unpacked texture\r\n\tvec2 up_s = get_coords_1604150559( seq_indices.x, up_cols_padded, up_col_hstep, rows, row_hstep );\n\n\tvec2 up_t = get_coords_1604150559( seq_indices.y, up_cols_padded, up_col_hstep, rows, row_hstep );\n\n\tvec2 up_p = get_coords_1604150559( seq_indices.z, up_cols_padded, up_col_hstep, rows, row_hstep );\n\n\tvec2 up_q = get_coords_1604150559( seq_indices.w, up_cols_padded, up_col_hstep, rows, row_hstep );\n\n\t\n\n\t// read four values from unpacked texture\r\n\tfloat r = get_channel_value_1117569599( A, A_channel, up_s );\n\n\tfloat g = get_channel_value_1117569599( A, A_channel, up_t );\n\n\tfloat b = get_channel_value_1117569599( A, A_channel, up_p );\n\n\tfloat a = get_channel_value_1117569599( A, A_channel, up_q );\n\n\tgl_FragColor = vec4( r, g, b, a );\n\n}\n\n",
		render_unpacked:	"// UNPACKED to UNPACKED\r\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2      UVs;\t// texture coords of row/column to calculate\r\nuniform sampler2D A;\t\t// texture with data from padded A\r\n\nvoid main( void ) {\n\n\t\n\n\tgl_FragColor = texture2D( A, UVs );\n\n}",
		
		mixin:				"// UNPACKED\r\nprecision highp float;\n#define GLSLIFY 1\n\n// Uniforms\r\n\nvarying vec2\t\tUVs;\t\t\t// texture coords of row/column to calculate\r\n\n// uRED\r\n\n// uGREEN\r\n\n// uBLUE\r\n\n// uALPHA\r\n\nfloat get_channel_value_1540259130( sampler2D texture, int channel, vec2 xy ) {\n\n\tfloat value = 0.0;\n\n\tif ( channel == 0 ) {\n\n\t\tvalue = texture2D( texture, xy ).r;\n\n\t} else if ( channel == 1 ) {\n\n\t\tvalue = texture2D( texture, xy ).g;\n\n\t} else if ( channel == 2 ) {\n\n\t\tvalue = texture2D( texture, xy ).b;\n\n\t} else if ( channel == 3 ) {\n\n\t\tvalue = texture2D( texture, xy ).a;\n\n\t}\t\n\n\treturn value;\n\n}\n\nvoid main( void ) {\n\n\t\n\n\t// mRED\r\n\t// mGREEN\r\n\t// mBLUE\r\n\t// mALPHA\r\n\t\n\n\t// glFG\r\n}", // base shader for dynamic generation
		
		duplicate:			"// UNPACKED\r\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2\t\tUVs;\t\t\t// texture coords of row/column to calculate\r\n\nuniform sampler2D\tA;\t\t\t\t// texture with unpacked data A\r\nuniform int\t\t\tA_channel;\t\t// channel to read data from\r\n\nuniform int\t\t\twrite_channel;\t// channel to write texture to\r\n\nfloat get_channel_value_1604150559( sampler2D texture, int channel, vec2 xy ) {\n\n\tfloat value = 0.0;\n\n\tif ( channel == 0 ) {\n\n\t\tvalue = texture2D( texture, xy ).r;\n\n\t} else if ( channel == 1 ) {\n\n\t\tvalue = texture2D( texture, xy ).g;\n\n\t} else if ( channel == 2 ) {\n\n\t\tvalue = texture2D( texture, xy ).b;\n\n\t} else if ( channel == 3 ) {\n\n\t\tvalue = texture2D( texture, xy ).a;\n\n\t}\t\n\n\treturn value;\n\n}\n\nvec4 set_channel_value_1540259130( int channel, float value ) {\t\n\n\tif ( channel == 0 ) {\n\n\t\treturn vec4( value, 0.0, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 1 ) {\n\n\t\treturn vec4( 0.0, value, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 2 ) {\n\n\t\treturn vec4( 0.0, 0.0, value, 0.0 );\n\n\t}\n\n\tif ( channel == 3 ) {\n\n\t\treturn vec4( 0.0, 0.0, 0.0, value );\n\n\t}\t\n\n\treturn vec4( 0.0, 0.0, 0.0, 0.0 );\t// should not happen\r\n}\n\nvoid main( void ) {\n\n\tfloat A_value = get_channel_value_1604150559( A, A_channel, UVs );\n\n\tgl_FragColor = set_channel_value_1540259130( write_channel, A_value );\n\n}",
		//duplicate_full:		glslify('./glsl/duplicate_full.glsl'),
		duplicate_packed:	"// PACKED TO PACKED\r\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2      UVs;\t// texture coords of row/column to calculate\r\nuniform sampler2D A;\t\t// texture with data from padded A\r\n\nvoid main(void) {\t\n\n\tgl_FragColor = texture2D( A, UVs );\n\n}",
		
		transpose_unpacked:	"// TRANSPOSE UNPACKED\r\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2      \tUVs;\t\t\t// texture coords of row/column to calculate\r\nuniform sampler2D \tA;\t\t\t\t// texture with data from padded A\r\nuniform int\t\t\tA_channel;\t\t// channel to read data from\r\n\nuniform int\t\t\twrite_channel;\t// channel to write texture to\r\n\nfloat get_channel_value_1540259130( sampler2D texture, int channel, vec2 xy ) {\n\n\tfloat value = 0.0;\n\n\tif ( channel == 0 ) {\n\n\t\tvalue = texture2D( texture, xy ).r;\n\n\t} else if ( channel == 1 ) {\n\n\t\tvalue = texture2D( texture, xy ).g;\n\n\t} else if ( channel == 2 ) {\n\n\t\tvalue = texture2D( texture, xy ).b;\n\n\t} else if ( channel == 3 ) {\n\n\t\tvalue = texture2D( texture, xy ).a;\n\n\t}\t\n\n\treturn value;\n\n}\n\nvec4 set_channel_value_1604150559( int channel, float value ) {\t\n\n\tif ( channel == 0 ) {\n\n\t\treturn vec4( value, 0.0, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 1 ) {\n\n\t\treturn vec4( 0.0, value, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 2 ) {\n\n\t\treturn vec4( 0.0, 0.0, value, 0.0 );\n\n\t}\n\n\tif ( channel == 3 ) {\n\n\t\treturn vec4( 0.0, 0.0, 0.0, value );\n\n\t}\t\n\n\treturn vec4( 0.0, 0.0, 0.0, 0.0 );\t// should not happen\r\n}\n\nvoid main(void) {\n\n\t\n\n\tfloat value = get_channel_value_1540259130( A, A_channel, vec2( UVs.y, UVs.x ) );\t\n\n\tgl_FragColor = set_channel_value_1604150559( write_channel, value );\n\n}"
	}

	// Create Shaders	
	this.shaders = {}

	for ( var shader in this.shaders_src ) {
		var shaderSource = this.shaders_src[ shader ]
		var shaderType = gl.FRAGMENT_SHADER
		if ( shader === 'pass_through' ) shaderType = gl.VERTEX_SHADER
		this.shaders[ shader ] = this.setupShader( shaderSource, shaderType )
	}
	
	// Create Programs
	this.programs = {}

	for ( var shader in this.shaders ) {
		if ( shader !== 'pass_through' ) {
			this.programs[ shader ] = this.setupProgram( this.shaders.pass_through, this.shaders[ shader ] )
		}
	}
}
gl.setupPrograms()

WebGL.prototype.setupTexture = function( M, N, data, packed, glFormat, glType ) {
	var gl = this.context
	
	var W = packed ? Math.ceil( N / 4 ) : N
	var H = M

	var texture = gl.createTexture()
	
	this.state.bindTexture( gl.TEXTURE_2D, texture )
	
	gl.pixelStorei( gl.UNPACK_FLIP_Y_WEBGL, false )
	gl.pixelStorei( gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false )
	//gl.pixelStorei( gl.UNPACK_ALIGNMENT, 4 )

	this.state.texImage2D( gl.TEXTURE_2D, 0, glFormat, W, H, 0, glFormat, glType, data )
	
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE )
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE )

	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
	
	this.state.bindTexture( gl.TEXTURE_2D, null )

	return texture
}

WebGL.prototype.setupFramebuffer = function() {
	var gl = this.context
	
	var currentViewport = gl.getParameter( gl.VIEWPORT )
	var targetViewport = { x: 0, y: 0, z: 2, w: 2 }
	
	this.state.viewport( targetViewport )
	
	this.framebuffer = gl.createFramebuffer()
	
	var texture = this.setupTexture( 2, 2, null, false, gl.RGBA, gl.FLOAT )
	this.state.bindTexture( gl.TEXTURE_2D, texture )
	
	this.state.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, 2, 2, 0, gl.RGBA, gl.FLOAT, null )
	gl.bindFramebuffer( gl.FRAMEBUFFER, this.framebuffer )
	gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0 )

	if( gl.checkFramebufferStatus( gl.FRAMEBUFFER ) != gl.FRAMEBUFFER_COMPLETE )
		console.error( 'bindFramebuffer(): Framebuffer not complete' )

	gl.bindFramebuffer( gl.FRAMEBUFFER, null )
}
gl.setupFramebuffer()

// BINDING
WebGL.prototype.bindBuffers = function( buffers ) {
	var gl = this.context
		
	var position = gl.getAttribLocation( this.program, 'position' )
	var texture = gl.getAttribLocation( this.program, 'uv' )
	
	this.state.initAttributes()
	this.state.enableAttribute( position )
	this.state.enableAttribute( texture )
	this.state.disableUnusedAttributes()	
		
	gl.bindBuffer( gl.ARRAY_BUFFER, buffers.vertexBuffer )
	gl.vertexAttribPointer( position, 3, gl.FLOAT, false, 0, 0 )

	gl.bindBuffer( gl.ARRAY_BUFFER, buffers.uvBuffer )	
	gl.vertexAttribPointer( texture, 2, gl.FLOAT, false, 0, 0 )

	gl.bindBuffer( gl.ELEMENT_ARRAY_BUFFER, buffers.elementBuffer )
}

WebGL.prototype.bindUniforms = function( uniforms ) {
	for ( var location in uniforms ) {
		var uniform = uniforms[ location ]
		this.bindUniform( uniform.type, uniform.value, location )
	}
}
/* uniform binding one-liner resembling texture binding
	instead of:
		var N_in_gl = this.context.getUniformLocation( this.program, 'N' )
		this.context.uniform1f( N_in_gl, N )
	we do:
		this.bindUniform( 'uniform1f', N, 'N' )
	akin to:		
		this.bindInputTexture( texture0, this.context.TEXTURE0, 'A' )
	
	we could further level the order of arguments too,
	or even unify these methods (at the cost of a type check)
*/
WebGL.prototype.bindUniform = function( type, data, name ) {
	var uniform_gl = this.context.getUniformLocation( this.program, name )
	this.context[type]( uniform_gl, data )
}

WebGL.prototype.bindTextures = function( tensors ) {
	var unit = 0
	for ( var location in tensors ) {
		var tensor = tensors[ location ]
		this.bindTexture( tensor.texture, unit, location )
		this.bindUniform( 'uniform1i', tensor.channel, location + '_channel' )
		unit++
	}
}

WebGL.prototype.bindTexture = function( texture, unit, location ) {
	var gl = this.context
	
	this.state.activeTexture( gl.TEXTURE0 + unit )	
	this.state.bindTexture( gl.TEXTURE_2D, texture )

	var uniform_gl = gl.getUniformLocation( this.program, location )
	gl.uniform1i( uniform_gl, unit )

}

WebGL.prototype.unbindTextures = function( textures ) {
	var unit = 0
	for ( var texture in textures ) {
		this.unbindTexture( unit )
		unit++
	}
}

WebGL.prototype.unbindTexture = function( unit ) {
	var gl = this.context
	
	this.state.activeTexture( gl.TEXTURE0 + unit )	
	this.state.bindTexture(	gl.TEXTURE_2D, null )
}


WebGL.prototype.bindFramebuffer = function( M, N, texture ) {
	var gl = this.context
	
	var currentViewport = gl.getParameter( gl.VIEWPORT )
	var targetViewport = { x: 0, y: 0, z: N, w: M }
	
	this.state.viewport( targetViewport )
	
	if ( viewportsEqual( currentViewport, targetViewport ) ) {
		this.framebuffer = this.framebuffer ? this.framebuffer : gl.createFramebuffer()
	} else {
		if ( this.framebuffer ) gl.deleteFramebuffer( this.framebuffer )
		this.framebuffer = gl.createFramebuffer()
	}
	
	gl.bindFramebuffer( gl.FRAMEBUFFER, this.framebuffer )
	gl.framebufferTexture2D( gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0 )

	if( gl.checkFramebufferStatus( gl.FRAMEBUFFER ) != gl.FRAMEBUFFER_COMPLETE )
		console.error( 'bindFramebuffer(): Framebuffer not complete' )
}

/* Read data out as floats
	for ouput purposes only we are 'deferring' all null data (found in padded textures)
	to the end of the array instead of having padded 0s per each row to prevent any user postprocessing
	this is done at the shader level but must be handled when generating the CPU array
*/
WebGL.prototype.readFloat = function( M, N, packed ) {
	var gl = this.context

	var W = packed ? Math.ceil( N / WebGL.COMPONENTS_PER_TEXEL ) : N
	var H = M
	var size = H * W * Float32Array.BYTES_PER_ELEMENT * 4

	// create destination buffer
	var rawbuffer = new ArrayBuffer( size )
	
	var readBuffer = new Float32Array( rawbuffer )
	gl.readPixels( 0, 0, W, H, gl.RGBA, gl.FLOAT, readBuffer )

	var sub_end = ( size - M * N * Float32Array.BYTES_PER_ELEMENT ) / WebGL.COMPONENTS_PER_TEXEL
	
	// !!?? subarray() must use negative indexes of the relevant part else the full typed array is returned
	// Must use negative indexes
	return !packed || sub_end == 0 ? readBuffer : readBuffer.subarray( -size, -sub_end )
}

WebGL.prototype.renderPass = function( output, program, buffers, uniforms, textures ) {
	var gl = this.context
	
	this.program = program
	
	gl.useProgram( program )
	
	this.bindBuffers( buffers )
	
	this.bindUniforms( uniforms )
	
	this.bindTextures( textures )
	
	this.bindFramebuffer( output.height, output.width, output.texture )
	
	gl.drawElements( gl.TRIANGLES, buffers.elements_length, gl.UNSIGNED_SHORT, 0 )
	
	this.unbindTextures( textures )
	
	// handoff context
	this.state.resetGL()
}

/*	float texture read, allows output as packed+deferred or unpacked
 */
WebGL.prototype.render = function( M, N, tensor, out, packed ) {
	var output = { width: N, height: M, texture: out }
	
	var uniforms = {}

	if ( packed ) {
		var W = Math.ceil( N / 4 )
		var H = M
		
		output.width = W
		
		var pad = W * 4 - N
		
		uniforms = {
			cols: 			{ type: 'uniform1f', value: W },
			col_hstep: 		{ type: 'uniform1f', value: ( 1 / W ) * 0.5 },
			rows: 			{ type: 'uniform1f', value: H },
			row_hstep: 		{ type: 'uniform1f', value: ( 1 / H ) * 0.5 },
			
			up_cols: 		{ type: 'uniform1f', value: W * 4 },
			up_col_hstep: 	{ type: 'uniform1f', value: ( 1 / (W * 4) ) * 0.5 },
			up_cols_padded: { type: 'uniform1f', value: W * 4 - pad }
		}
	}
	
	var textures = {
		A: tensor
	}
	
	// Dynamic generation occurs here
	// we have uniforms and textures set and can now include them in shader
	
	// -> extend ability to common functions get/set_channel_value and do without glslify
	
	// -> use caching for generated programs, follow similar method of generate_mixin_program()
	
	// -> externalize ability to write frag shader main() from outside
	var program = packed ? this.programs.render_packed : this.programs.render_unpacked
	
	var buffers = this.buffers.framequad
	
	this.renderPass( output, program, buffers, uniforms, textures )
}

/*	direct texture float data read (no float encode) - requires OES_texture_float support
 */
WebGL.prototype.read = function( M, N, tensor, out ) {
	var output = { width: N, height: M, texture: out }
	
	var uniforms = {}

	if ( tensor.requires_padding ) {
		var W = Math.ceil( N / 4 )
		var H = M
		
		output.width = W
		
		var pad = W * 4 - N
		
		uniforms = {
			cols: 			{ type: 'uniform1f', value: W },
			col_hstep: 		{ type: 'uniform1f', value: ( 1 / W ) * 0.5 },
			rows: 			{ type: 'uniform1f', value: H },
			row_hstep: 		{ type: 'uniform1f', value: ( 1 / H ) * 0.5 },
			
			up_cols: 		{ type: 'uniform1f', value: W * 4 },
			up_col_hstep: 	{ type: 'uniform1f', value: ( 1 / (W * 4) ) * 0.5 },
			
			pad: 			{ type: 'uniform1f', value: pad },
			up_cols_padded: { type: 'uniform1f', value: W * 4 - pad }
		}
	}
	
	var textures = {
		A: tensor
	}

	var program = tensor.requires_padding ? this.programs.read_packed_padded : this.programs.read_packed
	
	var buffers = this.buffers.framequad
	
	this.renderPass( output, program, buffers, uniforms, textures )
}

/*	duplicate texture (use in iterative calculations)
 */
WebGL.prototype.duplicate = function( M, N, tensor, out, packed ) {
	var output = { width: N, height: M, texture: out.texture }
	
	var uniforms = {}

	if ( !packed ) {		
		uniforms = {
			write_channel:	{ type: 'uniform1i', value: out.channel }
		}
	}
	
	var textures = {
		A: tensor
	}

	var program = !packed ? this.programs.duplicate : this.programs.duplicate_packed
	
	var buffers = this.buffers.framequad
	
	this.renderPass( output, program, buffers, uniforms, textures )
}

/*	used to convert a unpacked texture into a packed texture
 */
WebGL.prototype.pack = function( M, N, tensor, out ) {
	var output = { width: N, height: M, texture: out }
	
	var uniforms = {}

	var W = Math.ceil( N / 4 )
	var H = M
	
	uniforms = {
		cols: 			{ type: 'uniform1f', value: W },
		col_hstep: 		{ type: 'uniform1f', value: ( 1 / W ) * 0.5 },
		rows: 			{ type: 'uniform1f', value: H },
		row_hstep: 		{ type: 'uniform1f', value: ( 1 / H ) * 0.5 },
		
		up_cols: 		{ type: 'uniform1f', value: N },
		up_col_hstep: 	{ type: 'uniform1f', value: ( 1 / N ) * 0.5 }
	}
	
	var textures = {
		A: tensor
	}

	var program = this.programs.pack
	
	var buffers = this.buffers.framequad
	
	this.renderPass( output, program, buffers, uniforms, textures )
}

/*	used to convert a packed texture (data is held in all RGBA channels)
	into an unpacked texture (data is held in a selected channel)
 */
WebGL.prototype.unpack = function( M, N, tensor, out ) {
	var output = { width: N, height: M, texture: out }
	
	var uniforms = {}

	var W = N
	var H = M
	
	uniforms = {
		cols: 			{ type: 'uniform1f', value: W },
		col_hstep: 		{ type: 'uniform1f', value: ( 1 / W ) * 0.5 },
		rows: 			{ type: 'uniform1f', value: H },
		row_hstep: 		{ type: 'uniform1f', value: ( 1 / H ) * 0.5 },
		
		p_cols: 		{ type: 'uniform1f', value: Math.ceil( W / 4 ) },
		p_col_hstep: 	{ type: 'uniform1f', value: ( 1 / Math.ceil( W / 4 ) ) * 0.5 },
		
		write_channel:	{ type: 'uniform1i', value: tensor.channel }
	}
	
	var textures = {
		A: tensor
	}

	var program = this.programs.unpack
	
	var buffers = this.buffers.framequad
	
	this.renderPass( output, program, buffers, uniforms, textures )
}

/* tranpose a texture where input has M rows and N columns
 */
WebGL.prototype.transpose_packed = WebGL.prototype.transpose

/* tranpose a texture where input has M rows and N columns
 */
WebGL.prototype.transpose = function( M, N, tensor, out ) {
	// WARNING! SWITCHED M | N 
	var output = { width: M, height: N, texture: out.texture }
	
	var uniforms = {}

	uniforms = {
		write_channel:	{ type: 'uniform1i', value: out.channel }
	}
	
	var textures = {
		A: tensor
	}

	var program = this.programs.transpose_unpacked	
	
	var buffers = this.buffers.framequad
	
	this.renderPass( output, program, buffers, uniforms, textures )
}

/*	combine texture channels
 */
WebGL.prototype.mixin = function( M, N, red, green, blue, alpha, mix ) {
	var output = { width: N, height: M, texture: mix.texture }
	
	var uniforms = {}
	var textures = {}

	if ( red != null ) textures.RED = red
	if ( green != null ) textures.GREEN = green
	if ( blue != null )	textures.BLUE = blue
	if ( alpha != null ) textures.ALPHA = alpha

	var program = this.generate_mixin_program( red, green, blue, alpha )
	
	var buffers = this.buffers.framequad
	
	this.renderPass( output, program, buffers, uniforms, textures )
}

WebGL.prototype.generate_mixin_program = function( red, green, blue, alpha ) {
	var gl = this.context
	
	var r = red != null ? 'r' : 'n'
	var g = green != null ? 'g' : 'n'
	var b = blue != null ? 'b' : 'n'
	var a = alpha != null ? 'a' : 'n'
	
	// compose name along the pattern "mixin_rgba_program"
	// where each channel is replaced with "n" if null
	var program_name = 'mixin_' + r + g + b + a + '_program'
	
	// generate only if program is inexistent
	if ( !this.programs.hasOwnProperty( program_name ) ) {

		var new_frag = this.shaders_src.mixin // dynamic shader base struture

		// glsify appends a numeric code to each 'glsified' shader function
		// we must source the fragment with this renamed function
		var get_channel_value_fnc = new RegExp( '(get_channel_value_)(\\d+)' ).exec( new_frag )

		var uniforms = { 'RED': red, 'GREEN': green, 'BLUE': blue, 'ALPHA': alpha }
		var values = { 'RED': '0.0', 'GREEN': '0.0', 'BLUE': '0.0', 'ALPHA': '0.0' }

		for ( var key in uniforms ) {
			if ( uniforms[ key ] != null ) {
				var new_frag_uniform = 	'uniform sampler2D	' + key + '; 				// texture with unpacked data ' + key + '\r\n' +
										'uniform int			' + key + '_channel; 		// channel to read data from\r\n'

				var new_frag_value = 	'float ' + key + ' = ' + get_channel_value_fnc[0] + '( ' + key + ', ' + key + '_channel, UVs );\r\n'

				new_frag = new_frag.replace( '// u' + key + '\r\n', new_frag_uniform )
				new_frag = new_frag.replace( '// m' + key + '\r\n', new_frag_value )

				values[ key ] = key
			}
		}

		var new_glfragcolor = 'gl_FragColor = vec4( ' + values[ 'RED' ] + ', ' +
														values[ 'GREEN' ] + ', ' +
														values[ 'BLUE' ] + ', ' +
														values[ 'ALPHA' ] + ' );\r\n'

		new_frag = new_frag.replace( '// glFG\r\n', new_glfragcolor )

		this.shaders[ program_name ] = this.setupShader( new_frag, gl.FRAGMENT_SHADER )
		this.programs[ program_name ] = this.setupProgram( this.shaders.pass_through, this.shaders[ program_name ] )
	}
	return this.programs[ program_name ]
}


// Utils
// check viewports
function viewportsEqual( cv, tv ) {
	if ( cv[0] === tv.x && cv[1] === tv.y && cv[2] === tv.z && cv[3] === tv.w ) {
		return true
	} else {
		return false
	}
}
// addLineNumbers from THREE.WebGLShader
function addLineNumbers( string ) {
	var lines = string.split( '\n' )
	for ( var i = 0; i < lines.length; i ++ ) {
		lines[ i ] = ( i + 1 ) + ': ' + lines[ i ]
	}
	return lines.join( '\n' )
}
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],6:[function(require,module,exports){
(function (global){
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
var weblas = (typeof window !== "undefined" ? window['weblas'] : typeof global !== "undefined" ? global['weblas'] : null)

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

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./lib/blas_addon":1,"./lib/nn_addon":2,"./lib/tensor_addin":3,"./lib/tensor_unpacked":4,"./lib/webgl_addin":5}]},{},[6])(6)
});