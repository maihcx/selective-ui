
const { defineConfig } = require('rollup');
const resolve = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const replace = require('@rollup/plugin-replace');
const postcss = require('rollup-plugin-postcss');
const terser = require('@rollup/plugin-terser');
const brotliPlugin = require('rollup-plugin-brotli');

const autoprefixer = require('autoprefixer');
const cssnano = require('cssnano');

const typescript = require('@rollup/plugin-typescript');

const banner = '/*! Selective UI v1.1.0 | MIT License */';
const treeshake = { preset: 'recommended' };

const brotliOptions = {
  filter: /\.(js|css|mjs|json|html|svg)$/i,
  additionalFiles: [],
  minSize: 0,
  fileName: (filename) => `${filename}.br`,
  options: { quality: 11 },
};

// PostCSS profiles
const postcssNonMin = postcss({
  extract: 'selective-ui.css',
  minimize: false,
  sourceMap: true,
  plugins: [autoprefixer()],
});

const postcssMin = postcss({
  extract: 'selective-ui.min.css',
  minimize: true,
  sourceMap: false,
  plugins: [autoprefixer(), cssnano({ preset: 'default' })],
});

const terserUMD = terser({
  ecma: 2020,
  safari10: true,
  format: { comments: /^!/ },
  compress: {
    passes: 3,
    drop_console: false,
    drop_debugger: false,
    pure_getters: true,
    reduce_funcs: true,
    reduce_vars: true,
    hoist_funs: true,
    hoist_vars: true,
    hoist_props: true,
    inline: 3,
    toplevel: true,
    dead_code: true,
    unused: true,
    switches: true,
    conditionals: true,
    comparisons: true,
    booleans: true,
    keep_fargs: false,
    keep_infinity: true,
    collapse_vars: true,
    unsafe: true,
    unsafe_math: true,
    unsafe_arrows: true,
    typeofs: true,
  },
  mangle: {
    toplevel: true,
    properties: {
      regex: /^_/,
      keep_quoted: true,
    },
  },
});

const terserESM = terser({
  module: true,
  ecma: 2020,
  format: { comments: false },
  compress: {
    passes: 3,
    drop_console: false,
    drop_debugger: false,
    pure_getters: true,
    reduce_funcs: true,
    reduce_vars: true,
    hoist_funs: true,
    hoist_vars: true,
    hoist_props: true,
    inline: 3,
    toplevel: true,
    dead_code: true,
    unused: true,
    switches: true,
    conditionals: true,
    comparisons: true,
    booleans: true,
    keep_fargs: false,
    keep_infinity: true,
    collapse_vars: true,
    unsafe: true,
    unsafe_math: true,
    unsafe_arrows: true,
    typeofs: true,
  },
  mangle: {
    toplevel: true,
    properties: {
      regex: /^_/,
      keep_quoted: true,
    },
  },
});

module.exports = defineConfig([
  // UMD (non-min)
  {
    input: 'src/ts/index.ts',
    output: {
      file: 'dist/selective-ui.umd.js',
      format: 'umd',
      name: 'SelectiveUI',
      sourcemap: true,
      banner,
    },
    plugins: [
      replace({ preventAssignment: true, 'process.env.NODE_ENV': JSON.stringify('production') }),
      resolve(),
      commonjs(),
      postcssNonMin,
      typescript({
        tsconfig: './tsconfig.json',
        sourceMap: true
      }),
    ],
    treeshake,
  },

  // ESM (non-min)
  {
    input: 'src/ts/index.ts',
    output: {
      file: 'dist/selective-ui.esm.js',
      format: 'esm',
      sourcemap: true,
      banner,
    },
    plugins: [
      replace({ preventAssignment: true, 'process.env.NODE_ENV': JSON.stringify('production') }),
      resolve(),
      commonjs(),
      postcssNonMin,
      typescript({
        tsconfig: './tsconfig.json',
        sourceMap: true
      }),
    ],
    treeshake,
  },

  // UMD minified
  {
    input: 'src/ts/index.ts',
    output: {
      file: 'dist/selective-ui.min.js',
      format: 'umd',
      name: 'SelectiveUI',
      sourcemap: false,
      banner,
    },
    plugins: [
      replace({ preventAssignment: true, 'process.env.NODE_ENV': JSON.stringify('production') }),
      resolve(),
      commonjs(),
      postcssMin,
      terserUMD,
      brotliPlugin(brotliOptions),
      typescript({
        tsconfig: './tsconfig.json',
        sourceMap: false
      }),
    ],
    treeshake,
  },

  // ESM minified - single file bundle
  {
    input: 'src/ts/index.ts',
    output: {
      file: 'dist/selective-ui.esm.min.js',
      format: 'esm',
      sourcemap: false,
      banner,
    },
    plugins: [
      replace({ preventAssignment: true, 'process.env.NODE_ENV': JSON.stringify('production') }),
      resolve(),
      commonjs(),
      postcssMin,
      terserESM,
      brotliPlugin(brotliOptions),
      typescript({
        tsconfig: './tsconfig.json',
        sourceMap: false
      }),
    ],
    treeshake,
  },
]);