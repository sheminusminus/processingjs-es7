/**
* Datatype for storing images. Processing can display .gif, .jpg, .tga, and .png images. Images may be
* displayed in 2D and 3D space. Before an image is used, it must be loaded with the loadImage() function.
* The PImage object contains fields for the width and height of the image, as well as an array called
* pixels[]  which contains the values for every pixel in the image. A group of methods, described below,
* allow easy access to the image's pixels and alpha channel and simplify the process of compositing.
* Before using the pixels[] array, be sure to use the loadPixels() method on the image to make sure that the
* pixel data is properly loaded. To create a new image, use the createImage() function (do not use new PImage()).
*
* @param {int} width                image width
* @param {int} height               image height
* @param {MODE} format              Either RGB, ARGB, ALPHA (grayscale alpha channel)
*
* @returns {PImage}
*
* @see loadImage
* @see imageMode
* @see createImage
*/
export default class PImage {
  constructor(p, aWidth, aHeight, aFormat) {
    this.p = p;

    // Keep track of whether or not the cached imageData has been touched.
    this.__isDirty = false;

    if (aWidth instanceof HTMLImageElement) {
      // convert an <img> to a PImage
      this.fromHTMLImageData(aWidth);
    } else if (aHeight || aFormat) {
      this.width = aWidth || 1;
      this.height = aHeight || 1;

      // Stuff a canvas into sourceImg so image() calls can use drawImage like an <img>
      var canvas = this.sourceImg = document.createElement("canvas");
      canvas.width = this.width;
      canvas.height = this.height;

      var imageData = this.imageData = canvas.getContext('2d').createImageData(this.width, this.height);
      this.format = (aFormat === PConstants.ARGB || aFormat === PConstants.ALPHA) ? aFormat : PConstants.RGB;
      if (this.format === PConstants.RGB) {
        // Set the alpha channel of an RGB image to opaque.
        for (var i = 3, data = this.imageData.data, len = data.length; i < len; i += 4) {
          data[i] = 255;
        }
      }

      this.__isDirty = true;
      this.updatePixels();
    } else {
      this.width = 0;
      this.height = 0;
      this.imageData = utilityContext2d.createImageData(1, 1);
      this.format = PConstants.ARGB;
    }

    this.pixels = buildPixelsObject(this);
    this.__isPImage: true,
  }

  /**
  * @member PImage
  * Updates the image with the data in its pixels[] array. Use in conjunction with loadPixels(). If
  * you're only reading pixels from the array, there's no need to call updatePixels().
  * Certain renderers may or may not seem to require loadPixels() or updatePixels(). However, the rule
  * is that any time you want to manipulate the pixels[] array, you must first call loadPixels(), and
  * after changes have been made, call updatePixels(). Even if the renderer may not seem to use this
  * function in the current Processing release, this will always be subject to change.
  * Currently, none of the renderers use the additional parameters to updatePixels().
  */
  updatePixels() {
    var canvas = this.sourceImg;
    if (canvas && canvas instanceof HTMLCanvasElement && this.__isDirty) {
      canvas.getContext('2d').putImageData(this.imageData, 0, 0);
    }
    this.__isDirty = false;
  },

  fromHTMLImageData(htmlImg) {
    // convert an <img> to a PImage
    var canvasData = getCanvasData(htmlImg);
    try {
      var imageData = canvasData.context.getImageData(0, 0, htmlImg.width, htmlImg.height);
      this.fromImageData(imageData);
    } catch(e) {
      if (htmlImg.width && htmlImg.height) {
        this.isRemote = true;
        this.width = htmlImg.width;
        this.height = htmlImg.height;
      }
    }
    this.sourceImg = htmlImg;
  },

  get(x, y, w, h) {
    if (!arguments.length) {
      return this.p.get(this);
    }
    if (arguments.length === 2) {
      return this.p.get(x, y, this);
    }
    if (arguments.length === 4) {
      return this.p.get(x, y, w, h, this);
    }
  },

  /**
  * @member PImage
  * Changes the color of any pixel or writes an image directly into the image. The x and y parameter
  * specify the pixel or the upper-left corner of the image. The color parameter specifies the color value.
  * Setting the color of a single pixel with set(x, y) is easy, but not as fast as putting the data
  * directly into pixels[]. The equivalent statement to "set(x, y, #000000)" using pixels[] is
  * "pixels[y*width+x] = #000000". Processing requires calling loadPixels() to load the display window
  * data into the pixels[] array before getting the values and calling updatePixels() to update the window.
  *
  * @param {int} x        x-coordinate of the pixel or upper-left corner of the image
  * @param {int} y        y-coordinate of the pixel or upper-left corner of the image
  * @param {color} color  any value of the color datatype
  *
  * @see get
  * @see pixels[]
  * @see copy
  */
  set(x, y, c) {
    this.p.set(x, y, c, this);
    this.__isDirty = true;
  },

  /**
  * @member PImage
  * Blends a region of pixels into the image specified by the img parameter. These copies utilize full
  * alpha channel support and a choice of the following modes to blend the colors of source pixels (A)
  * with the ones of pixels in the destination image (B):
  * BLEND - linear interpolation of colours: C = A*factor + B
  * ADD - additive blending with white clip: C = min(A*factor + B, 255)
  * SUBTRACT - subtractive blending with black clip: C = max(B - A*factor, 0)
  * DARKEST - only the darkest colour succeeds: C = min(A*factor, B)
  * LIGHTEST - only the lightest colour succeeds: C = max(A*factor, B)
  * DIFFERENCE - subtract colors from underlying image.
  * EXCLUSION - similar to DIFFERENCE, but less extreme.
  * MULTIPLY - Multiply the colors, result will always be darker.
  * SCREEN - Opposite multiply, uses inverse values of the colors.
  * OVERLAY - A mix of MULTIPLY and SCREEN. Multiplies dark values, and screens light values.
  * HARD_LIGHT - SCREEN when greater than 50% gray, MULTIPLY when lower.
  * SOFT_LIGHT - Mix of DARKEST and LIGHTEST. Works like OVERLAY, but not as harsh.
  * DODGE - Lightens light tones and increases contrast, ignores darks. Called "Color Dodge" in Illustrator and Photoshop.
  * BURN - Darker areas are applied, increasing contrast, ignores lights. Called "Color Burn" in Illustrator and Photoshop.
  * All modes use the alpha information (highest byte) of source image pixels as the blending factor.
  * If the source and destination regions are different sizes, the image will be automatically resized to
  * match the destination size. If the srcImg parameter is not used, the display window is used as the source image.
  * This function ignores imageMode().
  *
  * @param {int} x              X coordinate of the source's upper left corner
  * @param {int} y              Y coordinate of the source's upper left corner
  * @param {int} width          source image width
  * @param {int} height         source image height
  * @param {int} dx             X coordinate of the destinations's upper left corner
  * @param {int} dy             Y coordinate of the destinations's upper left corner
  * @param {int} dwidth         destination image width
  * @param {int} dheight        destination image height
  * @param {PImage} srcImg      an image variable referring to the source image
  * @param {MODE} MODE          Either BLEND, ADD, SUBTRACT, LIGHTEST, DARKEST, DIFFERENCE, EXCLUSION,
  * MULTIPLY, SCREEN, OVERLAY, HARD_LIGHT, SOFT_LIGHT, DODGE, BURN
  *
  * @see alpha
  * @see copy
  */
  blend(srcImg, x, y, width, height, dx, dy, dwidth, dheight, MODE) {
    if (arguments.length === 9) {
      this.p.blend(this, srcImg, x, y, width, height, dx, dy, dwidth, dheight, this);
    } else if (arguments.length === 10) {
      this.p.blend(srcImg, x, y, width, height, dx, dy, dwidth, dheight, MODE, this);
    }
    delete this.sourceImg;
  },

  /**
  * @member PImage
  * Copies a region of pixels from one image into another. If the source and destination regions
  * aren't the same size, it will automatically resize source pixels to fit the specified target region.
  * No alpha information is used in the process, however if the source image has an alpha channel set,
  * it will be copied as well. This function ignores imageMode().
  *
  * @param {int} sx             X coordinate of the source's upper left corner
  * @param {int} sy             Y coordinate of the source's upper left corner
  * @param {int} swidth         source image width
  * @param {int} sheight        source image height
  * @param {int} dx             X coordinate of the destinations's upper left corner
  * @param {int} dy             Y coordinate of the destinations's upper left corner
  * @param {int} dwidth         destination image width
  * @param {int} dheight        destination image height
  * @param {PImage} srcImg      an image variable referring to the source image
  *
  * @see alpha
  * @see blend
  */
  copy(srcImg, sx, sy, swidth, sheight, dx, dy, dwidth, dheight) {
    if (arguments.length === 8) {
      this.p.blend(this, srcImg, sx, sy, swidth, sheight, dx, dy, dwidth, PConstants.REPLACE, this);
    } else if (arguments.length === 9) {
      this.p.blend(srcImg, sx, sy, swidth, sheight, dx, dy, dwidth, dheight, PConstants.REPLACE, this);
    }
    delete this.sourceImg;
  },

  /**
  * @member PImage
  * Filters an image as defined by one of the following modes:
  * THRESHOLD - converts the image to black and white pixels depending if they are above or below
  * the threshold defined by the level parameter. The level must be between 0.0 (black) and 1.0(white).
  * If no level is specified, 0.5 is used.
  * GRAY - converts any colors in the image to grayscale equivalents
  * INVERT - sets each pixel to its inverse value
  * POSTERIZE - limits each channel of the image to the number of colors specified as the level parameter
  * BLUR - executes a Guassian blur with the level parameter specifying the extent of the blurring.
  * If no level parameter is used, the blur is equivalent to Guassian blur of radius 1.
  * OPAQUE - sets the alpha channel to entirely opaque.
  * ERODE - reduces the light areas with the amount defined by the level parameter.
  * DILATE - increases the light areas with the amount defined by the level parameter
  *
  * @param {MODE} MODE        Either THRESHOLD, GRAY, INVERT, POSTERIZE, BLUR, OPAQUE, ERODE, or DILATE
  * @param {int|float} param  in the range from 0 to 1
  */
  filter(mode, param) {
    if (arguments.length === 2) {
      this.p.filter(mode, param, this);
    } else if (arguments.length === 1) {
      // no param specified, send null to show its invalid
      this.p.filter(mode, null, this);
    }
    delete this.sourceImg;
  },

  /**
  * @member PImage
  * Saves the image into a file. Images are saved in TIFF, TARGA, JPEG, and PNG format depending on
  * the extension within the filename  parameter. For example, "image.tif" will have a TIFF image and
  * "image.png" will save a PNG image. If no extension is included in the filename, the image will save
  * in TIFF format and .tif will be added to the name. These files are saved to the sketch's folder,
  * which may be opened by selecting "Show sketch folder" from the "Sketch" menu. It is not possible to
  * use save() while running the program in a web browser.
  * To save an image created within the code, rather than through loading, it's necessary to make the
  * image with the createImage() function so it is aware of the location of the program and can therefore
  * save the file to the right place. See the createImage() reference for more information.
  *
  * @param {String} filename        a sequence of letters and numbers
  */
  save(file){
    this.p.save(file,this);
  },

  /**
  * @member PImage
  * Resize the image to a new width and height. To make the image scale proportionally, use 0 as the
  * value for the wide or high parameter.
  *
  * @param {int} wide         the resized image width
  * @param {int} high         the resized image height
  *
  * @see get
  */
  resize(w, h) {
    if (this.isRemote) { // Remote images cannot access imageData
      throw "Image is loaded remotely. Cannot resize.";
    }
    if (this.width !== 0 || this.height !== 0) {
      // make aspect ratio if w or h is 0
      if (w === 0 && h !== 0) {
        w = Math.floor(this.width / this.height * h);
      } else if (h === 0 && w !== 0) {
        h = Math.floor(this.height / this.width * w);
      }
      // put 'this.imageData' into a new canvas
      var canvas = getCanvasData(this.imageData).canvas;
      // pull imageData object out of canvas into ImageData object
      var imageData = getCanvasData(canvas, w, h).context.getImageData(0, 0, w, h);
      // set this as new pimage
      this.fromImageData(imageData);
    }
  },

  /**
  * @member PImage
  * Masks part of an image from displaying by loading another image and using it as an alpha channel.
  * This mask image should only contain grayscale data, but only the blue color channel is used. The
  * mask image needs to be the same size as the image to which it is applied.
  * In addition to using a mask image, an integer array containing the alpha channel data can be
  * specified directly. This method is useful for creating dynamically generated alpha masks. This
  * array must be of the same length as the target image's pixels array and should contain only grayscale
  * data of values between 0-255.
  *
  * @param {PImage} maskImg         any PImage object used as the alpha channel for "img", needs to be same
  *                                 size as "img"
  * @param {int[]} maskArray        any array of Integer numbers used as the alpha channel, needs to be same
  *                                 length as the image's pixel array
  */
  mask(mask) {
    var obj = this.toImageData(),
        i,
        size;

    if (mask instanceof PImage || mask.__isPImage) {
      if (mask.width === this.width && mask.height === this.height) {
        mask = mask.toImageData();

        for (i = 2, size = this.width * this.height * 4; i < size; i += 4) {
          // using it as an alpha channel
          obj.data[i + 1] = mask.data[i];
          // but only the blue color channel
        }
      } else {
        throw "mask must have the same dimensions as PImage.";
      }
    } else if (mask instanceof Array) {
      if (this.width * this.height === mask.length) {
        for (i = 0, size = mask.length; i < size; ++i) {
          obj.data[i * 4 + 3] = mask[i];
        }
      } else {
        throw "mask array must be the same length as PImage pixels array.";
      }
    }

    this.fromImageData(obj);
  },

  // These are intentionally left blank for PImages, we work live with pixels and draw as necessary
  /**
  * @member PImage
  * Loads the pixel data for the image into its pixels[] array. This function must always be called
  * before reading from or writing to pixels[].
  * Certain renderers may or may not seem to require loadPixels() or updatePixels(). However, the
  * rule is that any time you want to manipulate the pixels[] array, you must first call loadPixels(),
  * and after changes have been made, call updatePixels(). Even if the renderer may not seem to use
  * this function in the current Processing release, this will always be subject to change.
  */
  loadPixels: noop,

  toImageData() {
    if (this.isRemote) {
      return this.sourceImg;
    }

    if (!this.__isDirty) {
      return this.imageData;
    }

    var canvasData = getCanvasData(this.sourceImg);
    return canvasData.context.getImageData(0, 0, this.width, this.height);
  },

  toDataURL() {
    if (this.isRemote) { // Remote images cannot access imageData
      throw "Image is loaded remotely. Cannot create dataURI.";
    }
    var canvasData = getCanvasData(this.imageData);
    return canvasData.canvas.toDataURL();
  },

  fromImageData(canvasImg) {
    var w = canvasImg.width,
      h = canvasImg.height,
      canvas = document.createElement('canvas'),
      ctx = canvas.getContext('2d');

    this.width = canvas.width = w;
    this.height = canvas.height = h;

    ctx.putImageData(canvasImg, 0, 0);

    // changed for 0.9
    this.format = PConstants.ARGB;

    this.imageData = canvasImg;
    this.sourceImg = canvas;
  }
};
