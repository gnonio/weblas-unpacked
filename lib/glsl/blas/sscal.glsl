// SSCAL UNPACKED
precision highp float;
precision highp int;

varying vec2      	outTex;			// texture coords of row/column to calculate

uniform float		alpha;			// scalar

uniform sampler2D 	X;				// texture with data X
uniform int			X_channel;		// channel to read data from

uniform int			write_channel;	// channel to write data to

#pragma glslify: get_channel_value = require(../get_channel_value)
#pragma glslify: set_channel_value = require(../set_channel_value)

void main( void ) {
	
	float x_value = get_channel_value( X, X_channel, outTex );

	gl_FragColor = set_channel_value( write_channel, alpha * x_value );
}