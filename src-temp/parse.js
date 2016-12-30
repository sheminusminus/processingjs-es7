// ==================================================================
//
//  Syntax converter for Processing syntax (java-like) to JavaScript
//
// ==================================================================

export default function convert(processingSourceCode) {
  let sketch = new Processing.Sketch();
  let pureSourceCode = processPreDirectives(processingSourceCode, sketch);
  let javaScriptSourceCode = parseProcessing(pureSourceCode);
  sketch.sourceSourceCode = javaScriptSourceCode;
  return sketch;
}
