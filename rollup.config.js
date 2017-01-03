import json from 'rollup-plugin-json';

export default {
  entry: 'src/Processing.js',
  format: 'umd',
  moduleName: 'Processing',
  dest: 'processing.js',
  plugins: [
    json({
      include: undefined,
      exclude: [ 'node_modules/**' ],
      preferConst: false
    })
  ]
};