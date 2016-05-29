// RELU UNPACKED
precision highp float;

varying vec2      	UVs;			// texture coords of row/column to calculate

uniform sampler2D 	A;				// texture with data A
uniform int			A_channel;		// channel to read data from

uniform int			write_channel;	// channel to write data to

#pragma glslify: get_channel_value = require(../get_channel_value)
#pragma glslify: set_channel_value = require(../set_channel_value)

void main( void ) {

	// get the implied row and column from .y and .x of passed (output)
	// texture coordinate. These map directly to input texture space when
	// the relevant dimensions are the same.
	float row_t = UVs.y;
	float col_t = UVs.x;

	float value = get_channel_value( A, A_channel, UVs );
	float relu = max( value, 0.0 );

	gl_FragColor = set_channel_value( write_channel, relu );
}