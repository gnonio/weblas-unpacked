// PACKED TO PACKED (UNPADDED)
precision highp float;

varying vec2      outTex;	// texture coords of row/column to calculate
uniform sampler2D A;		// texture with data from padded A

void main(void) {

	// get the implied row and column from .y and .x of passed (output)
	// texture coordinate. These map directly to input texture space when
	// the relevant dimensions are the same.
	//float row_t = outTex.y;
	//float col_t = outTex.x;
	
	gl_FragColor = texture2D( A, outTex );
}