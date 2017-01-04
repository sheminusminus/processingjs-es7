// Noise functions and helpers
export default function PerlinNoise(seed) {
  var rnd = seed !== undef ? new Marsaglia(seed, (seed<<16)+(seed>>16)) : Marsaglia.createRandomized();
  var i, j;
  // http://www.noisemachine.com/talk1/17b.html
  // http://mrl.nyu.edu/~perlin/noise/
  // generate permutation
  var perm = new Uint8Array(512);
  for(i=0;i<256;++i) { perm[i] = i; }
  for(i=0;i<256;++i) {
    // NOTE: we can only do this because we've made sure the Marsaglia generator
    //       gives us numbers where the last byte in a pseudo-random number is
    //       still pseudo-random. If no 2nd argument is passed in the constructor,
    //       that is no longer the case and this pair swap will always run identically.
    var t = perm[j = rnd.intGenerator() & 0xFF];
    perm[j] = perm[i];
    perm[i] = t;
  }
  // copy to avoid taking mod in perm[0];
  for(i=0;i<256;++i) { perm[i + 256] = perm[i]; }

  function grad3d(i,x,y,z) {
    var h = i & 15; // convert into 12 gradient directions
    var u = h<8 ? x : y,
        v = h<4 ? y : h===12||h===14 ? x : z;
    return ((h&1) === 0 ? u : -u) + ((h&2) === 0 ? v : -v);
  }

  function grad2d(i,x,y) {
    var v = (i & 1) === 0 ? x : y;
    return (i&2) === 0 ? -v : v;
  }

  function grad1d(i,x) {
    return (i&1) === 0 ? -x : x;
  }

  function lerp(t,a,b) { return a + t * (b - a); }

  this.noise3d = function(x, y, z) {
    var X = Math.floor(x)&255, Y = Math.floor(y)&255, Z = Math.floor(z)&255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    var fx = (3-2*x)*x*x, fy = (3-2*y)*y*y, fz = (3-2*z)*z*z;
    var p0 = perm[X]+Y, p00 = perm[p0] + Z, p01 = perm[p0 + 1] + Z,
        p1 = perm[X + 1] + Y, p10 = perm[p1] + Z, p11 = perm[p1 + 1] + Z;
    return lerp(fz,
      lerp(fy, lerp(fx, grad3d(perm[p00], x, y, z), grad3d(perm[p10], x-1, y, z)),
               lerp(fx, grad3d(perm[p01], x, y-1, z), grad3d(perm[p11], x-1, y-1,z))),
      lerp(fy, lerp(fx, grad3d(perm[p00 + 1], x, y, z-1), grad3d(perm[p10 + 1], x-1, y, z-1)),
               lerp(fx, grad3d(perm[p01 + 1], x, y-1, z-1), grad3d(perm[p11 + 1], x-1, y-1,z-1))));
  }

  this.noise2d = function(x, y) {
    var X = Math.floor(x)&255, Y = Math.floor(y)&255;
    x -= Math.floor(x); y -= Math.floor(y);
    var fx = (3-2*x)*x*x, fy = (3-2*y)*y*y;
    var p0 = perm[X]+Y, p1 = perm[X + 1] + Y;
    return lerp(fy,
      lerp(fx, grad2d(perm[p0], x, y), grad2d(perm[p1], x-1, y)),
      lerp(fx, grad2d(perm[p0 + 1], x, y-1), grad2d(perm[p1 + 1], x-1, y-1)));
  }

  this.noise1d = function(x) {
    var X = Math.floor(x)&255;
    x -= Math.floor(x);
    var fx = (3-2*x)*x*x;
    return lerp(fx, grad1d(perm[X], x), grad1d(perm[X+1], x-1));
  }
};
