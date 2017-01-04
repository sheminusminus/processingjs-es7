export default function createImageCache() {
  let isWindowPresent = (typeof window !== "undefined");
  let isDOMPresent = isWindowPresent && (typeof document !== "undefined");

  return {
    pending: 0,
    images: {},
    // Opera requires special administration for preloading
    operaCache: {},
    // Specify an optional img arg if the image is already loaded in the DOM,
    // otherwise href will get loaded.
    add: function(href, img) {
      // Prevent muliple loads for an image, in case it gets
      // preloaded more than once, or is added via JS and then preloaded.
      if (this.images[href]) {
        return;
      }

      if (!isDOMPresent) {
        this.images[href] = null;
      }

      // No image in the DOM, kick-off a background load
      if (!img) {
        img = new Image();
        img.onload = (function(owner) {
          return function() {
            owner.pending--;
          };
        }(this));
        this.pending++;
        img.src = href;
      }

      this.images[href] = img;

      // Opera will not load images until they are inserted into the DOM.
      if (isWindowPresent && window.opera) {
        var div = document.createElement("div");
        div.appendChild(img);
        // we can't use "display: none", since that makes it invisible, and thus not load
        div.style.position = "absolute";
        div.style.opacity = 0;
        div.style.width = "1px";
        div.style.height= "1px";
        if (!this.operaCache[href]) {
          document.body.appendChild(div);
          this.operaCache[href] = div;
        }
      }
    }
  };
};
