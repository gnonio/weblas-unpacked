// DOTPRODUCT UNPACKED
precision highp float;
precision highp int;

varying vec2      	UVs;			// texture coords of row/column to calculate

uniform int			K;				// 
uniform float		K_step;			// 
uniform float		K_hstep;		// 

uniform float		alpha;			// 

uniform sampler2D 	A;				// texture with data A
uniform int			A_channel;		// channel to read data from

uniform sampler2D 	B;				// texture with data B
uniform int			B_channel;		// channel to read data from

uniform int			write_channel;	// channel to write data to

#pragma glslify: get_channel_value = require(../get_channel_value)
#pragma glslify: set_channel_value = require(../set_channel_value)

void main( void ) {
	float row_t = UVs.y;
	float col_t = UVs.x;
	
	float hstep = K_hstep;// position for shared dimension on source textures
	float sum = 0.0;
	for ( int l = 0 ; l < 4096 ; ++l ) {
		if ( l >= K ) break;    // stop when we finish the row/column
		// l is in pixel space, so we divide by four

		// read value from each texture
		float a_ik = get_channel_value( A, A_channel, vec2( hstep, row_t ) );
		float b_kj = get_channel_value( B, B_channel, vec2( col_t, hstep ) );

		sum += a_ik * b_kj;
		hstep += K_step;
	}

	gl_FragColor = set_channel_value( write_channel, alpha * sum );
}