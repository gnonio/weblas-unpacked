// TRANSPOSE UNPACKED
precision highp float;

varying vec2      	outTex;			// texture coords of row/column to calculate
uniform sampler2D 	A;				// texture with data from padded A
uniform int			A_channel;		// channel to read data from

uniform int			write_channel;	// channel to write texture to

#pragma glslify: get_channel_value = require(./get_channel_value)
#pragma glslify: set_channel_value = require(./set_channel_value)

void main(void) {
	
	float value = get_channel_value( A, A_channel, vec2( outTex.y, outTex.x ) );
	
	gl_FragColor = set_channel_value( write_channel, value );
}