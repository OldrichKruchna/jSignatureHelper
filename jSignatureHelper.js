jSigHelper = (function() {
	var chunkSeparator = '_' 
	, charmap = {} // {'1':'g','2':'h','3':'i','4':'j','5':'k','6':'l','7':'m','8':'n','9':'o','a':'p','b':'q','c':'r','d':'s','e':'t','f':'u','0':'v'}
	, charmap_reverse = {} // will be filled by 'uncompress*" function
	// need to split below for IE7 (possibly others), which does not understand string[position] it seems (returns undefined)
	, allchars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWX'.split('') 
	, bitness = allchars.length / 2
	, minus = 'Z'
	, plus = 'Y'
	
	for(var i = bitness-1; i > -1; i--){
		charmap[allchars[i]] = allchars[i+bitness]
		charmap_reverse[allchars[i+bitness]] = allchars[i]
	} 
	var remapTailChars = function(number){
		// for any given number as string, returning string with trailing chars remapped something like so:
		// '345' -> '3de'
		var chars = number.split('') 
		, l = chars.length
		// we are skipping first char. standard hex number char = delimiter
		for (var i = 1; i < l; i++ ){
			chars[i] = charmap[chars[i]]
		}
		return chars.join('')
	}
	, compressstrokeleg = function(data){
		// we convert half-stroke (only 'x' series or only 'y' series of numbers)
		// data is like this:
		// [517,516,514,513,513,513,514,516,519,524,529,537,541,543,544,544,539,536]
		// that is converted into this:
		// "5agm12100p1235584210m53"
		// each number in the chain is converted such:
		// - find diff from previous number
		// - first significant digit is kept as digit char. digit char = start of new number.
		// - consecutive numbers are mapped to letters, where 1 to 9 are A to I, 0 is O
		// Sign changes are denoted by "P" - plus, "M" for minus.
		var answer = []
		, lastwhole = 0
		, last = 0
		, lastpolarity = 1
		, l = data.length
		, nwhole, n, absn
		
		for(var i = 0; i < l; i++){
			// we start with whole coordinates for each point
			// coords are converted into series of vectors:
			// [512, 514, 520]
			// [512, +2, +6]
			nwhole = Math.round(data[i])
			n = nwhole - lastwhole			
			lastwhole = nwhole

			// inserting sign change when needed.
			if (n < 0 && lastpolarity > 0) {
				lastpolarity = -1
				answer.push(minus)
			}
			else if (n > 0 && lastpolarity < 0) {
				lastpolarity = 1
				answer.push(plus)
			}
			
			// since we have dealt with sign. let's absolute the value.
			absn = Math.abs(n)
			// adding number to list  We convert these to Hex before storing on the string.
			if (absn >= bitness) {
				answer.push(remapTailChars(absn.toString(bitness)))
			} else {
				answer.push(absn.toString(bitness))
			}
		}
		return answer.join('')
	}
	, uncompressstrokeleg = function(datastring){
		// we convert half-stroke (only 'x' series or only 'y' series of numbers)
		// datastring like this:
		// "5agm12100p1235584210m53"
		// is converted into this:
		// [517,516,514,513,513,513,514,516,519,524,529,537,541,543,544,544,539,536]
		// each number in the chain is converted such:
		// - digit char = start of new whole number. Alpha chars except "p","m" are numbers in hiding.
		//   These consecutive digist expressed as alphas mapped back to digit char.
		//   resurrected number is the diff between this point and prior coord.
		// - running polaritiy is attached to the number.
		// - we undiff (signed number + prior coord) the number.
		// - if char 'm','p', flip running polarity 
		var answer = []
		, chars = datastring.split('')
		, l = chars.length
		, ch
		, polarity = 1
		, partial = []
		, preprewhole = 0
		, prewhole
		for(var i = 0; i < l; i++){
			ch = chars[i]
			if (ch in charmap || ch === minus || ch === plus){
				// this is new number - start of a new whole number.
				// before we can deal with it, we need to flush out what we already 
				// parsed out from string, but keep in limbo, waiting for this sign
				// that prior number is done.
				// we deal with 3 numbers here:
				// 1. start of this number - a diff from previous number to 
				//    whole, new number, which we cannot do anything with cause
				//    we don't know its ending yet.
				// 2. number that we now realize have just finished parsing = prewhole
				// 3. number we keep around that came before prewhole = preprewhole

				if (partial.length !== 0) {
					// yep, we have some number parts in there.
					prewhole = parseInt( partial.join(''), bitness) * polarity + preprewhole
					answer.push( prewhole )
					preprewhole = prewhole
				}

				if (ch === minus){
					polarity = -1
					partial = []
				} else if (ch === plus){
					polarity = 1
					partial = []
				} else {
					// now, let's start collecting parts for the new number:
					partial = [ch]					
				}
			} else /* alphas replacing digits */ {
				// more parts for the new number
				partial.push(charmap_reverse[ch])
			}
		}
		// we always will have something stuck in partial
		// because we don't have closing delimiter
		answer.push( parseInt( partial.join(''), bitness ) * polarity + preprewhole )
		
		return answer
	}
	, compressstrokes = function(data){
		var answer = []
		, l = data.length
		, stroke
		for(var i = 0; i < l; i++){
			stroke = data[i] 
			answer.push(compressstrokeleg(stroke.x))
			answer.push(compressstrokeleg(stroke.y))
		}
		return answer.join(chunkSeparator)
	}
	, uncompressstrokes = function(datastring){
		var data = []
		, chunks = datastring.split(chunkSeparator)
		, l = chunks.length / 2
		for (var i = 0; i < l; i++){
			data.push({
				'x':uncompressstrokeleg(chunks[i*2])
				, 'y':uncompressstrokeleg(chunks[i*2+1])
			})
		}
		return data
	};

	
	
/*
 (c) 2013, Vladimir Agafonkin
 Simplify.js, a high-performance JS polyline simplification library
 mourner.github.io/simplify-js
*/

//(function () { 'use strict';

// to suit your point format, run search/replace for '.x' and '.y';
// for 3D version, see 3d branch (configurability would draw significant performance overhead)

// square distance between 2 points
function getSqDist(p1, p2) {

    var dx = p1.x - p2.x,
        dy = p1.y - p2.y;

    return dx * dx + dy * dy;
}

// square distance from a point to a segment
function getSqSegDist(p, p1, p2) {

    var x = p1.x,
        y = p1.y,
        dx = p2.x - x,
        dy = p2.y - y;

    if (dx !== 0 || dy !== 0) {

        var t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);

        if (t > 1) {
            x = p2.x;
            y = p2.y;

        } else if (t > 0) {
            x += dx * t;
            y += dy * t;
        }
    }

    dx = p.x - x;
    dy = p.y - y;

    return dx * dx + dy * dy;
}
// rest of the code doesn't care about point format

// basic distance-based simplification
function simplifyRadialDist(points, sqTolerance) {

    var prevPoint = points[0],
        newPoints = [prevPoint],
        point;

    for (var i = 1, len = points.length; i < len; i++) {
        point = points[i];

        if (getSqDist(point, prevPoint) > sqTolerance) {
            newPoints.push(point);
            prevPoint = point;
        }
    }

    if (prevPoint !== point) newPoints.push(point);

    return newPoints;
}

function simplifyDPStep(points, first, last, sqTolerance, simplified) {
    var maxSqDist = sqTolerance,
        index;

    for (var i = first + 1; i < last; i++) {
        var sqDist = getSqSegDist(points[i], points[first], points[last]);

        if (sqDist > maxSqDist) {
            index = i;
            maxSqDist = sqDist;
        }
    }

    if (maxSqDist > sqTolerance) {
        if (index - first > 1) simplifyDPStep(points, first, index, sqTolerance, simplified);
        simplified.push(points[index]);
        if (last - index > 1) simplifyDPStep(points, index, last, sqTolerance, simplified);
    }
}

// simplification using Ramer-Douglas-Peucker algorithm
function simplifyDouglasPeucker(points, sqTolerance) {
    var last = points.length - 1;

    var simplified = [points[0]];
    simplifyDPStep(points, 0, last, sqTolerance, simplified);
    simplified.push(points[last]);

    return simplified;
}

// both algorithms combined for awesome performance
function simplify(points, tolerance, highestQuality) {

    if (points.length <= 2) return points;

    var sqTolerance = tolerance !== undefined ? tolerance * tolerance : 1;

    points = highestQuality ? points : simplifyRadialDist(points, sqTolerance);
    points = simplifyDouglasPeucker(points, sqTolerance);

    return points;
}

// export as AMD module / Node module / browser or worker variable
// if (typeof define === 'function' && define.amd) define(function() { return simplify; });
// else if (typeof module !== 'undefined') module.exports = simplify;
// else if (typeof self !== 'undefined') self.simplify = simplify;
// else window.simplify = simplify;

//})();


	/**
	Vector class. Allows us to simplify representation and manipulation of coordinate-pair
	representing shift against (0, 0)

	@public
	@class
	@param
	@returns {Type}
	*/
	function Vector(x,y){
		this.x = x
		this.y = y
		this.reverse = function(){
			return new this.constructor( 
				this.x * -1
				, this.y * -1
			)
		}
		this._length = null
		this.getLength = function(){
			if (!this._length){
				this._length = Math.sqrt( Math.pow(this.x, 2) + Math.pow(this.y, 2) )
			}
			return this._length
		}
		
		var polarity = function (e){
			return Math.round(e / Math.abs(e))
		}
		this.resizeTo = function(length){
			// proportionally changes x,y such that the hypotenuse (vector length) is = new length
			if (this.x === 0 && this.y === 0){
				this._length = 0
			} else if (this.x === 0){
				this._length = length
				this.y = length * polarity(this.y)
			} else if(this.y === 0){
				this._length = length
				this.x = length * polarity(this.x)
			} else {
				var proportion = Math.abs(this.y / this.x)
					, x = Math.sqrt(Math.pow(length, 2) / (1 + Math.pow(proportion, 2)))
					, y = proportion * x
				this._length = length
				this.x = x * polarity(this.x)
				this.y = y * polarity(this.y)
			}
			return this
		}
		
		/**
		 * Calculates the angle between 'this' vector and another.
		 * @public
		 * @function
		 * @returns {Number} The angle between the two vectors as measured in PI. 
		 */
		this.angleTo = function(vectorB) {
			var divisor = this.getLength() * vectorB.getLength()
			if (divisor === 0) {
				return 0
			} else {
				// JavaScript floating point math is screwed up.
				// because of it, the core of the formula can, on occasion, have values
				// over 1.0 and below -1.0.
				return Math.acos(
					Math.min( 
						Math.max( 
							( this.x * vectorB.x + this.y * vectorB.y ) / divisor
							, -1.0
						)
						, 1.0
					)
				) / Math.PI
			}
		}
	}

	function Point(x,y){
		this.x = x
		this.y = y
		
		this.getVectorToCoordinates = function (x, y) {
			return new Vector(x - this.x, y - this.y)
		}
		this.getVectorFromCoordinates = function (x, y) {
			return this.getVectorToCoordinates(x, y).reverse()
		}
		this.getVectorToPoint = function (point) {
			return new Vector(point.x - this.x, point.y - this.y)
		}
		this.getVectorFromPoint = function (point) {
			return this.getVectorToPoint(point).reverse()
		}
	}

	/**
	Allows one to round a number to arbitrary precision.
	Math.round() rounds to whole only.
	Number.toFixed(precision) returns a string.
	I need float to float, but with arbitrary precision, hence:

	@public
	@function
	@param number {Number}
	@param position {Number} number of digits right of decimal point to keep. If negative, rounding to the left of decimal.
	@returns {Type}
	*/
	function round (number, position){
		var tmp = Math.pow(10, position)
		return Math.round( number * tmp ) / tmp
	}

	//	/**
	//	 * This is a simple, points-to-lines (not curves) renderer. 
	//	 * Keeping it around so we can activate it from time to time and see
	//	 * if smoothing logic is off much.
	//	 * @public
	//	 * @function
	//	 * @returns {String} Like so "l 1 2 3 5' with stroke as long line chain. 
	//	 */
	//	function compressstroke(stroke, shiftx, shifty){
	//		// we combine strokes data into string like this:
	//		// 'M 53 7 l 1 2 3 4 -5 -6 5 -6'
	//		// see SVG documentation for Path element's 'd' argument.
	//		var lastx = stroke.x[0]
	//		, lasty = stroke.y[0]
	//		, i
	//		, l = stroke.x.length
	//		, answer = ['M', lastx - shiftx, lasty - shifty, 'l']
	//		
	//		if (l === 1){
	//			// meaning this was just a DOT, not a stroke.
	//			// instead of creating a circle, we just create a short line
	//			answer.concat(1, -1)
	//		} else {
	//			for(i = 1; i < l; i++){
	//				answer = answer.concat(stroke.x[i] - lastx, stroke.y[i] - lasty)
	//				lastx = stroke.x[i]
	//				lasty = stroke.y[i]
	//			}
	//		}
	//		return answer.join(' ')
	//	} 

	function segmentToCurve(stroke, positionInStroke, lineCurveThreshold){
		'use strict'
		// long lines (ones with many pixels between them) do not look good when they are part of a large curvy stroke.
		// You know, the jaggedy crocodile spine instead of a pretty, smooth curve. Yuck!
		// We want to approximate pretty curves in-place of those ugly lines.
		// To approximate a very nice curve we need to know the direction of line before and after.
		// Hence, on long lines we actually wait for another point beyond it to come back from
		// mousemoved before we draw this curve.
		
		// So for "prior curve" to be calc'ed we need 4 points 
		// 	A, B, C, D (we are on D now, A is 3 points in the past.)
		// and 3 lines:
		//  pre-line (from points A to B), 
		//  this line (from points B to C), (we call it "this" because if it was not yet, it's the only one we can draw for sure.) 
		//  post-line (from points C to D) (even through D point is 'current' we don't know how we can draw it yet)
		//
		// Well, actually, we don't need to *know* the point A, just the vector A->B

		// Again, we can only derive curve between points positionInStroke-1 and positionInStroke
		// Thus, since we can only draw a line if we know one point ahead of it, we need to shift our focus one point ahead.
		positionInStroke += 1
		// Let's hope the code that calls us knows we do that and does not call us with positionInStroke = index of last point.
		
		var Cpoint = new Point(stroke.x[positionInStroke-1], stroke.y[positionInStroke-1])
			, Dpoint = new Point(stroke.x[positionInStroke], stroke.y[positionInStroke])
			, CDvector = Cpoint.getVectorToPoint(Dpoint)
		// Again, we have a chance here to draw only PREVIOUS line segment - BC
		
		// So, let's start with BC curve.
		// if there is only 2 points in stroke array (C, D), we don't have "history" long enough to have point B, let alone point A.
		// so positionInStroke should start with 2, ie
		// we are here when there are at least 3 points in stroke array.
		var Bpoint = new Point(stroke.x[positionInStroke-2], stroke.y[positionInStroke-2])
		, BCvector = Bpoint.getVectorToPoint(Cpoint)
		, ABvector
		, rounding = 2
		
		if ( BCvector.getLength() > lineCurveThreshold ){
			// Yey! Pretty curves, here we come!
			if(positionInStroke > 2) {
				ABvector = (new Point(stroke.x[positionInStroke-3], stroke.y[positionInStroke-3])).getVectorToPoint(Bpoint)
			} else {
				ABvector = new Vector(0,0)
			}
			var minlenfraction = 0.05
			, maxlen = BCvector.getLength() * 0.35
			, ABCangle = BCvector.angleTo(ABvector.reverse())
			, BCDangle = CDvector.angleTo(BCvector.reverse())
			, BtoCP1vector = new Vector(ABvector.x + BCvector.x, ABvector.y + BCvector.y).resizeTo(
				Math.max(minlenfraction, ABCangle) * maxlen
			)
			, CtoCP2vector = (new Vector(BCvector.x + CDvector.x, BCvector.y + CDvector.y)).reverse().resizeTo(
				Math.max(minlenfraction, BCDangle) * maxlen
			)
			, BtoCP2vector = new Vector(BCvector.x + CtoCP2vector.x, BCvector.y + CtoCP2vector.y)
			
			// returing curve for BC segment
			// all coords are vectors against Bpoint
			return [
				'c' // bezier curve
				, round( BtoCP1vector.x, rounding )
				, round( BtoCP1vector.y, rounding )
				, round( BtoCP2vector.x, rounding )
				, round( BtoCP2vector.y, rounding )
				, round( BCvector.x, rounding )
				, round( BCvector.y, rounding )
			]
		} else {
			return [
				'l' // line
				, round( BCvector.x, rounding )
				, round( BCvector.y, rounding )
			]
		}
	}

	function lastSegmentToCurve(stroke, lineCurveThreshold){
		'use strict'
		// Here we tidy up things left unfinished
		
		// What's left unfinished there is the curve between the last points
		// in the stroke
		// We can also be called when there is only one point in the stroke (meaning, the 
		// stroke was just a dot), in which case there is nothing for us to do.

		// So for "this curve" to be calc'ed we need 3 points 
		// 	A, B, C
		// and 2 lines:
		//  pre-line (from points A to B), 
		//  this line (from points B to C) 
		// Well, actually, we don't need to *know* the point A, just the vector A->B
		// so, we really need points B, C and AB vector.
		var positionInStroke = stroke.x.length - 1
		
		// there must be at least 2 points in the stroke.for us to work. Hope calling code checks for that.
		var Cpoint = new Point(stroke.x[positionInStroke], stroke.y[positionInStroke])
		, Bpoint = new Point(stroke.x[positionInStroke-1], stroke.y[positionInStroke-1])
		, BCvector = Bpoint.getVectorToPoint(Cpoint)
		, rounding = 2
		
		if (positionInStroke > 1 && BCvector.getLength() > lineCurveThreshold){
			// we have at least 3 elems in stroke
			var ABvector = (new Point(stroke.x[positionInStroke-2], stroke.y[positionInStroke-2])).getVectorToPoint(Bpoint)
			, ABCangle = BCvector.angleTo(ABvector.reverse())
			, minlenfraction = 0.05
			, maxlen = BCvector.getLength() * 0.35
			, BtoCP1vector = new Vector(ABvector.x + BCvector.x, ABvector.y + BCvector.y).resizeTo(
				Math.max(minlenfraction, ABCangle) * maxlen
			)
			
			return [
				'c' // bezier curve
				, round( BtoCP1vector.x, rounding )
				, round( BtoCP1vector.y, rounding )
				, round( BCvector.x, rounding ) // CP2 is same as Cpoint
				, round( BCvector.y, rounding ) // CP2 is same as Cpoint
				, round( BCvector.x, rounding )
				, round( BCvector.y, rounding )
			]
		} else {
			// Since there is no AB leg, there is no curve to draw. This is just line
			return [
				'l' // simple line
				, round( BCvector.x, rounding )
				, round( BCvector.y, rounding )
			]
		}
	}

	function addstroke(stroke, shiftx, shifty){
		'use strict'
		// we combine strokes data into string like this:
		// 'M 53 7 l 1 2 c 3 4 -5 -6 5 -6'
		// see SVG documentation for Path element's 'd' argument.
		var lines = [
			'M' // move to
			, round( (stroke.x[0] - shiftx), 2)
			, round( (stroke.y[0] - shifty), 2)
		]
		// processing all points but first and last. 
		, i = 1 // index zero item in there is STARTING point. we already extracted it.
		, l = stroke.x.length - 1 // this is a trick. We are leaving last point coordinates for separate processing.
		, lineCurveThreshold = 1
		
		for(; i < l; i++){
			lines.push.apply(lines, segmentToCurve(stroke, i, lineCurveThreshold))
		}
		if (l > 0 /* effectively more than 1, since we "-1" above */){
			lines.push.apply(lines, lastSegmentToCurve(stroke, i, lineCurveThreshold))
		} else if (l === 0){
			// meaning we only have ONE point in the stroke (and otherwise refer to the stroke as "dot")
			lines.push.apply(lines, ['l' , 1, 1])
		}
		return lines.join(' ')
	}

	function simplifystroke(stroke){
		var d = []
		, newstroke = {'x':[], 'y':[]}
		, i, l
		
		for (i = 0, l = stroke.x.length; i < l; i++){
			d.push({'x':stroke.x[i], 'y':stroke.y[i]})
		}
		d = simplify(d, 0.7, true)
		for (i = 0, l = d.length; i < l; i++){
			newstroke.x.push(d[i].x)
			newstroke.y.push(d[i].y)
		}		
		return newstroke
	}

	// generate SVG style from settings
	function styleFromSettings(settings){
		var styles = [];
		var meta = [
			// ["style attr", "key in settings", "default value"]
			["fill", undefined, "none"],
			["stroke", "color", "#000000"],
			["stroke-width", "lineWidth", 2],
			["stroke-linecap", undefined, "round"],
			["stroke-linejoin", undefined, "round"]
		];
		for (var i = meta.length - 1; i >= 0; i--){
			var attr = meta[i][0]
			, key = meta[i][1]
			, defaultVal = meta[i][2];
			styles.push(attr + '="' + (key in settings && settings[key] ? settings[key] : defaultVal) + '"');
		}
		return styles.join(' ');
	}

	function compressstrokesSVG(data, settings){
		'use strict'
		var answer = [
			'<?xml version="1.0" encoding="UTF-8" standalone="no"?>'
			, '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">'
	    ]
		, i , l = data.length
		, stroke
		, xlimits = []
		, ylimits = []
		, sizex = 0
		, sizey = 0
		, shiftx = 0
		, shifty = 0
		, minx, maxx, miny, maxy, padding = 1
		, simplifieddata = []
		
		if(l !== 0){
			for(i = 0; i < l; i++){
				stroke = simplifystroke( data[i] )
				simplifieddata.push(stroke)
				xlimits = xlimits.concat(stroke.x)
				ylimits = ylimits.concat(stroke.y)
			}
			 
			minx = Math.min.apply(null, xlimits) - padding
			maxx = Math.max.apply(null, xlimits) + padding
			miny = Math.min.apply(null, ylimits) - padding
			maxy = Math.max.apply(null, ylimits) + padding
			shiftx = minx < 0? 0 : minx
			shifty = miny < 0? 0 : miny
			sizex = maxx - minx
			sizey = maxy - miny
		}
		
		answer.push(
			'<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="'+ 
			sizex.toString() +
			'" height="'+ 
			sizey.toString() +
			'">'
		)
		
	//		// This is a nice idea: use style declaration on top, and mark the lines with 'class="f"'
	//		// thus saving space in svg... 
	//		// alas, many SVG renderers don't understand "class" and render the strokes in default "fill = black, no stroke" style. Ugh!!!
	//		// TODO: Rewrite ImageMagic / GraphicsMagic, InkScape, http://svg.codeplex.com/ to support style + class. until then, we hardcode the stroke style within the path. 
	//		answer.push(
	//			'<style type="text/css"><![CDATA[.f {fill:none;stroke:#000000;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}]]></style>'
	//		)

	//		// This set is accompaniment to "simple line renderer" - compressstroke
	//		answer.push(
	//			'<style type="text/css"><![CDATA[.t {fill:none;stroke:#FF0000;stroke-width:2}]]></style>'
	//		)
	//		for(i = 0; i < l; i++){
	//			stroke = data[i]
	//			// This one is accompaniment to "simple line renderer"
	//			answer.push('<path class="t" d="'+ compressstroke(stroke, shiftx, shifty) +'"/>')
	//		}

		for(i = 0, l = simplifieddata.length; i < l; i++){
			stroke = simplifieddata[i]
			answer.push('<path ' + styleFromSettings(settings) + ' d="'+ addstroke(stroke, shiftx, shifty) + '"/>')
		}
		answer.push('</svg>')
		return answer.join('')
	}

	function compressstrokesPaths(data, settings){
		'use strict'
		var answer = {paths:[]}
		, i , l = data.length
		, stroke
		, xlimits = []
		, ylimits = []
		, sizex = 0
		, sizey = 0
		, shiftx = 0
		, shifty = 0
		, minx, maxx, miny, maxy, padding = 1
		, simplifieddata = []
		
		if(l !== 0){
			for(i = 0; i < l; i++){
				stroke = simplifystroke( data[i] )
				simplifieddata.push(stroke)
				xlimits = xlimits.concat(stroke.x)
				ylimits = ylimits.concat(stroke.y)
			}
			 
			minx = Math.min.apply(null, xlimits) - padding
			maxx = Math.max.apply(null, xlimits) + padding
			miny = Math.min.apply(null, ylimits) - padding
			maxy = Math.max.apply(null, ylimits) + padding
			shiftx = minx < 0? 0 : minx
			shifty = miny < 0? 0 : miny
			sizex = maxx - minx
			sizey = maxy - miny
		}
		
		answer.width=sizex;
		answer.height=sizey;
		
		for(i = 0, l = simplifieddata.length; i < l; i++){
			stroke = simplifieddata[i]
			answer.paths.push(addstroke(stroke, shiftx, shifty))
		}
		return answer
	}
	
	if (typeof btoa !== 'function')
	{
		var btoa = function(data) {
/** @preserve
base64 encoder
MIT, GPL
http://phpjs.org/functions/base64_encode
+   original by: Tyler Akins (http://rumkin.com)
+   improved by: Bayron Guevara
+   improved by: Thunder.m
+   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
+   bugfixed by: Pellentesque Malesuada
+   improved by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
+   improved by: Rafal Kukawski (http://kukawski.pl)

*/
		    var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/="
		    , b64a = b64.split('')
		    , o1, o2, o3, h1, h2, h3, h4, bits, i = 0,
	        ac = 0,
	        enc = "",
	        tmp_arr = [];
		 
		    do { // pack three octets into four hexets
		        o1 = data.charCodeAt(i++);
		        o2 = data.charCodeAt(i++);
		        o3 = data.charCodeAt(i++);
		 
		        bits = o1 << 16 | o2 << 8 | o3;
		 
		        h1 = bits >> 18 & 0x3f;
		        h2 = bits >> 12 & 0x3f;
		        h3 = bits >> 6 & 0x3f;
		        h4 = bits & 0x3f;
		 
		        // use hexets to index into b64, and append result to encoded string
		        tmp_arr[ac++] = b64a[h1] + b64a[h2] + b64a[h3] + b64a[h4];
		    } while (i < data.length);

		    enc = tmp_arr.join('');
		    var r = data.length % 3;
		    return (r ? enc.slice(0, r - 3) : enc) + '==='.slice(r || 3);

		    // end of base64 encoder MIT, GPL
		}
	}

	var unencodedmime = 'image/svg+xml'
	function getUnencodedSVG(data, settings){
		return [unencodedmime , compressstrokesSVG(data, settings)];
	}

	var base64encodedmime = 'image/svg+xml;base64'
	function getBase64encodedSVG(data, settings){

		return [base64encodedmime , btoa( compressstrokesSVG(data, settings) )];
	} 

	function base30toSVG(data, settings){
		var native = uncompressstrokes(data);
		var _settings = {
			color: "rgb(0, 0, 0)",
			lineWidth: 2
		};
		if (settings && settings.color) _settings.color = settings.color;
		if (settings && settings.lineWidth) _settings.lineWidth = settings.lineWidth;
		
		return getUnencodedSVG(native, _settings);
	}

	function base30toPaths(data){
		var native = uncompressstrokes(data);
		return compressstrokesPaths(native);
	}
	
	return {
		base30toSVG: base30toSVG,
		base30toPaths: base30toPaths
	}
}());
