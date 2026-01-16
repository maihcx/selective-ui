import { defineConfig } from 'rollup';
import type { RollupOptions } from 'rollup';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import replace from '@rollup/plugin-replace';
import postcss from 'rollup-plugin-postcss';
import terser from '@rollup/plugin-terser';
import brotliPlugin from 'rollup-plugin-brotli';
import typescript from '@rollup/plugin-typescript';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';

import { readFileSync } from 'node:fs';

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8')
);

const banner = `/*! Selective UI v${pkg.version} | MIT License */`;
const treeshake: RollupOptions['treeshake'] = { preset: 'recommended' };


const PUBLIC_IDENTIFIERS = [
  'SelectiveUI',
  'bind', 'find', 'destroy', 'rebind', 'effector', 'version'
];

const EFFECTOR_METHODS = [
  'cancel',
  'expand',
  'collapse',
  'showSwipeWidth',
  'hideSwipeWidth',
];

const FIND_PROPERTIES = [
  'targetElement',
  'placeholder',
  'oldValue',
  'value',
  'valueArray',
  'valueString',
  'valueOptions',
  'valueDataset',
  'mask',
  'valueText',
  'isOpen',
  'selectAll',
  'deSelectAll',
  'setValue',
  'open',
  'close',
  'toggle',
  'change',
  'refreshMask',
  'on',
  'ajax',
  'isEmpty',
  'load',
  'beforeShow',
  'show',
  'beforeChange',
  'change',
  'beforeClose',
  'close',
  'stopPropagation',
  'cancel',
  'isCancel',
  'isContinue',
  'loadAjax',
];

const DATA_PROPERTIES = [
  'showPanel',
  'accessoryStyle',
  'multiple',
  'minWidth',
  'width',
  'offsetWidth',
  'minHeight',
  'height',
  'panelHeight',
  'panelMinHeight',
  'disabled',
  'readonly',
  'selectall',
  'keepSelected',
  'placeholder',
  'altMask',
  'autoclose',
  'autoscroll',
  'autofocus',
  'searchable',
  'loadingfield',
  'visible',
  'skipError',
  'customDelimiter',
  'textLoading',
  'textNoData',
  'textNotFound',
  'textSelectAll',
  'textDeselectAll',
  'textAccessoryDeselect',
  'animationtime',
  'delaysearchtime',
  'allowHtml',
  'maxSelected',
  'labelHalign',
  'labelValign',
  'imageMode',
  'imageWidth',
  'imageHeight',
  'imageBorderRadius',
  'imagePosition',
  'ajax',
  'block',
];

const OPTIONTAG_PROPERTIES = [
  'imgsrc',
  'id',
  'text',
  'mask',
  'mask',
  'collapsed',
  'isMultiple',
  'hasImage',
  'page',
  'totalPages',
  'total_page',
  'items',
  'pagination',
  'hasMore',
  'keyword',
  'selectedValue',
];

const PUBLIC_PROPERTIES = [
  'SelectiveUI',
  'bind', 'find', 'destroy', 'rebind', 'effector', 'version',
  ...EFFECTOR_METHODS,
  ...FIND_PROPERTIES,
  ...DATA_PROPERTIES,
  ...OPTIONTAG_PROPERTIES,
];

const brotliOptions = {
  filter: /\.(js|css|mjs|json|html|svg)$/i,
  additionalFiles: [] as string[],
  minSize: 0,
  fileName: (filename: string) => `${filename}.br`,
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
    reserved: PUBLIC_IDENTIFIERS,
    properties: {
      reserved: PUBLIC_PROPERTIES,
      regex: /.*/,
      keep_quoted: true,
      builtins: false
    },
  },
});

const terserESM = terser({
  module: true,
  ecma: 2020,
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
    reserved: PUBLIC_IDENTIFIERS,
    properties: {
      reserved: PUBLIC_PROPERTIES,
      regex: /.*/,
      keep_quoted: true,
      builtins: false
    },
  },
});

export default defineConfig([
  // UMD (non-min)
  {
    input: 'src/ts/global.ts',
    output: {
      file: 'dist/selective-ui.umd.js',
      format: 'umd',
      name: 'SelectiveUI',
      sourcemap: true,
      banner,
    },
    plugins: [
      replace({
        preventAssignment: true,
        __LIB_VERSION__: JSON.stringify(pkg.version),
        __LIB_NAME__: JSON.stringify('SelectiveUI'),
        'process.env.NODE_ENV': JSON.stringify('production'),
      }),
      resolve(),
      commonjs(),
      postcssNonMin,
      typescript({
        tsconfig: './tsconfig.json',
        sourceMap: true,
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
      replace({
        preventAssignment: true,
        __LIB_VERSION__: JSON.stringify(pkg.version),
        __LIB_NAME__: JSON.stringify('SelectiveUI'),
        'process.env.NODE_ENV': JSON.stringify('production'),
      }),
      resolve(),
      commonjs(),
      postcssNonMin,
      typescript({
        tsconfig: './tsconfig.json',
        sourceMap: true,
      }),
    ],
    treeshake,
  },

  // UMD minified
  {
    input: 'src/ts/global.ts',
    output: {
      file: 'dist/selective-ui.min.js',
      format: 'umd',
      name: 'SelectiveUI',
      sourcemap: false,
      banner,
    },
    plugins: [
      replace({
        preventAssignment: true,
        __LIB_VERSION__: JSON.stringify(pkg.version),
        __LIB_NAME__: JSON.stringify('SelectiveUI'),
        'process.env.NODE_ENV': JSON.stringify('production'),
      }),
      typescript({
        tsconfig: './tsconfig.json',
        sourceMap: false,
      }),
      resolve(),
      commonjs(),
      postcssMin,
      terserUMD,
      brotliPlugin(brotliOptions),
    ],
    treeshake,
  },

  // ESM minified
  {
    input: 'src/ts/index.ts',
    output: {
      file: 'dist/selective-ui.esm.min.js',
      format: 'esm',
      sourcemap: false,
      banner,
    },
    plugins: [
      replace({
        preventAssignment: true,
        __LIB_VERSION__: JSON.stringify(pkg.version),
        __LIB_NAME__: JSON.stringify('SelectiveUI'),
        'process.env.NODE_ENV': JSON.stringify('production'),
      }),
      typescript({
        tsconfig: './tsconfig.json',
        sourceMap: false,
      }),
      resolve(),
      commonjs(),
      postcssMin,
      terserESM,
      brotliPlugin(brotliOptions),
    ],
    treeshake,
  },
]);