# processingjs-es7

An attempt at an ES2017 implementation of [Processing.js](https://github.com/processing-js/processing-js), with [rollup](http://rollupjs.org/guide) as bundler.

Current work in progress: porting the parser and parser tests.

## The parser

The parser main entry point is convert(), which runs through the following steps:

1. create empty sketch
2. remove Pjs-specific predirectives from the provided code
3. convert the resulting code into JavaScript by:
	a. converting the Java-like syntax to an AST
	b. serialize the AST to JavaScript
4. attach the resulting JS sourceCode to the sketch

The sketch then attaches itself to the Processing object, which kicks off actual source code interpretation via a `new Function` call. This is not *as* bad as an `eval`, but it's still considered pretty bad these days, and this particular way of bootstrapping a sketch likely needs to be changed to the following:

1. parser converts source code without any sketch object
2. resulting code is wrapped in additional code for creating a sketch and hooking into Processing
3. this wrapped code is then added to the `<head>` as a `<script>` element so that CORS rules around `new Function` and `eval` don't prevent Processing.js from loading sketches.
