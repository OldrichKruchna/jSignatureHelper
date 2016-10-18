# jSignatureHelper
jSignatureHelper forked from https://gist.github.com/mattgaspar/170e00731711e8bb94e1

This helper allows export jSignature signatures to SVG without DOM
https://github.com/willowsystems/jSignature

## Installation with bower
bower install jsignaturehelper

## Installation with npm
npm install jsignaturehelper

## Usage
### export from base30 to SVG
jSigHelper.base30toSVG(base30sig)
### export from base30 to base64 SVG
jSigHelper.base30toBase64SVG(base30sig)
### export from base30 to path data in array (used for drawing signature in PDF)
jSigHelper.base30toPaths(base30sig)