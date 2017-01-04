import computeFontMetrics from "./computeFontMetrics";
import preloading from "./preloading";

/**
 * Constructor for a system or from-file (non-SVG) font.
 */
class PFont {
  constructor(name, size) {
    if (name === undef) {
      name = "";
    }
    this.name = name;
    if (size === undef) {
      size = 0;
    }
    this.size = size;
    this.glyph = false;
    this.ascent = 0;
    this.descent = 0;
    // For leading, the "safe" value uses the standard TEX ratio of 1.2 em
    this.leading = 1.2 * size;

    // Note that an italic, bold font must used "... Bold Italic"
    // in P5. "... Italic Bold" is treated as normal/normal.
    let illegalIndicator = name.indexOf(" Italic Bold");
    if (illegalIndicator !== -1) {
      name = name.substring(0, illegalIndicator);
    }

    // determine font style
    this.style = "normal";
    let italicsIndicator = name.indexOf(" Italic");
    if (italicsIndicator !== -1) {
      name = name.substring(0, italicsIndicator);
      this.style = "italic";
    }

    // determine font weight
    this.weight = "normal";
    let boldIndicator = name.indexOf(" Bold");
    if (boldIndicator !== -1) {
      name = name.substring(0, boldIndicator);
      this.weight = "bold";
    }

    // determine font-family name
    this.family = "sans-serif";
    if (name !== undef) {
      switch(name) {
        case "sans-serif":
        case "serif":
        case "monospace":
        case "fantasy":
        case "cursive":
          this.family = name;
          break;
        default:
          this.family = '"' + name + '", sans-serif';
          break;
      }
    }
    // Calculate the ascent/descent/leading value based on how the browser renders this font.
    this.context2d = computeFontMetrics(this);
    this.css = this.getCSSDefinition();
    if (this.context2d) {
      this.context2d.font = this.css;
    }
  }

  /**
   * This function generates the CSS "font" string for this PFont
   */
  getCSSDefinition(fontSize, lineHeight) {
    if(fontSize===undef) {
      fontSize = this.size + "px";
    }
    if(lineHeight===undef) {
      lineHeight = this.leading + "px";
    }
    // CSS "font" definition: font-style font-variant font-weight font-size/line-height font-family
    let components = [this.style, "normal", this.weight, fontSize + "/" + lineHeight, this.family];
    return components.join(" ");
  }

  /**
   * Rely on the cached context2d measureText function.
   */
  measureTextWidth(string) {
    return this.context2d.measureText(string).width;
  }

  /**
   * FALLBACK FUNCTION -- replaces Pfont.prototype.measureTextWidth
   * when the font cache becomes too large. This contructs a new
   * canvas 2d context object for calling measureText on.
   */
  measureTextWidthFallback(string) {
    let canvas = document.createElement("canvas"),
        ctx = canvas.getContext("2d");
    ctx.font = this.css;
    return ctx.measureText(string).width;
  }
};


/**
 * Global "loaded fonts" list, internal to PFont
 */
PFont.PFontCache = { length: 0 };

/**
 * This function acts as single access point for getting and caching
 * fonts across all sketches handled by an instance of Processing.js
 */
PFont.get = function(fontName, fontSize) {
  // round fontSize to one decimal point
  fontSize = ((fontSize*10)+0.5|0)/10;
  let cache = PFont.PFontCache,
      idx = fontName+"/"+fontSize;
  if (!cache[idx]) {
    cache[idx] = new PFont(fontName, fontSize);
    cache.length++;

    // FALLBACK FUNCTIONALITY 1:
    // If the cache has become large, switch over from full caching
    // to caching only the static metrics for each new font request.
    if (cache.length === 50) {
      PFont.prototype.measureTextWidth = PFont.prototype.measureTextWidthFallback;
      PFont.prototype.caching = false;
      // clear contexts stored for each cached font
      let entry;
      for (entry in cache) {
        if (entry !== "length") {
          cache[entry].context2d = null;
        }
      }
      return new PFont(fontName, fontSize);
    }

    // FALLBACK FUNCTIONALITY 2:
    // If the cache has become too large, switch off font caching entirely.
    if (cache.length === 400) {
      PFont.PFontCache = {};
      PFont.get = PFont.getFallback;
      return new PFont(fontName, fontSize);
    }
  }
  return cache[idx];
};

/**
 * regulates whether or not we're caching the canvas
 * 2d context for quick text width computation.
 */
PFont.caching = true;

/**
 * FALLBACK FUNCTION -- replaces PFont.get when the font cache
 * becomes too large. This function bypasses font caching entirely.
 */
PFont.getFallback = function(fontName, fontSize) {
  return new PFont(fontName, fontSize);
};

/**
 * Lists all standard fonts. Due to browser limitations, this list is
 * not the system font list, like in P5, but the CSS "genre" list.
 */
PFont.list = function() {
  return ["sans-serif", "serif", "monospace", "fantasy", "cursive"];
};

/**
 * Loading external fonts through @font-face rules is handled by PFont,
 * to ensure fonts loaded in this way are globally available.
 */
PFont.preloading = preloading

export default PFont;
