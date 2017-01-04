import Marsaglia from "./Marsaglia";
import PerlinNoise from "./PerlinNoise";

let noiseProfile = {
  generator: undefined,
  octaves: 4,
  fallout: 0.5,
  seed: undefined
};

let internalRandomGenerator = Math.random;

class ProcessingMath {
  /**
  * Constrains a value to not exceed a maximum and minimum value.
  *
  * @param {int|float} value   the value to constrain
  * @param {int|float} value   minimum limit
  * @param {int|float} value   maximum limit
  *
  * @returns {int|float}
  *
  * @see max
  * @see min
  */
  constrain(aNumber, aMin, aMax) {
    return aNumber > aMax ? aMax : aNumber < aMin ? aMin : aNumber;
  }

  /**
  * Calculates the distance between two points.
  *
  * @param {int|float} x1     int or float: x-coordinate of the first point
  * @param {int|float} y1     int or float: y-coordinate of the first point
  * @param {int|float} z1     int or float: z-coordinate of the first point
  * @param {int|float} x2     int or float: x-coordinate of the second point
  * @param {int|float} y2     int or float: y-coordinate of the second point
  * @param {int|float} z2     int or float: z-coordinate of the second point
  *
  * @returns {float}
  */
  dist() {
    var dx, dy, dz;
    if (arguments.length === 4) {
      dx = arguments[0] - arguments[2];
      dy = arguments[1] - arguments[3];
      return Math.sqrt(dx * dx + dy * dy);
    }
    if (arguments.length === 6) {
      dx = arguments[0] - arguments[3];
      dy = arguments[1] - arguments[4];
      dz = arguments[2] - arguments[5];
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
  }

  /**
  * Calculates a number between two numbers at a specific increment. The amt  parameter is the
  * amount to interpolate between the two values where 0.0 equal to the first point, 0.1 is very
  * near the first point, 0.5 is half-way in between, etc. The lerp function is convenient for
  * creating motion along a straight path and for drawing dotted lines.
  *
  * @param {int|float} value1       float or int: first value
  * @param {int|float} value2       float or int: second value
  * @param {int|float} amt          float: between 0.0 and 1.0
  *
  * @returns {float}
  *
  * @see curvePoint
  * @see bezierPoint
  */
  lerp(value1, value2, amt) {
    return ((value2 - value1) * amt) + value1;
  }

  /**
  * Calculates the magnitude (or length) of a vector. A vector is a direction in space commonly
  * used in computer graphics and linear algebra. Because it has no "start" position, the magnitude
  * of a vector can be thought of as the distance from coordinate (0,0) to its (x,y) value.
  * Therefore, mag() is a shortcut for writing "dist(0, 0, x, y)".
  *
  * @param {int|float} a       float or int: first value
  * @param {int|float} b       float or int: second value
  * @param {int|float} c       float or int: third value
  *
  * @returns {float}
  *
  * @see dist
  */
  mag(a, b, c) {
    if (c) {
      return Math.sqrt(a * a + b * b + c * c);
    }

    return Math.sqrt(a * a + b * b);
  }

  /**
  * Re-maps a number from one range to another. In the example above, the number '25' is converted from
  * a value in the range 0..100 into a value that ranges from the left edge (0) to the right edge (width) of the screen.
  * Numbers outside the range are not clamped to 0 and 1, because out-of-range values are often intentional and useful.
  *
  * @param {float} value        The incoming value to be converted
  * @param {float} istart       Lower bound of the value's current range
  * @param {float} istop        Upper bound of the value's current range
  * @param {float} ostart       Lower bound of the value's target range
  * @param {float} ostop        Upper bound of the value's target range
  *
  * @returns {float}
  *
  * @see norm
  * @see lerp
  */
  map(value, istart, istop, ostart, ostop) {
    return ostart + (ostop - ostart) * ((value - istart) / (istop - istart));
  }

  /**
  * Determines the largest value in a sequence of numbers.
  *
  * @param {int|float} value1         int or float
  * @param {int|float} value2         int or float
  * @param {int|float} value3         int or float
  * @param {int|float} array          int or float array
  *
  * @returns {int|float}
  *
  * @see min
  */
  max() {
    if (arguments.length === 2) {
      return arguments[0] < arguments[1] ? arguments[1] : arguments[0];
    }
    var numbers = arguments.length === 1 ? arguments[0] : arguments; // if single argument, array is used
    if (! ("length" in numbers && numbers.length > 0)) {
      throw "Non-empty array is expected";
    }
    var max = numbers[0],
      count = numbers.length;
    for (var i = 1; i < count; ++i) {
      if (max < numbers[i]) {
        max = numbers[i];
      }
    }
    return max;
  }

  /**
  * Determines the smallest value in a sequence of numbers.
  *
  * @param {int|float} value1         int or float
  * @param {int|float} value2         int or float
  * @param {int|float} value3         int or float
  * @param {int|float} array          int or float array
  *
  * @returns {int|float}
  *
  * @see max
  */
  min() {
    if (arguments.length === 2) {
      return arguments[0] < arguments[1] ? arguments[0] : arguments[1];
    }
    var numbers = arguments.length === 1 ? arguments[0] : arguments; // if single argument, array is used
    if (! ("length" in numbers && numbers.length > 0)) {
      throw "Non-empty array is expected";
    }
    var min = numbers[0],
      count = numbers.length;
    for (var i = 1; i < count; ++i) {
      if (min > numbers[i]) {
        min = numbers[i];
      }
    }
    return min;
  }

  /**
  * Normalizes a number from another range into a value between 0 and 1.
  * Identical to map(value, low, high, 0, 1);
  * Numbers outside the range are not clamped to 0 and 1, because out-of-range
  * values are often intentional and useful.
  *
  * @param {float} aNumber    The incoming value to be converted
  * @param {float} low        Lower bound of the value's current range
  * @param {float} high       Upper bound of the value's current range
  *
  * @returns {float}
  *
  * @see map
  * @see lerp
  */
  norm(aNumber, low, high) {
    return (aNumber - low) / (high - low);
  }

  /**
  * Squares a number (multiplies a number by itself). The result is always a positive number,
  * as multiplying two negative numbers always yields a positive result. For example, -1 * -1 = 1.
  *
  * @param {float} value        int or float
  *
  * @returns {float}
  *
  * @see sqrt
  */
  sq(aNumber) {
    return aNumber * aNumber;
  }

  /**
  * Converts a radian measurement to its corresponding value in degrees. Radians and degrees are two ways of
  * measuring the same thing. There are 360 degrees in a circle and 2*PI radians in a circle. For example,
  * 90 degrees = PI/2 = 1.5707964. All trigonometric methods in Processing require their parameters to be specified in radians.
  *
  * @param {int|float} value        an angle in radians
  *
  * @returns {float}
  *
  * @see radians
  */
  degrees(aAngle) {
    return (aAngle * 180) / Math.PI;
  }

  /**
  * Generates random numbers. Each time the random() function is called, it returns an unexpected value within
  * the specified range. If one parameter is passed to the function it will return a float between zero and the
  * value of the high parameter. The function call random(5) returns values between 0 and 5 (starting at zero,
  * up to but not including 5). If two parameters are passed, it will return a float with a value between the
  * parameters. The function call random(-5, 10.2) returns values starting at -5 up to (but not including) 10.2.
  * To convert a floating-point random number to an integer, use the int() function.
  *
  * @param {int|float} value1         if one parameter is used, the top end to random from, if two params the low end
  * @param {int|float} value2         the top end of the random range
  *
  * @returns {float}
  *
  * @see randomSeed
  * @see noise
  */
  random(aMin, aMax) {
    if (arguments.length === 0) {
      aMax = 1;
      aMin = 0;
    } else if (arguments.length === 1) {
      aMax = aMin;
      aMin = 0;
    }
    if (aMin === aMax) {
      return aMin;
    }
    for (var i = 0; i < 100; i++) {
      var ir = internalRandomGenerator();
      var result = ir * (aMax - aMin) + aMin;
      if (result !== aMax) {
        return result;
      }
      // assertion: ir is never less than 0.5
    }
    return aMin;
  }

  /**
  * Sets the seed value for random(). By default, random() produces different results each time the
  * program is run. Set the value parameter to a constant to return the same pseudo-random numbers
  * each time the software is run.
  *
  * @param {int|float} seed         int
  *
  * @see random
  * @see noise
  * @see noiseSeed
  */
  randomSeed(seed) {
    internalRandomGenerator = (new Marsaglia(seed, (seed<<16)+(seed>>16))).doubleGenerator;
    this.haveNextNextGaussian = false;
  }

  /**
  * Returns a float from a random series of numbers having a mean of 0 and standard deviation of 1. Each time
  * the randomGaussian() function is called, it returns a number fitting a Gaussian, or normal, distribution.
  * There is theoretically no minimum or maximum value that randomGaussian() might return. Rather, there is just a
  * very low probability that values far from the mean will be returned; and a higher probability that numbers
  * near the mean will be returned.
  *
  * @returns {float}
  *
  * @see random
  * @see noise
  */
  randomGaussian() {
    if (this.haveNextNextGaussian) {
      this.haveNextNextGaussian = false;
      return this.nextNextGaussian;
    }
    var v1, v2, s;
    do {
      v1 = 2 * internalRandomGenerator() - 1; // between -1.0 and 1.0
      v2 = 2 * internalRandomGenerator() - 1; // between -1.0 and 1.0
      s = v1 * v1 + v2 * v2;
    }
    while (s >= 1 || s === 0);

    var multiplier = Math.sqrt(-2 * Math.log(s) / s);
    this.nextNextGaussian = v2 * multiplier;
    this.haveNextNextGaussian = true;

    return v1 * multiplier;
  }

  /**
  * Returns the Perlin noise value at specified coordinates. Perlin noise is a random sequence
  * generator producing a more natural ordered, harmonic succession of numbers compared to the
  * standard random() function. It was invented by Ken Perlin in the 1980s and been used since
  * in graphical applications to produce procedural textures, natural motion, shapes, terrains etc.
  * The main difference to the random() function is that Perlin noise is defined in an infinite
  * n-dimensional space where each pair of coordinates corresponds to a fixed semi-random value
  * (fixed only for the lifespan of the program). The resulting value will always be between 0.0
  * and 1.0. Processing can compute 1D, 2D and 3D noise, depending on the number of coordinates
  * given. The noise value can be animated by moving through the noise space as demonstrated in
  * the example above. The 2nd and 3rd dimension can also be interpreted as time.
  * The actual noise is structured similar to an audio signal, in respect to the function's use
  * of frequencies. Similar to the concept of harmonics in physics, perlin noise is computed over
  * several octaves which are added together for the final result.
  * Another way to adjust the character of the resulting sequence is the scale of the input
  * coordinates. As the function works within an infinite space the value of the coordinates
  * doesn't matter as such, only the distance between successive coordinates does (eg. when using
  * noise() within a loop). As a general rule the smaller the difference between coordinates, the
  * smoother the resulting noise sequence will be. Steps of 0.005-0.03 work best for most applications,
  * but this will differ depending on use.
  *
  * @param {float} x          x coordinate in noise space
  * @param {float} y          y coordinate in noise space
  * @param {float} z          z coordinate in noise space
  *
  * @returns {float}
  *
  * @see random
  * @see noiseDetail
  */
  noise(x, y, z) {
    if(noiseProfile.generator === undef) {
      // caching
      noiseProfile.generator = new PerlinNoise(noiseProfile.seed);
    }
    var generator = noiseProfile.generator;
    var effect = 1, k = 1, sum = 0;
    for(var i=0; i<noiseProfile.octaves; ++i) {
      effect *= noiseProfile.fallout;
      switch (arguments.length) {
      case 1:
        sum += effect * (1 + generator.noise1d(k*x))/2; break;
      case 2:
        sum += effect * (1 + generator.noise2d(k*x, k*y))/2; break;
      case 3:
        sum += effect * (1 + generator.noise3d(k*x, k*y, k*z))/2; break;
      }
      k *= 2;
    }
    return sum;
  }

  /**
  * Adjusts the character and level of detail produced by the Perlin noise function.
  * Similar to harmonics in physics, noise is computed over several octaves. Lower octaves
  * contribute more to the output signal and as such define the overal intensity of the noise,
  * whereas higher octaves create finer grained details in the noise sequence. By default,
  * noise is computed over 4 octaves with each octave contributing exactly half than its
  * predecessor, starting at 50% strength for the 1st octave. This falloff amount can be
  * changed by adding an additional function parameter. Eg. a falloff factor of 0.75 means
  * each octave will now have 75% impact (25% less) of the previous lower octave. Any value
  * between 0.0 and 1.0 is valid, however note that values greater than 0.5 might result in
  * greater than 1.0 values returned by noise(). By changing these parameters, the signal
  * created by the noise() function can be adapted to fit very specific needs and characteristics.
  *
  * @param {int} octaves          number of octaves to be used by the noise() function
  * @param {float} falloff        falloff factor for each octave
  *
  * @see noise
  */
  noiseDetail(octaves, fallout) {
    noiseProfile.octaves = octaves;
    if(fallout !== undef) {
      noiseProfile.fallout = fallout;
    }
  }

  /**
  * Sets the seed value for noise(). By default, noise() produces different results each
  * time the program is run. Set the value parameter to a constant to return the same
  * pseudo-random numbers each time the software is run.
  *
  * @param {int} seed         int
  *
  * @returns {float}
  *
  * @see random
  * @see radomSeed
  * @see noise
  * @see noiseDetail
  */
  noiseSeed(seed) {
    noiseProfile.seed = seed;
    noiseProfile.generator = undef;
  }
};

export default ProcessingMath;
