// APPEND BIAS UNPACKED
precision highp float;

varying vec2      	UVs;			// texture coords of row/column to calculate

uniform float		cols;			// number of columns
uniform float		col_hstep;		// half step in texture space
uniform float		rows;			// number of rows
uniform float		row_hstep;		// half step in texture space

uniform sampler2D 	A;				// texture with data A
uniform int			A_channel;		// channel to read data from

uniform float		A_cols;			// number of columns
uniform float		A_col_hstep;	// half step in texture space

uniform int			write_channel;	// channel to write data to

#pragma glslify: get_indices = require(../get_indices)
#pragma glslify: get_coords = require(../get_coords)
#pragma glslify: get_channel_value = require(../get_channel_value)
#pragma glslify: set_channel_value = require(../set_channel_value)

void main( void ) {

	// get the implied row and column from .y and .x of passed (output)
	// texture coordinate. These map directly to input texture space when
	// the relevant dimensions are the same.
	float row_t = UVs.y;
	float col_t = UVs.x;
	
	vec2 rowcol = get_indices( col_t, cols, row_t, rows );
	
	float A_col = rowcol.x;
	float A_row = rowcol.y;
	
	float A_value = 1.0;
	if ( A_col < A_cols ) {
		float A_index = A_row * A_cols + A_col;
		
		vec2 A_st = get_coords( A_index, A_cols, A_col_hstep, rows, row_hstep );

		A_value = get_channel_value( A, A_channel, A_st );
	}

	gl_FragColor = set_channel_value( write_channel, A_value );
}