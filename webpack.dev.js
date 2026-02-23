import path from 'path';
import { fileURLToPath } from 'url';
import webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyPlugin from 'copy-webpack-plugin';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  mode: 'development',
  entry: path.resolve(__dirname, 'src', 'index.js'),
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: '[name].[contenthash].js',
    assetModuleFilename: 'assets/[hash][ext][query]',
    clean: true,
  },
  plugins: [
    new HtmlWebpackPlugin({ template: path.resolve(__dirname, 'src', 'index.html') }),
    new CopyPlugin({
      patterns: [
 {
 from: path.resolve(__dirname, 'ICONS-LICENSE.md'), to: 'ICONS-LICENSE.md'
},
],
    }),
    new webpack.DefinePlugin({ __API_URL__: JSON.stringify(process.env.API_URL), }),
  ],
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        resolve: { fullySpecified: false },
        use: {
          loader: 'babel-loader',
          options: {
            presets: [ '@babel/preset-env' ],
            sourceMaps: true,
          },
        },
      },
      {
        test: /\.css$/i,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: { sourceMap: true },
          },
        ],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
      },
    ],
  },
  devtool: 'source-map',
  devServer: {
    port: 5000,
    open: true,
  },
};
