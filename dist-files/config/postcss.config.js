module.exports = {
  plugins: [
    require('tailwindcss'),
    require('postcss-preset-env'),
    // process.env.NODE_ENV === 'production'
    //   ? require('postcss-preset-env')
    //   : null, // For no processing in dev
    //   : require('autoprefixer'), // For some processing in dev
    // If PostCSS is too slow in development,
    // use above ternary to limit to production
    // https://flaviocopes.com/tailwind-setup/#in-development-avoid-too-much-processing
    process.env.NODE_ENV === 'production' ? require('cssnano') : null,
  ],
};
