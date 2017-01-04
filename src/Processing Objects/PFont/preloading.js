const preloading = {
  // template element used to compare font sizes
  template: {},
  // indicates whether or not the reference tiny font has been loaded
  initialized: false,
  // load the reference tiny font via a css @font-face rule
  initialize: function() {
    let generateTinyFont = function() {
      let encoded = "#E3KAI2wAgT1MvMg7Eo3VmNtYX7ABi3CxnbHlm" +
                    "7Abw3kaGVhZ7ACs3OGhoZWE7A53CRobXR47AY3" +
                    "AGbG9jYQ7G03Bm1heH7ABC3CBuYW1l7Ae3AgcG" +
                    "9zd7AI3AE#B3AQ2kgTY18PPPUACwAg3ALSRoo3" +
                    "#yld0xg32QAB77#E777773B#E3C#I#Q77773E#" +
                    "Q7777777772CMAIw7AB77732B#M#Q3wAB#g3B#" +
                    "E#E2BB//82BB////w#B7#gAEg3E77x2B32B#E#" +
                    "Q#MTcBAQ32gAe#M#QQJ#E32M#QQJ#I#g32Q77#";
      let expand = function(input) {
                     return "AAAAAAAA".substr(~~input ? 7-input : 6);
                   };
      return encoded.replace(/[#237]/g, expand);
    };
    let fontface = document.createElement("style");
    fontface.setAttribute("type","text/css");
    fontface.innerHTML =  "@font-face {\n" +
                          '  font-family: "PjsEmptyFont";' + "\n" +
                          "  src: url('data:application/x-font-ttf;base64,"+generateTinyFont()+"')\n" +
                          "       format('truetype');\n" +
                          "}";
    document.head.appendChild(fontface);

    // set up the template element
    let element = document.createElement("span");
    element.style.cssText = 'position: absolute; top: -1000; left: 0; opacity: 0; font-family: "PjsEmptyFont", fantasy;';
    element.innerHTML = "AAAAAAAA";
    document.body.appendChild(element);
    this.template = element;

    this.initialized = true;
  },
  // Shorthand function to get the computed width for an element.
  getElementWidth: function(element) {
    return document.defaultView.getComputedStyle(element,"").getPropertyValue("width");
  },
  // time taken so far in attempting to load a font
  timeAttempted: 0,
  // returns false if no fonts are pending load, or true otherwise.
  pending: function(intervallength) {
    if (!this.initialized) {
      this.initialize();
    }
    let element,
        computedWidthFont,
        computedWidthRef = this.getElementWidth(this.template);
    for (let i = 0; i < this.fontList.length; i++) {
      // compares size of text in pixels. if equal, custom font is not yet loaded
      element = this.fontList[i];
      computedWidthFont = this.getElementWidth(element);
      if (this.timeAttempted < 4000 && computedWidthFont === computedWidthRef) {
        this.timeAttempted += intervallength;
        return true;
      } else {
        document.body.removeChild(element);
        this.fontList.splice(i--, 1);
        this.timeAttempted = 0;
      }
    }
    // if there are no more fonts to load, pending is false
    if (this.fontList.length === 0) {
      return false;
    }
    // We should have already returned before getting here.
    // But, if we do get here, length!=0 so fonts are pending.
    return true;
  },
  // fontList contains elements to compare font sizes against a template
  fontList: [],
  // addedList contains the fontnames of all the fonts loaded via @font-face
  addedList: {},
  // adds a font to the font cache
  // creates an element using the font, to start loading the font,
  // and compare against a default font to see if the custom font is loaded
  add: function(fontSrc) {
    if (!this.initialized) {
     this.initialize();
    }
    // fontSrc can be a string or a javascript object
    // acceptable fonts are .ttf, .otf, and data uri
    let fontName = (typeof fontSrc === 'object' ? fontSrc.fontFace : fontSrc),
        fontUrl = (typeof fontSrc === 'object' ? fontSrc.url : fontSrc);

    // check whether we already created the @font-face rule for this font
    if (this.addedList[fontName]) {
      return;
    }

    // if we didn't, create the @font-face rule
    let style = document.createElement("style");
    style.setAttribute("type","text/css");
    style.innerHTML = "@font-face{\n  font-family: '" + fontName + "';\n  src:  url('" + fontUrl + "');\n}\n";
    document.head.appendChild(style);
    this.addedList[fontName] = true;

    // also create the element to load and compare the new font
    let element = document.createElement("span");
    element.style.cssText = "position: absolute; top: 0; left: 0; opacity: 0;";
    element.style.fontFamily = '"' + fontName + '", "PjsEmptyFont", fantasy';
    element.innerHTML = "AAAAAAAA";
    document.body.appendChild(element);
    this.fontList.push(element);
  }
};

export default preloading;
