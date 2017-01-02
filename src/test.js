import Processing from "./Processing";
//import document from "./shims/document";

// Some simple code
var code = [
`  import test.something;`,
``,
`  class Cake {`,
`    int a = 0;`,
`    boolean test(boolean okay) {`,
`      return true;`,
`    }`,
`    static boolean test2(boolean okay) {`,
`      return false;`,
`    }`,
`  }`,
``,
`  void setup() {`,
`    Cake c = new Cake();`,
`    noLoop();`,
`  }`,
``,
`  void draw() {`,
`    background(255);`,
`  }`
].join('\n');

if (typeof window !== "undefined") {
	window.Processing = Processing;

	// See if Processing can turn it into a bindable script
	Processing.parse(code)
	          .then(ast => Processing.convert(ast))
	          .then(res => Processing.injectSketch(res, document))
	          .catch(error => console.error(error));
}
