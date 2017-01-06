import PConstants from "../PConstants";

export default function colorBindings(p, hooks) {
  function color$4(aValue1, aValue2, aValue3, aValue4) {
    let r, g, b, a;
    let context = p.context;


    if (context.curColorMode === PConstants.HSB) {
      var rgb = p.color.toRGB(aValue1, aValue2, aValue3);
      r = rgb[0];
      g = rgb[1];
      b = rgb[2];
    } else {
      r = Math.round(255 * (aValue1 / context.colorModeX));
      g = Math.round(255 * (aValue2 / context.colorModeY));
      b = Math.round(255 * (aValue3 / context.colorModeZ));
    }

    a = Math.round(255 * (aValue4 / context.colorModeA));

    // Limit values less than 0 and greater than 255
    r = (r < 0) ? 0 : r;
    g = (g < 0) ? 0 : g;
    b = (b < 0) ? 0 : b;
    a = (a < 0) ? 0 : a;
    r = (r > 255) ? 255 : r;
    g = (g > 255) ? 255 : g;
    b = (b > 255) ? 255 : b;
    a = (a > 255) ? 255 : a;

    // Create color int
    return (a << 24) & PConstants.ALPHA_MASK | (r << 16) & PConstants.RED_MASK | (g << 8) & PConstants.GREEN_MASK | b & PConstants.BLUE_MASK;
  }

  function color$2(aValue1, aValue2) {
    let a;
    let context = p.context;

    // Color int and alpha
    if (aValue1 & PConstants.ALPHA_MASK) {
      a = Math.round(255 * (aValue2 / context.colorModeA));
      // Limit values less than 0 and greater than 255
      a = (a > 255) ? 255 : a;
      a = (a < 0) ? 0 : a;

      return aValue1 - (aValue1 & PConstants.ALPHA_MASK) + ((a << 24) & PConstants.ALPHA_MASK);
    }
    // Grayscale and alpha
    if (context.curColorMode === PConstants.RGB) {
      return color$4(aValue1, aValue1, aValue1, aValue2);
    }
    if (context.curColorMode === PConstants.HSB) {
      return color$4(0, 0, (aValue1 / context.colorModeX) * context.colorModeZ, aValue2);
    }
  }

  function color$1(aValue1) {
    let context = p.context;

    // Grayscale
    if (aValue1 <= context.colorModeX && aValue1 >= 0) {
        if (context.curColorMode === PConstants.RGB) {
          return color$4(aValue1, aValue1, aValue1, context.colorModeA);
        }
        if (curColorMode === PConstants.HSB) {
          return color$4(0, 0, (aValue1 / context.colorModeX) * context.colorModeZ, context.colorModeA);
        }
    }
    // Color int
    if (aValue1) {
      if (aValue1 > 2147483647) {
        // Java Overflow
        aValue1 -= 4294967296;
      }
      return aValue1;
    }
  }

  /**
  * Creates colors for storing in variables of the color datatype. The parameters are
  * interpreted as RGB or HSB values depending on the current colorMode(). The default
  * mode is RGB values from 0 to 255 and therefore, the function call color(255, 204, 0)
  * will return a bright yellow color. More about how colors are stored can be found in
  * the reference for the color datatype.
  *
  * @param {int|float} aValue1        red or hue or grey values relative to the current color range.
  * Also can be color value in hexadecimal notation (i.e. #FFCC00 or 0xFFFFCC00)
  * @param {int|float} aValue2        green or saturation values relative to the current color range
  * @param {int|float} aValue3        blue or brightness values relative to the current color range
  * @param {int|float} aValue4        relative to current color range. Represents alpha
  *
  * @returns {color} the color
  *
  * @see colorMode
  */
  let color = function(aValue1, aValue2, aValue3, aValue4) {
    let context = p.context;

    // 4 arguments: (R, G, B, A) or (H, S, B, A)
    if (aValue1 !== undefined && aValue2 !== undefined && aValue3 !== undefined && aValue4 !== undefined) {
      return color$4(aValue1, aValue2, aValue3, aValue4);
    }

    // 3 arguments: (R, G, B) or (H, S, B)
    if (aValue1 !== undefined && aValue2 !== undefined && aValue3 !== undefined) {
      return color$4(aValue1, aValue2, aValue3, context.colorModeA);
    }

    // 2 arguments: (Color, A) or (Grayscale, A)
    if (aValue1 !== undefined && aValue2 !== undefined) {
      return color$2(aValue1, aValue2);
    }

    // 1 argument: (Grayscale) or (Color)
    if (typeof aValue1 === "number") {
      return color$1(aValue1);
    }

    // Default
    return color$4(context.colorModeX, context.colorModeY, context.colorModeZ, context.colorModeA);
  };

  // Ease of use function to extract the colour bits into a string
  color.toString = function(colorInt) {
    return "rgba(" + ((colorInt & PConstants.RED_MASK) >>> 16) + "," + ((colorInt & PConstants.GREEN_MASK) >>> 8) +
           "," + ((colorInt & PConstants.BLUE_MASK)) + "," + ((colorInt & PConstants.ALPHA_MASK) >>> 24) / 255 + ")";
  };

  // Easy of use function to pack rgba values into a single bit-shifted color int.
  color.toInt = function(r, g, b, a) {
    return (a << 24) & PConstants.ALPHA_MASK | (r << 16) & PConstants.RED_MASK | (g << 8) & PConstants.GREEN_MASK | b & PConstants.BLUE_MASK;
  };

  // Creates a simple array in [R, G, B, A] format, [255, 255, 255, 255]
  color.toArray = function(colorInt) {
    return [(colorInt & PConstants.RED_MASK) >>> 16, (colorInt & PConstants.GREEN_MASK) >>> 8,
            colorInt & PConstants.BLUE_MASK, (colorInt & PConstants.ALPHA_MASK) >>> 24];
  };

  // Creates a WebGL color array in [R, G, B, A] format. WebGL wants the color ranges between 0 and 1, [1, 1, 1, 1]
  color.toGLArray = function(colorInt) {
    return [((colorInt & PConstants.RED_MASK) >>> 16) / 255, ((colorInt & PConstants.GREEN_MASK) >>> 8) / 255,
            (colorInt & PConstants.BLUE_MASK) / 255, ((colorInt & PConstants.ALPHA_MASK) >>> 24) / 255];
  };

  // HSB conversion function from Mootools, MIT Licensed
  color.toRGB = function(h, s, b) {
    // Limit values greater than range
    h = (h > colorModeX) ? colorModeX : h;
    s = (s > colorModeY) ? colorModeY : s;
    b = (b > colorModeZ) ? colorModeZ : b;

    h = (h / colorModeX) * 360;
    s = (s / colorModeY) * 100;
    b = (b / colorModeZ) * 100;

    var br = Math.round(b / 100 * 255);

    if (s === 0) { // Grayscale
      return [br, br, br];
    }
    var hue = h % 360;
    var f = hue % 60;
    var p = Math.round((b * (100 - s)) / 10000 * 255);
    var q = Math.round((b * (6000 - s * f)) / 600000 * 255);
    var t = Math.round((b * (6000 - s * (60 - f))) / 600000 * 255);
    switch (Math.floor(hue / 60)) {
    case 0:
      return [br, t, p];
    case 1:
      return [q, br, p];
    case 2:
      return [p, br, t];
    case 3:
      return [p, q, br];
    case 4:
      return [t, p, br];
    case 5:
      return [br, p, q];
    }
  };

  p.color = color;
};
