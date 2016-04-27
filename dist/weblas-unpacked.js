(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.weblas_unpacked = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
/*
Copyright (c) 2016 Pedro Soares

blas_addon.js

	RGBA unpacked type
	blas computation for unpacked type
	
	SGEMM - http://www.netlib.org/blas/#_level_3

*/



/*var globals	 = require('./globals')

var gl = globals.gl*/
var weblas = (typeof window !== "undefined" ? window['weblas'] : typeof global !== "undefined" ? global['weblas'] : null)
var gl = weblas.gpu.gl

//	Shader
var sgemm_glsl		 	= "// DOTPRODUCT UNPACKED\r\nprecision highp float;\n\nprecision highp int;\n#define GLSLIFY 1\n\nvarying vec2      \toutTex;\t\t\t// texture coords of row/column to calculate\r\n\nuniform int\t\t\tK;\t\t\t\t// \r\nuniform float\t\tK_step;\t\t\t// \r\nuniform float\t\tK_hstep;\t\t// \r\n\nuniform float\t\talpha;\t\t\t// \r\n\nuniform sampler2D \tA;\t\t\t\t// texture with data A\r\nuniform int\t\t\tA_channel;\t\t// channel to read data from\r\n\nuniform sampler2D \tB;\t\t\t\t// texture with data B\r\nuniform int\t\t\tB_channel;\t\t// channel to read data from\r\n\nuniform int\t\t\twrite_channel;\t// channel to write data to\r\n\nfloat get_channel_value_1540259130( sampler2D texture, int channel, vec2 xy ) {\t\n\n\tif ( channel == 0 ) {\n\n\t\treturn texture2D( texture, xy ).r;\n\n\t}\n\n\tif ( channel == 1 ) {\n\n\t\treturn texture2D( texture, xy ).g;\n\n\t}\n\n\tif ( channel == 2 ) {\n\n\t\treturn texture2D( texture, xy ).b;\n\n\t}\n\n\tif ( channel == 3 ) {\n\n\t\treturn texture2D( texture, xy ).a;\n\n\t}\t\n\n\treturn 0.0;\t// should not happen\r\n}\n\nvec4 set_channel_value_1604150559( int channel, float value ) {\t\n\n\tif ( channel == 0 ) {\n\n\t\treturn vec4( value, 0.0, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 1 ) {\n\n\t\treturn vec4( 0.0, value, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 2 ) {\n\n\t\treturn vec4( 0.0, 0.0, value, 0.0 );\n\n\t}\n\n\tif ( channel == 3 ) {\n\n\t\treturn vec4( 0.0, 0.0, 0.0, value );\n\n\t}\t\n\n\treturn vec4( 0.0, 0.0, 0.0, 0.0 );\t// should not happen\r\n}\n\nvoid main( void ) {\n\n\tfloat row_t = outTex.y;\n\n\tfloat col_t = outTex.x;\n\n\t\n\n\tfloat hstep = K_hstep;// position for shared dimension on source textures\r\n\tfloat sum = 0.0;\n\n\tfor ( int l = 0 ; l < 4096 ; ++l ) {\n\n\t\tif ( l >= K ) break;    // stop when we finish the row/column\r\n\t\t// l is in pixel space, so we divide by four\r\n\n\t\t// read value from each texture\r\n\t\tfloat a_ik = get_channel_value_1540259130( A, A_channel, vec2( hstep, row_t ) );\n\n\t\tfloat b_kj = get_channel_value_1540259130( B, B_channel, vec2( col_t, hstep ) );\n\n\t\tsum += a_ik * b_kj;\n\n\t\thstep += K_step;\n\n\t}\n\n\tgl_FragColor = set_channel_value_1604150559( write_channel, alpha * sum );\n\n}",
	sgemm_c_glsl		= "// DOTPRODUCT UNPACKED\r\nprecision highp float;\n\nprecision highp int;\n#define GLSLIFY 1\n\nvarying vec2      \toutTex;\t\t\t// texture coords of row/column to calculate\r\n\nuniform int\t\t\tK;\t\t\t\t// \r\nuniform float\t\tK_step;\t\t\t// \r\nuniform float\t\tK_hstep;\t\t// \r\n\nuniform float\t\talpha;\t\t\t// \r\n\nuniform sampler2D \tA;\t\t\t\t// texture with data A\r\nuniform int\t\t\tA_channel;\t\t// channel to read data from\r\n\nuniform sampler2D \tB;\t\t\t\t// texture with data B\r\nuniform int\t\t\tB_channel;\t\t// channel to read data from\r\n\nuniform float\t\tbeta;\t\t\t// \r\n\nuniform sampler2D \tC;\t\t\t\t// texture with data B\r\nuniform int\t\t\tC_channel;\t\t// channel to read data from\r\n\nuniform int\t\t\twrite_channel;\t// channel to write data to\r\n\nfloat get_channel_value_1540259130( sampler2D texture, int channel, vec2 xy ) {\t\n\n\tif ( channel == 0 ) {\n\n\t\treturn texture2D( texture, xy ).r;\n\n\t}\n\n\tif ( channel == 1 ) {\n\n\t\treturn texture2D( texture, xy ).g;\n\n\t}\n\n\tif ( channel == 2 ) {\n\n\t\treturn texture2D( texture, xy ).b;\n\n\t}\n\n\tif ( channel == 3 ) {\n\n\t\treturn texture2D( texture, xy ).a;\n\n\t}\t\n\n\treturn 0.0;\t// should not happen\r\n}\n\nvec4 set_channel_value_1604150559( int channel, float value ) {\t\n\n\tif ( channel == 0 ) {\n\n\t\treturn vec4( value, 0.0, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 1 ) {\n\n\t\treturn vec4( 0.0, value, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 2 ) {\n\n\t\treturn vec4( 0.0, 0.0, value, 0.0 );\n\n\t}\n\n\tif ( channel == 3 ) {\n\n\t\treturn vec4( 0.0, 0.0, 0.0, value );\n\n\t}\t\n\n\treturn vec4( 0.0, 0.0, 0.0, 0.0 );\t// should not happen\r\n}\n\nvoid main( void ) {\n\n\tfloat row_t = outTex.y;\n\n\tfloat col_t = outTex.x;\n\n\tfloat c = beta * get_channel_value_1540259130( C, C_channel, outTex );\n\n\t\n\n\tfloat hstep = K_hstep;// position for shared dimension on source textures\r\n\tfloat sum = 0.0;\n\n\tfor ( int l = 0 ; l < 4096 ; ++l ) {\n\n\t\tif ( l >= K ) break;    // stop when we finish the row/column\r\n\t\t// l is in pixel space, so we divide by four\r\n\n\t\t// read value from each texture\r\n\t\tfloat a_ik = get_channel_value_1540259130( A, A_channel, vec2( hstep, row_t ) );\n\n\t\tfloat b_kj = get_channel_value_1540259130( B, B_channel, vec2( col_t, hstep ) );\n\n\t\tsum += a_ik * b_kj;\n\n\t\thstep += K_step;\n\n\t}\n\n\tgl_FragColor = set_channel_value_1604150559( write_channel, alpha * sum + c );\n\n}"
	
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

	var AM = A.shape[0], // 3 = rows = M = H
		AN = A.shape[1], // 2 = cols = N = W
		BM = B.shape[0], // 2 = rows = M = H
		BN = B.shape[1]	 // 4 = cols = N = W

	if ( AN != BM ) throw new Error('sgemm(): A / B incompatible dimensions (' + AN + ' != ' + BM + ')' )

	//var C = typeof C_ == 'undefined' || C_ == null ? new weblas.unpacked.Tensor( [AM, BN], null ) : C_
	
	if ( A.packed || B.packed ) throw new Error('sgemm(): Only unpacked textures supported.')
	if ( C != null ) { if ( C.packed ) throw new Error('sgemm(): Only unpacked textures supported.') }
		
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
var gl = weblas.gpu.gl

//var WebGL	= require('../node_modules/weblas/lib/webgl')
var WebGL = weblas.gpu.gl.__proto__.constructor


//	ReLU

//	Shader
var relu_glsl		 	= "// RELU UNPACKED\r\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2      \toutTex;\t\t\t// texture coords of row/column to calculate\r\n\nuniform sampler2D \tA;\t\t\t\t// texture with data A\r\nuniform int\t\t\tA_channel;\t\t// channel to read data from\r\n\nuniform int\t\t\twrite_channel;\t// channel to write data to\r\n\nfloat get_channel_value_1540259130( sampler2D texture, int channel, vec2 xy ) {\t\n\n\tif ( channel == 0 ) {\n\n\t\treturn texture2D( texture, xy ).r;\n\n\t}\n\n\tif ( channel == 1 ) {\n\n\t\treturn texture2D( texture, xy ).g;\n\n\t}\n\n\tif ( channel == 2 ) {\n\n\t\treturn texture2D( texture, xy ).b;\n\n\t}\n\n\tif ( channel == 3 ) {\n\n\t\treturn texture2D( texture, xy ).a;\n\n\t}\t\n\n\treturn 0.0;\t// should not happen\r\n}\n\nvec4 set_channel_value_1604150559( int channel, float value ) {\t\n\n\tif ( channel == 0 ) {\n\n\t\treturn vec4( value, 0.0, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 1 ) {\n\n\t\treturn vec4( 0.0, value, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 2 ) {\n\n\t\treturn vec4( 0.0, 0.0, value, 0.0 );\n\n\t}\n\n\tif ( channel == 3 ) {\n\n\t\treturn vec4( 0.0, 0.0, 0.0, value );\n\n\t}\t\n\n\treturn vec4( 0.0, 0.0, 0.0, 0.0 );\t// should not happen\r\n}\n\nvoid main( void ) {\n\n\t// get the implied row and column from .y and .x of passed (output)\r\n\t// texture coordinate. These map directly to input texture space when\r\n\t// the relevant dimensions are the same.\r\n\tfloat row_t = outTex.y;\n\n\tfloat col_t = outTex.x;\n\n\tfloat value = get_channel_value_1540259130( A, A_channel, outTex );\n\n\tfloat relu = max( value, 0.0 );\n\n\tgl_FragColor = set_channel_value_1604150559( write_channel, relu );\n\n}"
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
var append_bias_glsl		 	= "// APPEND BIAS UNPACKED\r\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2      \toutTex;\t\t\t// texture coords of row/column to calculate\r\n\nuniform float\t\tcols;\t\t\t// number of columns\r\nuniform float\t\tcol_hstep;\t\t// half step in texture space\r\nuniform float\t\trows;\t\t\t// number of rows\r\nuniform float\t\trow_hstep;\t\t// half step in texture space\r\n\nuniform sampler2D \tA;\t\t\t\t// texture with data A\r\nuniform int\t\t\tA_channel;\t\t// channel to read data from\r\n\nuniform float\t\tA_cols;\t\t\t// number of columns\r\nuniform float\t\tA_col_hstep;\t// half step in texture space\r\n\nuniform int\t\t\twrite_channel;\t// channel to write data to\r\n\nvec2 get_indices_1540259130( float col_t, float cols, float row_t, float rows ) {\t\n\n\tfloat col_index = floor(col_t * cols);\n\n\tfloat row_index = floor(row_t * rows);\n\n\t\n\n\treturn vec2(col_index, row_index);\n\n}\n\nvec2 get_coords_1604150559( float index, float cols, float cols_hstep, float rows, float row_hstep ) {\n\n\tfloat col_index = mod( index + 0.1, cols );// +0.1 prevents rounding error in next set of ops\r\n\tfloat row_index = floor( (index + 0.1) / cols );\n\n\t\n\n\t//float index = row_index * cols + col_index;\r\n\t\n\n\treturn vec2( col_index / cols + cols_hstep, row_index / rows + row_hstep );\n\n}\n\nfloat get_channel_value_1117569599( sampler2D texture, int channel, vec2 xy ) {\t\n\n\tif ( channel == 0 ) {\n\n\t\treturn texture2D( texture, xy ).r;\n\n\t}\n\n\tif ( channel == 1 ) {\n\n\t\treturn texture2D( texture, xy ).g;\n\n\t}\n\n\tif ( channel == 2 ) {\n\n\t\treturn texture2D( texture, xy ).b;\n\n\t}\n\n\tif ( channel == 3 ) {\n\n\t\treturn texture2D( texture, xy ).a;\n\n\t}\t\n\n\treturn 0.0;\t// should not happen\r\n}\n\nvec4 set_channel_value_2281831123( int channel, float value ) {\t\n\n\tif ( channel == 0 ) {\n\n\t\treturn vec4( value, 0.0, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 1 ) {\n\n\t\treturn vec4( 0.0, value, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 2 ) {\n\n\t\treturn vec4( 0.0, 0.0, value, 0.0 );\n\n\t}\n\n\tif ( channel == 3 ) {\n\n\t\treturn vec4( 0.0, 0.0, 0.0, value );\n\n\t}\t\n\n\treturn vec4( 0.0, 0.0, 0.0, 0.0 );\t// should not happen\r\n}\n\nvoid main( void ) {\n\n\t// get the implied row and column from .y and .x of passed (output)\r\n\t// texture coordinate. These map directly to input texture space when\r\n\t// the relevant dimensions are the same.\r\n\tfloat row_t = outTex.y;\n\n\tfloat col_t = outTex.x;\n\n\t\n\n\tvec2 rowcol = get_indices_1540259130( col_t, cols, row_t, rows );\n\n\t\n\n\tfloat A_col = rowcol.x;\n\n\tfloat A_row = rowcol.y;\n\n\t\n\n\tfloat A_value = 1.0;\n\n\tif ( A_col < A_cols ) {\n\n\t\tfloat A_index = A_row * A_cols + A_col;\n\n\t\t\n\n\t\tvec2 A_st = get_coords_1604150559( A_index, A_cols, A_col_hstep, rows, row_hstep );\n\n\t\tA_value = get_channel_value_1117569599( A, A_channel, A_st );\n\n\t}\n\n\tgl_FragColor = set_channel_value_2281831123( write_channel, A_value );\n\n}"
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
Tensor.prototype.delete_ = function() {
	this.postinit()
	return Tensor_unpacked.prototype.delete_.call( this )
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
	
	texture_slot will be used to select the channel to read from in-shader
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

/*var globals	 = require('./globals')

var gl = globals.gl*/

var weblas = (typeof window !== "undefined" ? window['weblas'] : typeof global !== "undefined" ? global['weblas'] : null)
var gl = weblas.gpu.gl

function Tensor( shape, data ) {
	/*if ( shape[0] * shape[1] != data.length )
		throw new Error('Shape must check with Data size ( ' + shape[0] + '*' + shape[1] + ' != ' + data.length + ' )');*/

	var M = shape[0],
		N = shape[1]
	
	this.shape = shape
	
	this.requires_padding = N % gl.constructor.COMPONENTS_PER_TEXEL != 0	
	this.requires_encode = !gl.hasFloat
	
	this.packed = false
	
	if ( typeof data == 'undefined' || data == null || data.length == 0 ) {
		this.texture = gl.createFloatTexture( M, N, false )
		this.texture_slot = 0
	} else {
		this.texture = gl.createInputTexture( M, N, Float32Array.from( data ) )
		this.texture_slot = 0 // 0 = RED, 1 = GREEN, 2 = BLUE, 3 = ALPHA			

	}
}
module.exports = Tensor

Tensor.prototype.delete_ = function() {
	gl.context.deleteTexture( this.texture )
	this.texture = null
	this.shape = null
	
	this.requires_padding = null
	this.requires_encode = null
	this.packed = null
	this.texture_slot = null
}

Tensor.prototype.transfer = function( keep ) {
	if ( !this.packed ) {
		//throw new Error('Warning - transfer(): Unpacked texture - using download()')
		console.log('Warning - transfer(): Unpacked texture - using download()')
		return this.download( keep )
	}

	var M = this.shape[0],
		N = this.shape[1],
		out,
		result;

	if ( this.requires_encode ) {
		console.log('Warning transfer(): using float encode.')
		// create output texture
		out = gl.createOutputTexture( M, N )
		// float extraction
		gl.encode( M, N, this.texture, out )
		result = new Float32Array( gl.readData( M, N ) )
	} else {
		// direct read floats, functions deal with adjusting ouput texture format/shape
		out = gl.createFloatTexture( M, N, true )
		gl.read( M, N, this, out )
		result = gl.readFloat( M, N, true )
	}
	
	// clean up
	gl.context.deleteTexture(out);

	if ( !keep ) {
		this.delete_()
	}

	return result
}

Tensor.prototype.transpose = function( keep ) {
	var M = this.shape[0],
		N = this.shape[1]

	// create new texture to hold tranpose
	var tT
	
	if ( this.packed ) {
		tT = new weblas.pipeline.Tensor( [N, M], null )
		// invoke shader
		gl.transpose( M, N, this.texture, tT.texture )
	} else {
		tT = new weblas.unpacked.Tensor( [N, M], null )
		// invoke shader
		gl.transpose_unpacked( M, N, this, tT.texture )
	}

	if ( !keep ) {
		this.delete_()
	}

	return tT
}

/*	Facility to convert in-GPU unpacked textures to packed
 */
Tensor.prototype.pack = function() {
	if ( this.packed ) throw new Error('pack(): Tensor is already packed to an RGBA texture.')

	var M = this.shape[0],
		N = this.shape[1],
		out
	
	// create output texture	
	out = gl.createFloatTexture( M, N, true )
	// invoke shader
	gl.pack( M, N, this, out )
	// clean up
	gl.context.deleteTexture( this.texture )

	this.packed = true
	this.format = gl.context.RGBA
	this.texture_slot = null
	this.texture = out
}

/*	Facility to convert in-GPU packed textures to unpacked
	optionaly receives a slot selection - 0 by default
 */
Tensor.prototype.unpack = function( slot ) {
	if ( !this.packed ) throw new Error('unpack(): Tensor is already unpacked to an RGBA texture.')

	var M = this.shape[0],
		N = this.shape[1],
		out
	
	this.texture_slot = typeof slot == 'undefined' ? 0 : slot

	// create output texture
	out = gl.createFloatTexture( M, N, false )
	// invoke shader
	gl.unpack( M, N, this, out )
	// clean up
	gl.context.deleteTexture( this.texture )
	
	this.packed = false
	this.format = gl.context.RGBA
	this.texture = out
}

/*	Facility akin to transfer() for unpacked textures
	optionally allows to output as unpacked texture
	defaults to packed type as that is what we usually need on the CPU side
 */
Tensor.prototype.download = function( keep, unpacked ) {
	if ( this.packed ) {
		console.log('Warning - download(): Packed texture - using transfer()')
		return this.transfer( keep )
	}

	var M = this.shape[0],
		N = this.shape[1],
		out,
		result
	
	var packed = typeof unpacked == 'undefined' ? true : !unpacked
	
	// create output texture	
	out = gl.createFloatTexture( M, N, packed )
	// invoke shader
	gl.render( M, N, this, out, packed )
	result = gl.readFloat( M, N, packed )
	// clean up
	gl.context.deleteTexture( out )
	
	if ( !keep ){
		this.delete_()
	}
	return result
}

/*	Facility to clone textures, for in-GPU staged computations
	a logical duplication is insuficient since data may be updated
	and pre-update values required (ie. self addition a += b)
 */
Tensor.prototype.duplicate = function() {
	var M = this.shape[0],
		N = this.shape[1]

	// create new tensor to hold duplicate
	var clone

	if ( this.requires_encode ) {
		var duplicate = this.transfer( true )
		clone = new weblas.pipeline.Tensor( this.shape, duplicate )
	} else {
		if ( this.packed ) {
			// invoke shader
			clone = new weblas.pipeline.Tensor( this.shape, new Float32Array( M * N ) )
			gl.duplicate( M, N, this, clone.texture, true )
		} else {
			/*	we're converting to packed format for the duplication
				since LUM format can not be writen to except as a CPU-GPU upload				
				dedicated shader implementation may earn some efficiency
			*/
			this.pack()
			clone = new weblas.pipeline.Tensor( this.shape, new Float32Array( M * N ) )
			gl.duplicate( M, N, this, clone.texture, true )
			this.unpack()
			clone.unpack()
		}
	}
	return clone
}
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

/*var globals	 = require('../node_modules/weblas/lib/globals'),
WebGL	 = require('../node_modules/weblas/lib/webgl')

var gl = globals.gl*/
var gl = weblas.gpu.gl
var WebGL = weblas.gpu.gl.__proto__.constructor

// Basic shaders
var read_packed			 = "// PACKED TO PACKED (UNPADDED)\r\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2      outTex;\t// texture coords of row/column to calculate\r\nuniform sampler2D A;\t\t// texture with data from padded A\r\n\nvoid main(void) {\n\n\t// get the implied row and column from .y and .x of passed (output)\r\n\t// texture coordinate. These map directly to input texture space when\r\n\t// the relevant dimensions are the same.\r\n\t//float row_t = outTex.y;\r\n\t//float col_t = outTex.x;\r\n\t\n\n\tgl_FragColor = texture2D( A, outTex );\n\n}",
	read_packed_padded	 = "// PACKED TO PACKED (PADDED)\r\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2\t\toutTex;\t\t\t// texture coords of row/column to calculate\r\n\nuniform float\t\tcols;\t\t\t// number of columns\r\nuniform float\t\tcol_hstep;\t\t// half step in texture space\r\nuniform float\t\trows;\t\t\t// number of rows\r\nuniform float\t\trow_hstep;\t\t// half step in texture space\r\n\nuniform float\t\tup_cols;\t\t// number of unpacked columns\r\nuniform float\t\tup_col_hstep;\t// half step in texture space\r\n\nuniform float\t\tpad;\t\t\t// number of unpacked columns accounting padding\r\nuniform float\t\tup_cols_padded;\t// number of unpacked columns accounting padding\r\n\nuniform sampler2D\tA;\t\t\t\t// texture with data from padded A\r\n\nvec2 get_indices_1540259130( float col_t, float cols, float row_t, float rows ) {\t\n\n\tfloat col_index = floor(col_t * cols);\n\n\tfloat row_index = floor(row_t * rows);\n\n\t\n\n\treturn vec2(col_index, row_index);\n\n}\n\nvec2 get_coords_1604150559( float index, float cols, float cols_hstep, float rows, float row_hstep ) {\n\n\tfloat col_index = mod( index + 0.1, cols );// +0.1 prevents rounding error in next set of ops\r\n\tfloat row_index = floor( (index + 0.1) / cols );\n\n\t\n\n\t//float index = row_index * cols + col_index;\r\n\t\n\n\treturn vec2( col_index / cols + cols_hstep, row_index / rows + row_hstep );\n\n}\n\nfloat get_channel_value_1117569599( sampler2D texture, int channel, vec2 xy ) {\t\n\n\tif ( channel == 0 ) {\n\n\t\treturn texture2D( texture, xy ).r;\n\n\t}\n\n\tif ( channel == 1 ) {\n\n\t\treturn texture2D( texture, xy ).g;\n\n\t}\n\n\tif ( channel == 2 ) {\n\n\t\treturn texture2D( texture, xy ).b;\n\n\t}\n\n\tif ( channel == 3 ) {\n\n\t\treturn texture2D( texture, xy ).a;\n\n\t}\t\n\n\treturn 0.0;\t// should not happen\r\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .t and .s of passed (output) texture coordinate.\r\n\tfloat col_t = outTex.s;\n\n\tfloat row_t = outTex.t;\n\n\t\n\n\t// get the implied row and column indices\r\n\tvec2 rowcol = get_indices_1540259130( col_t, cols, row_t, rows );\n\n\t\n\n\t// this pixel index as if unpacked (up_cols = cols * 4.0)\r\n\tfloat index = rowcol.y * up_cols + rowcol.x * 4.0;\n\n\t\n\n\t// expanded indices per channel\r\n\tfloat index_r = index + 0.1;\n\n\tfloat index_g = index + 1.1;\n\n\tfloat index_b = index + 2.1;\n\n\tfloat index_a = index + 3.1;\n\n\t\n\n\t// number of padded elements(pixels) up to this index\r\n\tfloat pads_r = floor( index_r / up_cols_padded );\n\n\tfloat pads_g = floor( index_g / up_cols_padded );\n\n\tfloat pads_b = floor( index_b / up_cols_padded );\n\n\tfloat pads_a = floor( index_a / up_cols_padded );\n\n\t\n\n\t// new index accounting padding\r\n\tfloat nindex_r = index_r + pads_r * pad;\n\n\tfloat nindex_g = index_g + pads_g * pad;\n\n\tfloat nindex_b = index_b + pads_b * pad;\n\n\tfloat nindex_a = index_a + pads_a * pad;\n\n\t// new channel based on new index ( these get shifted )\r\n\tfloat nchannel_r = floor( mod( nindex_r, 4.0 ) );\n\n\tfloat nchannel_g = floor( mod( nindex_g, 4.0 ) );\n\n\tfloat nchannel_b = floor( mod( nindex_b, 4.0 ) );\n\n\tfloat nchannel_a = floor( mod( nindex_a, 4.0 ) );\n\n\t\n\n\t// can be optimized, at most 2 pixels should be read\r\n\t// get the sequence of coordinates of texture as if unpacked\r\n\tvec2 up_s = get_coords_1604150559( nindex_r, up_cols, up_col_hstep, rows, row_hstep );\n\n\tvec2 up_t = get_coords_1604150559( nindex_g, up_cols, up_col_hstep, rows, row_hstep );\n\n\tvec2 up_p = get_coords_1604150559( nindex_b, up_cols, up_col_hstep, rows, row_hstep );\n\n\tvec2 up_q = get_coords_1604150559( nindex_a, up_cols, up_col_hstep, rows, row_hstep );\n\n\t\n\n\t// read four values from texture considering the new channels \r\n\tfloat r = get_channel_value_1117569599( A, int(nchannel_r), up_s );\n\n\tfloat g = get_channel_value_1117569599( A, int(nchannel_g), up_t );\n\n\tfloat b = get_channel_value_1117569599( A, int(nchannel_b), up_p );\n\n\tfloat a = get_channel_value_1117569599( A, int(nchannel_a), up_q );\n\n\t\n\n\t//gl_FragColor = vec4( up_s.s, up_t.s, up_p.s, up_q.s );\r\n\t//gl_FragColor = vec4( nchannel_r, nchannel_g, nchannel_b, nchannel_a );\r\n\t//gl_FragColor = vec4( new_r, new_g, new_b, new_a );\r\n\tgl_FragColor = vec4( r, g, b, a );\n\n}",
	pack				 = "// UNPACKED to PACKED+UNDEFERRED\r\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2      outTex;\t// texture coords of row/column to calculate\r\n\nuniform float\t\tcols;\t\t\t// number of columns\r\nuniform float\t\tcol_hstep;\t\t// half step in texture space\r\nuniform float\t\trows;\t\t\t// number of rows\r\nuniform float\t\trow_hstep;\t\t// half step in texture space\r\n\nuniform float\t\tup_cols;\t\t// number of unpacked columns\r\nuniform float\t\tup_col_hstep;\t// half step in texture\r\n\nuniform sampler2D\tA;\t\t\t\t// texture with unpacked data A\r\nuniform int\t\t\tA_channel;\t\t// channel to read data from\r\n\nvec2 get_indices_1540259130( float col_t, float cols, float row_t, float rows ) {\t\n\n\tfloat col_index = floor(col_t * cols);\n\n\tfloat row_index = floor(row_t * rows);\n\n\t\n\n\treturn vec2(col_index, row_index);\n\n}\n\nvec2 get_coords_1604150559( float index, float cols, float cols_hstep, float rows, float row_hstep ) {\n\n\tfloat col_index = mod( index + 0.1, cols );// +0.1 prevents rounding error in next set of ops\r\n\tfloat row_index = floor( (index + 0.1) / cols );\n\n\t\n\n\t//float index = row_index * cols + col_index;\r\n\t\n\n\treturn vec2( col_index / cols + cols_hstep, row_index / rows + row_hstep );\n\n}\n\nfloat get_channel_value_1117569599( sampler2D texture, int channel, vec2 xy ) {\t\n\n\tif ( channel == 0 ) {\n\n\t\treturn texture2D( texture, xy ).r;\n\n\t}\n\n\tif ( channel == 1 ) {\n\n\t\treturn texture2D( texture, xy ).g;\n\n\t}\n\n\tif ( channel == 2 ) {\n\n\t\treturn texture2D( texture, xy ).b;\n\n\t}\n\n\tif ( channel == 3 ) {\n\n\t\treturn texture2D( texture, xy ).a;\n\n\t}\t\n\n\treturn 0.0;\t// should not happen\r\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .t and .s of passed (output) texture coordinate.\r\n\tfloat col_t = outTex.s;\n\n\tfloat row_t = outTex.t;\n\n\t\n\n\t// get the implied row and column indices\r\n\tvec2 rowcol = get_indices_1540259130( col_t, cols, row_t, rows );\n\n\t\n\n\t// unpacked row and column index (columns are multiplied by 4 channels)\r\n\tfloat up_col = rowcol.x * 4.0;\n\n\tfloat up_row = rowcol.y / rows + row_hstep;\n\n\t\n\n\t// set a sequence of four indices\r\n\tvec4 seq_col_indices = vec4( up_col, up_col + 1.0, up_col + 2.0, up_col + 3.0 );\n\n\t\n\n\t// get the sequence of coordinates of unpacked texture\r\n\tvec2 up_s = vec2( seq_col_indices.x / up_cols + up_col_hstep, up_row );\n\n\tvec2 up_t = vec2( seq_col_indices.y / up_cols + up_col_hstep, up_row );\n\n\tvec2 up_p = vec2( seq_col_indices.z / up_cols + up_col_hstep, up_row );\n\n\tvec2 up_q = vec2( seq_col_indices.w / up_cols + up_col_hstep, up_row );\n\n\t\n\n\t// read four values from unpacked texture\r\n\tfloat r = get_channel_value_1117569599( A, A_channel, up_s );\n\n\tfloat g = get_channel_value_1117569599( A, A_channel, up_t );\n\n\tfloat b = get_channel_value_1117569599( A, A_channel, up_p );\n\n\tfloat a = get_channel_value_1117569599( A, A_channel, up_q );\n\n\tgl_FragColor = vec4( r, g, b, a );\n\n}",
	unpack				 = "// PACKED+UNDEFERRED TO UNPACKED\r\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2\t\toutTex;\t\t// texture coords of row/column to calculate\r\n\nuniform float\t\tcols;\t\t\t// number of columns\r\nuniform float\t\tcol_hstep;\t\t// half step in texture space\r\nuniform float\t\trows;\t\t\t// number of rows\r\nuniform float\t\trow_hstep;\t\t// half step in texture space\r\n\nuniform float\t\tp_cols;\t\t\t// number of packed columns\r\nuniform float\t\tp_col_hstep;\t// half step in texture space\r\n\nuniform sampler2D\tA;\t\t\t\t// texture with single channel data from A\r\n\nuniform int\t\t\twrite_channel;\t// channel to write texture to\r\n\nvec2 get_indices_1540259130( float col_t, float cols, float row_t, float rows ) {\t\n\n\tfloat col_index = floor(col_t * cols);\n\n\tfloat row_index = floor(row_t * rows);\n\n\t\n\n\treturn vec2(col_index, row_index);\n\n}\n\nvec2 get_coords_1604150559( float index, float cols, float cols_hstep, float rows, float row_hstep ) {\n\n\tfloat col_index = mod( index + 0.1, cols );// +0.1 prevents rounding error in next set of ops\r\n\tfloat row_index = floor( (index + 0.1) / cols );\n\n\t\n\n\t//float index = row_index * cols + col_index;\r\n\t\n\n\treturn vec2( col_index / cols + cols_hstep, row_index / rows + row_hstep );\n\n}\n\nfloat get_channel_value_1117569599( sampler2D texture, int channel, vec2 xy ) {\t\n\n\tif ( channel == 0 ) {\n\n\t\treturn texture2D( texture, xy ).r;\n\n\t}\n\n\tif ( channel == 1 ) {\n\n\t\treturn texture2D( texture, xy ).g;\n\n\t}\n\n\tif ( channel == 2 ) {\n\n\t\treturn texture2D( texture, xy ).b;\n\n\t}\n\n\tif ( channel == 3 ) {\n\n\t\treturn texture2D( texture, xy ).a;\n\n\t}\t\n\n\treturn 0.0;\t// should not happen\r\n}\n\nvec4 set_channel_value_2281831123( int channel, float value ) {\t\n\n\tif ( channel == 0 ) {\n\n\t\treturn vec4( value, 0.0, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 1 ) {\n\n\t\treturn vec4( 0.0, value, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 2 ) {\n\n\t\treturn vec4( 0.0, 0.0, value, 0.0 );\n\n\t}\n\n\tif ( channel == 3 ) {\n\n\t\treturn vec4( 0.0, 0.0, 0.0, value );\n\n\t}\t\n\n\treturn vec4( 0.0, 0.0, 0.0, 0.0 );\t// should not happen\r\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .t and .s of passed (output) texture coordinate.\r\n\tfloat col_t = outTex.s;\n\n\tfloat row_t = outTex.t;\n\n\t\n\n\tvec2 rowcol = get_indices_1540259130( col_t, cols, row_t, rows );\n\n\tfloat p_col_index = floor( rowcol.x / 4.0 );\t\n\n\tfloat p_index = floor( rowcol.y * p_cols + p_col_index ); //  + 0.1\r\n\t\n\n\tint A_channel = int( mod( rowcol.x, 4.0 ) );\n\n\tvec2 packed_st = get_coords_1604150559( p_index, p_cols, p_col_hstep, rows, row_hstep );\t\n\n\tfloat value = get_channel_value_1117569599( A, A_channel, packed_st );\n\n\t\n\n\tgl_FragColor = set_channel_value_2281831123( write_channel, value );\n\n}\n\n",
	render_packed		 = "// UNPACKED to PACKED+DEFERRED\r\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2\t\toutTex;\t\t\t// texture coords of row/column to calculate\r\n\nuniform float\t\tcols;\t\t\t// number of columns\r\nuniform float\t\tcol_hstep;\t\t// half step in texture space\r\nuniform float\t\trows;\t\t\t// number of rows\r\nuniform float\t\trow_hstep;\t\t// half step in texture space\r\n\nuniform float\t\tup_cols;\t\t// number of unpacked columns\r\nuniform float\t\tup_col_hstep;\t// half step in texture space\r\nuniform float\t\tup_cols_padded;\t// number of unpacked columns accounting padding\r\n\nuniform sampler2D\tA;\t\t\t\t// texture with single channel data\r\nuniform int\t\t\tA_channel;\t\t// channel to read data from\r\n\nvec2 get_indices_1540259130( float col_t, float cols, float row_t, float rows ) {\t\n\n\tfloat col_index = floor(col_t * cols);\n\n\tfloat row_index = floor(row_t * rows);\n\n\t\n\n\treturn vec2(col_index, row_index);\n\n}\n\nvec2 get_coords_1604150559( float index, float cols, float cols_hstep, float rows, float row_hstep ) {\n\n\tfloat col_index = mod( index + 0.1, cols );// +0.1 prevents rounding error in next set of ops\r\n\tfloat row_index = floor( (index + 0.1) / cols );\n\n\t\n\n\t//float index = row_index * cols + col_index;\r\n\t\n\n\treturn vec2( col_index / cols + cols_hstep, row_index / rows + row_hstep );\n\n}\n\nfloat get_channel_value_1117569599( sampler2D texture, int channel, vec2 xy ) {\t\n\n\tif ( channel == 0 ) {\n\n\t\treturn texture2D( texture, xy ).r;\n\n\t}\n\n\tif ( channel == 1 ) {\n\n\t\treturn texture2D( texture, xy ).g;\n\n\t}\n\n\tif ( channel == 2 ) {\n\n\t\treturn texture2D( texture, xy ).b;\n\n\t}\n\n\tif ( channel == 3 ) {\n\n\t\treturn texture2D( texture, xy ).a;\n\n\t}\t\n\n\treturn 0.0;\t// should not happen\r\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .t and .s of passed (output) texture coordinate.\r\n\tfloat col_t = outTex.s;\n\n\tfloat row_t = outTex.t;\n\n\t\n\n\t// get the implied row and column indices\r\n\tvec2 rowcol = get_indices_1540259130( col_t, cols, row_t, rows );\n\n\t\n\n\t// unpacked index (columns are multiplied by 4 channels)\r\n\tfloat up_index = rowcol.y * cols * 4.0 + rowcol.x * 4.0;\n\n\t\n\n\t// set a sequence of four indices\r\n\tvec4 seq_indices = vec4( up_index, up_index + 1.0, up_index + 2.0, up_index + 3.0 );\n\n\t\n\n\t// get the sequence of coordinates of unpacked texture\r\n\tvec2 up_s = get_coords_1604150559( seq_indices.x, up_cols_padded, up_col_hstep, rows, row_hstep );\n\n\tvec2 up_t = get_coords_1604150559( seq_indices.y, up_cols_padded, up_col_hstep, rows, row_hstep );\n\n\tvec2 up_p = get_coords_1604150559( seq_indices.z, up_cols_padded, up_col_hstep, rows, row_hstep );\n\n\tvec2 up_q = get_coords_1604150559( seq_indices.w, up_cols_padded, up_col_hstep, rows, row_hstep );\n\n\t\n\n\t// read four values from unpacked texture\r\n\tfloat r = get_channel_value_1117569599( A, A_channel, up_s );\n\n\tfloat g = get_channel_value_1117569599( A, A_channel, up_t );\n\n\tfloat b = get_channel_value_1117569599( A, A_channel, up_p );\n\n\tfloat a = get_channel_value_1117569599( A, A_channel, up_q );\n\n\tgl_FragColor = vec4( r, g, b, a );\n\n}\n\n",
	render_unpacked		 = "// UNPACKED to UNPACKED\r\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2      outTex;\t// texture coords of row/column to calculate\r\nuniform sampler2D A;\t\t// texture with data from padded A\r\n\nvoid main(void) {\n\n\t// get the implied row and column from .y and .x of passed (output)\r\n\t// texture coordinate. These map directly to input texture space when\r\n\t// the relevant dimensions are the same.\r\n\t//float row_t = outTex.y;\r\n\t//float col_t = outTex.x;\r\n\t\n\n\tgl_FragColor = texture2D( A, outTex );\n\n}",
	duplicate			 = "// PACKED TO PACKED (UNPADDED)\r\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2      outTex;\t// texture coords of row/column to calculate\r\nuniform sampler2D A;\t\t// texture with data from padded A\r\n\nvoid main(void) {\t\n\n\tgl_FragColor = texture2D( A, outTex );\n\n}",
	transpose_unpacked	 = "// TRANSPOSE UNPACKED\r\nprecision highp float;\n#define GLSLIFY 1\n\nvarying vec2      \toutTex;\t\t\t// texture coords of row/column to calculate\r\nuniform sampler2D \tA;\t\t\t\t// texture with data from padded A\r\nuniform int\t\t\tA_channel;\t\t// channel to read data from\r\n\nfloat get_channel_value_1540259130( sampler2D texture, int channel, vec2 xy ) {\t\n\n\tif ( channel == 0 ) {\n\n\t\treturn texture2D( texture, xy ).r;\n\n\t}\n\n\tif ( channel == 1 ) {\n\n\t\treturn texture2D( texture, xy ).g;\n\n\t}\n\n\tif ( channel == 2 ) {\n\n\t\treturn texture2D( texture, xy ).b;\n\n\t}\n\n\tif ( channel == 3 ) {\n\n\t\treturn texture2D( texture, xy ).a;\n\n\t}\t\n\n\treturn 0.0;\t// should not happen\r\n}\n\nvec4 set_channel_value_1604150559( int channel, float value ) {\t\n\n\tif ( channel == 0 ) {\n\n\t\treturn vec4( value, 0.0, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 1 ) {\n\n\t\treturn vec4( 0.0, value, 0.0, 0.0 );\n\n\t}\n\n\tif ( channel == 2 ) {\n\n\t\treturn vec4( 0.0, 0.0, value, 0.0 );\n\n\t}\n\n\tif ( channel == 3 ) {\n\n\t\treturn vec4( 0.0, 0.0, 0.0, value );\n\n\t}\t\n\n\treturn vec4( 0.0, 0.0, 0.0, 0.0 );\t// should not happen\r\n}\n\nvoid main(void) {\n\n\t// get the implied row and column from .y and .x of passed (output)\r\n\t// texture coordinate. These map directly to input texture space when\r\n\t// the relevant dimensions are the same.\r\n\t//float row_t = outTex.y;\r\n\t//float col_t = outTex.x;\r\n\t\n\n\tfloat value = get_channel_value_1540259130( A, A_channel, vec2( outTex.y, outTex.x ) );\n\n\t\n\n\tgl_FragColor = set_channel_value_1604150559( A_channel, value );\n\n}"

	gl.read_packed_program			 = gl.createProgram( read_packed )
	gl.read_packed_padded_program	 = gl.createProgram( read_packed_padded )
	gl.pack_program					 = gl.createProgram( pack )
	gl.unpack_program				 = gl.createProgram( unpack )
	gl.render_packed_program		 = gl.createProgram( render_packed )
	gl.render_unpacked_program		 = gl.createProgram( render_unpacked )
	gl.duplicate_program			 = gl.createProgram( duplicate )
	gl.transpose_unpacked_program	 = gl.createProgram( transpose_unpacked )

/*	direct texture float data read (no float encode) - requires OES_texture_float support
 */
WebGL.prototype.read = function( M, N, tensor, out ) {
	this.program = tensor.requires_padding ? this.read_packed_padded_program : this.read_packed_program
	this.selectProgram(this.program)
	
	var W = Math.ceil( N / WebGL.COMPONENTS_PER_TEXEL )
	var H = M
	
	if ( tensor.requires_padding ) {	
		// number of columns
		this.bindUniform( 'uniform1f', W, 'cols' )
		this.bindUniform( 'uniform1f', (1 / W) * 0.5, 'col_hstep' )
		// number of rows
		this.bindUniform( 'uniform1f', H, 'rows')
		this.bindUniform( 'uniform1f', (1 / H) * 0.5, 'row_hstep' )
		
		// number of unpacked columns
		this.bindUniform( 'uniform1f', W * 4, 'up_cols' )
		this.bindUniform( 'uniform1f', ( 1.0 / (W * 4) ) * 0.5, 'up_col_hstep' )
		
		// padding
		var pad = W * WebGL.COMPONENTS_PER_TEXEL - N
		this.bindUniform( 'uniform1f', pad, 'pad' )
		this.bindUniform( 'uniform1f', W * 4 - pad, 'up_cols_padded' )
	}

	this.bindInputTexture( tensor.texture, this.context.TEXTURE0, 'A' )

	this.bindOutputTexture( H, W, out )

	this.context.drawElements( this.context.TRIANGLES, /*num items*/6, this.context.UNSIGNED_SHORT, 0 )

	this.unbindInputTexture( this.context.TEXTURE0 )
}

/*	used to convert a unpacked texture into a packed texture
 */
WebGL.prototype.pack = function( M, N, tensor, out ) {
	this.program = this.pack_program
	this.selectProgram( this.program )
	
	var W = Math.ceil( N / WebGL.COMPONENTS_PER_TEXEL )
	var H = M
	// number of columns
	this.bindUniform( 'uniform1f', W, 'cols' )
	this.bindUniform( 'uniform1f', (1 / W) * 0.5, 'col_hstep' )
	// number of rows
	this.bindUniform( 'uniform1f', H, 'rows')
	this.bindUniform( 'uniform1f', (1 / H) * 0.5, 'row_hstep' )
	
	// number of unpacked columns
	this.bindUniform( 'uniform1f', N, 'up_cols' )
	this.bindUniform( 'uniform1f', ( 1.0 / N ) * 0.5, 'up_col_hstep' )
	
	this.bindInputTexture( tensor.texture, this.context.TEXTURE0, 'A' )
	
	this.bindUniform( 'uniform1i', tensor.texture_slot, 'A_channel' )

	this.bindOutputTexture( H, W, out )

	this.context.drawElements( this.context.TRIANGLES, /*num items*/6, this.context.UNSIGNED_SHORT, 0 )

	this.unbindInputTexture( this.context.TEXTURE0 )
}

/*	used to convert a packed texture (data is held in all RGBA channels)
	into an unpacked texture (data is held in a selected channel)
 */
WebGL.prototype.unpack = function( M, N, tensor, out ) {
	this.program = this.unpack_program
	this.selectProgram( this.program )
	
	var W = N
	var H = M
	
	// number of columns
	this.bindUniform( 'uniform1f', W, 'cols' )
	this.bindUniform( 'uniform1f', (1 / W) * 0.5, 'col_hstep' )
	// number of rows
	this.bindUniform( 'uniform1f', H, 'rows')
	this.bindUniform( 'uniform1f', (1 / H) * 0.5, 'row_hstep' )
	
	// number of packed columns
	this.bindUniform( 'uniform1f', Math.ceil( W / 4 ), 'p_cols' )
	this.bindUniform( 'uniform1f', ( 1.0 / Math.ceil( W / 4 ) ) * 0.5, 'p_col_hstep' )
	
	this.bindInputTexture( tensor.texture, this.context.TEXTURE0, 'A' )

	this.bindUniform( 'uniform1i', tensor.texture_slot, 'write_channel' )

	this.bindOutputTexture( H, W, out )

	this.context.drawElements( this.context.TRIANGLES, /*num items*/6, this.context.UNSIGNED_SHORT, 0 )

	this.unbindInputTexture( this.context.TEXTURE0 )
}

/*	unpacked float texture read, allows output as packed+deferred or unpacked
 */
WebGL.prototype.render = function( M, N, tensor, out, packed ) {
	this.program = packed ? this.render_packed_program : this.render_unpacked_program
	this.selectProgram( this.program )
	
	var W = packed ? Math.ceil( N / WebGL.COMPONENTS_PER_TEXEL ) : N
	var H = M
	
	if ( packed ) {
		// number of columns
		this.bindUniform( 'uniform1f', W, 'cols' )
		this.bindUniform( 'uniform1f', (1 / W) * 0.5, 'col_hstep' )
		// number of rows
		this.bindUniform( 'uniform1f', H, 'rows')
		this.bindUniform( 'uniform1f', (1 / H) * 0.5, 'row_hstep' )

		// number of unpacked columns		
		this.bindUniform( 'uniform1f', W * 4, 'up_cols' )
		this.bindUniform( 'uniform1f', ( 1.0 / (W * 4) ) * 0.5, 'up_col_hstep' )

		// number of unpacked columns accounting padding
		var pad = Math.ceil( N / WebGL.COMPONENTS_PER_TEXEL ) * WebGL.COMPONENTS_PER_TEXEL - N
		this.bindUniform( 'uniform1f', W * 4 - pad, 'up_cols_padded' )
	}
	
	this.bindInputTexture( tensor.texture, this.context.TEXTURE0, 'A' )
	
	this.bindUniform( 'uniform1i', tensor.texture_slot, 'A_channel' )

	this.bindOutputTexture( H, W, out )

	this.context.drawElements( this.context.TRIANGLES, /*num items*/6, this.context.UNSIGNED_SHORT, 0 )

	this.unbindInputTexture( this.context.TEXTURE0 )
}

/*	duplicate texture (use in iterative calculations)
 */
WebGL.prototype.duplicate = function( M, N, tensor, out, packed ) {
	this.program = this.duplicate_program
	this.selectProgram( this.program )
	
	var W = packed ? Math.ceil( N / WebGL.COMPONENTS_PER_TEXEL ) : N
	var H = M
	
	this.bindInputTexture( tensor.texture, this.context.TEXTURE0, 'A' )

	this.bindOutputTexture( H, W, out )

	this.context.drawElements( this.context.TRIANGLES, /*num items*/6, this.context.UNSIGNED_SHORT, 0 )

	this.unbindInputTexture( this.context.TEXTURE0 )
}

/* tranpose a texture where input has M rows and N columns
 */
WebGL.prototype.transpose_unpacked = function( M, N, tensor, out ) {
	this.program = this.transpose_unpacked_program
	this.selectProgram( this.program )

	var W = M
	var H = N

	this.bindInputTexture( tensor.texture, this.context.TEXTURE0, 'A' )

	this.bindUniform( 'uniform1i', tensor.texture_slot, 'A_channel' )

	this.bindOutputTexture( H, W, out )

	this.context.drawElements( this.context.TRIANGLES, /*num items*/6, this.context.UNSIGNED_SHORT, 0 )

	this.unbindInputTexture( this.context.TEXTURE0 )
}

/* create LUMINANCE texture of width w from given texels
   if texels is null, an empty texture is created.
 */
WebGL.prototype.createInputTexture = function( height, width, texels ) {
	var gl = this.context

	// create the texture from our floats
	var texture = gl.createTexture()

	gl.bindTexture( gl.TEXTURE_2D, texture )
	
	gl.texImage2D( gl.TEXTURE_2D, 0, gl.LUMINANCE, width, height, 0, gl.LUMINANCE, gl.FLOAT, texels)
	
	// clamp to edge to support non-power of two textures
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE )
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE )

	// don't interpolate when getting data from texture
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST )
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST )

	// we're done with setup, so unbind current texture
	gl.bindTexture( gl.TEXTURE_2D, null )

	return texture;
}

WebGL.prototype.createFloatTexture = function( M, N, packed ) {
	var gl = this.context;
	
	var W = packed ? Math.ceil( N / WebGL.COMPONENTS_PER_TEXEL ) : N
	var H = M

	// create the texture from our floats
	var texture = gl.createTexture()

	gl.bindTexture( gl.TEXTURE_2D, texture )
	
	gl.texImage2D( gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.FLOAT, null)
	
	// clamp to edge to support non-power of two textures
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE )
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE )

	// don't interpolate when getting data from texture
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
	gl.texParameteri( gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)

	// we're done with setup, so unbind current texture
	gl.bindTexture( gl.TEXTURE_2D, null )

	return texture
}

/* Read data out as floats */
WebGL.prototype.readFloat = function( M, N, packed ) {
	var gl = this.context;

	var W = packed ? Math.ceil( N / WebGL.COMPONENTS_PER_TEXEL ) : N
	var size = M * W * Float32Array.BYTES_PER_ELEMENT * WebGL.COMPONENTS_PER_TEXEL

	// create destination buffer
	var rawbuffer = new ArrayBuffer( size )
	
	var readBuffer = new Float32Array( rawbuffer )
	gl.readPixels( 0, 0, W, M, gl.RGBA, gl.FLOAT, readBuffer )

	var sub_end = ( size - M * N * Float32Array.BYTES_PER_ELEMENT ) / WebGL.COMPONENTS_PER_TEXEL
	
	// !!?? subarray() must use negative indexes of the relevant part else the full typed array is returned
	// Must use negative indexes
	return !packed || sub_end == 0 ? readBuffer : readBuffer.subarray( -size, -sub_end )
}

/* uniform binding one-liner */
WebGL.prototype.bindUniform = function( type, data, name ) {
	var uniform_gl = this.context.getUniformLocation( this.program, name )
	this.context[type]( uniform_gl, data )
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
	
	texture_slot will be used to select the channel to read from in-shader
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

weblas.unpacked = {
	'Tensor'	: tensor_unpacked,
	'blas'		: blas_addon,
	'nn'		: nn_addon
}

module.exports = {
	'Tensor'	: tensor_unpacked,
	'blas'		: blas_addon,
	'nn'		: nn_addon
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./lib/blas_addon":1,"./lib/nn_addon":2,"./lib/tensor_addin":3,"./lib/tensor_unpacked":4,"./lib/webgl_addin":5}]},{},[6])(6)
});