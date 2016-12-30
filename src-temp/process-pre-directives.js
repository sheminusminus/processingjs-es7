// L/RTrim, also removing any surrounding double quotes (e.g., just take string contents).
function clean(s) {
  return s.replace(/^\s*["']?/, '').replace(/["']?\s*$/, '');
};

/**
 * collect all @PJS pre-directives
 */
function processPreDirectives(aCode, sketch) {
  // Parse out @pjs directive, if any.
  let dm = new RegExp(/\/\*\s*@pjs\s+((?:[^\*]|\*+[^\*\/])*)\*\//g).exec(aCode);

  if (dm && dm.length === 2) {
    // masks contents of a JSON to be replaced later
    // to protect the contents from further parsing
    let jsonItems = [],
        directives = dm.splice(1, 2)[0].replace(/\{([\s\S]*?)\}/g, (function() {
          return function(all, item) {
            jsonItems.push(item);
            return "{" + (jsonItems.length-1) + "}";
          };
        }())).replace('\n', '').replace('\r', '').split(";");

    for (let i = 0, dl = directives.length; i < dl; i++) {
      let pair = directives[i].split('=');
      if (pair && pair.length === 2) {
        let key = clean(pair[0]),
            value = clean(pair[1]),
            list = [];
        // A few directives require work beyond storying key/value pairings
        if (key === "preload") {
          list = value.split(',');
          // All pre-loaded images will get put in imageCache, keyed on filename
          for (let j = 0, jl = list.length; j < jl; j++) {
            let imageName = clean(list[j]);
            sketch.imageCache.add(imageName);
          }
        // fonts can be declared as a string containing a url,
        // or a JSON object, containing a font name, and a url
        } else if (key === "font") {
          list = value.split(",");
          for (let x = 0, xl = list.length; x < xl; x++) {
            let fontName = clean(list[x]),
                index = /^\{(\d*?)\}$/.exec(fontName);
            // if index is not null, send JSON, otherwise, send string
            PFont.preloading.add(index ? JSON.parse("{" + jsonItems[index[1]] + "}") : fontName);
          }
        } else if (key === "pauseOnBlur") {
          sketch.options.pauseOnBlur = value === "true";
        } else if (key === "globalKeyEvents") {
          sketch.options.globalKeyEvents = value === "true";
        } else if (key.substring(0, 6) === "param-") {
          sketch.params[key.substring(6)] = value;
        } else {
          sketch.options[key] = value;
        }
      }
    }
  }

  return aCode;
} // end preprocessCode