import * as THREE from 'three';

// three r186 removed PCFSoftShadowMap; its PCF path takes only 5 Vogel-disk taps,
// which dithers visibly at the wide radii a paper "shadow halo" needs. We keep
// hardware-filtered PCF but take up to 16 taps (≈64 filtered comparisons) inside
// penumbrae, so every layer gets a smooth, soft halo on the flat behind it — far
// cheaper than VSM blurring a 4096² map on a software renderer.

export const PCF_TAPS = 16;

let patched = false;
export const patchSoftShadows = () => {
  if (patched) return;
  patched = true;
  const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  const re = /shadow = \(\s*texture\( shadowMap, vec3\( shadowCoord\.xy \+ vogelDiskSample\( 0, 5, phi \) \* radius, shadowCoord\.z \) \)[\s\S]*?\) \* 0\.2;/;
  if (!re.test(chunk)) {
    console.warn('Paper Birds: PCF shadow chunk not found; using stock 5-tap PCF');
    return;
  }
  THREE.ShaderChunk.shadowmap_pars_fragment = chunk.replace(
    re,
    `// adaptive soft PCF: probe the centre and the rim of the kernel first; only
				// inside a penumbra take the full Vogel disk (16 taps for the 4096 key light,
				// 8 for the small spot maps). Fully lit / fully shadowed paper stays cheap.
				float pr = radius * 0.92;
				float probe = texture( shadowMap, vec3( shadowCoord.xy, shadowCoord.z ) )
					+ texture( shadowMap, vec3( shadowCoord.xy + vec2( pr, 0.0 ), shadowCoord.z ) )
					+ texture( shadowMap, vec3( shadowCoord.xy - vec2( pr, 0.0 ), shadowCoord.z ) )
					+ texture( shadowMap, vec3( shadowCoord.xy + vec2( 0.0, pr ), shadowCoord.z ) )
					+ texture( shadowMap, vec3( shadowCoord.xy - vec2( 0.0, pr ), shadowCoord.z ) );
				if ( probe < 0.001 || probe > 4.999 ) {
					shadow = probe * 0.2;
				} else {
					shadow = 0.0;
					int taps = shadowMapSize.x > 3000.0 ? ${PCF_TAPS} : ${PCF_TAPS / 2};
					for ( int i = 0; i < ${PCF_TAPS}; i ++ ) {
						if ( i >= taps ) break;
						shadow += texture( shadowMap, vec3( shadowCoord.xy + vogelDiskSample( i, taps, phi ) * radius, shadowCoord.z ) );
					}
					shadow /= float( taps );
				}`,
  );
};
