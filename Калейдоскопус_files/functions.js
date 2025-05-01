downloadAsPNG = (renderer, sprite, fileName) => {
	renderer.extract.canvas(sprite).toBlob(function(b){
		var a = document.createElement('a');
		document.body.append(a);
		a.download = fileName;
		a.href = URL.createObjectURL(b);
		a.click();
		a.remove();
	}, 'image/png');
}

getDB = timeDomainDataArray => {
    var array = [...timeDomainDataArray];
    return array.reduce(
        (accumulator, currentValue) =>
        Math.max(accumulator, Math.abs(currentValue - 127)),
        0
    );
}

getFreqIndex = frequencyDataArray => {
    // return frequencyDataArray.indexOf(Math.max(...frequencyDataArray));
    
    var array = [];
    var max = 0;
    frequencyDataArray.map( (v, index) => {
        if ( index < 48 ) {
            var newV = Math.floor(v * Math.pow((index + 1) / 48, 1/3));
            array.push(newV);
            if ( max < newV ) max = newV;
        }
    });
    // console.log(array.indexOf(max));
    return array.indexOf(max);
}

function hsl2rgb(h, s, l){
    var r, g, b;

    if(s == 0){
        r = g = b = l; // achromatic
    }else{
        var hue2rgb = function hue2rgb(p, q, t){
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function componentToHex(c) {
    var hex = c.toString(16);
    return hex.length == 1 ? "0" + hex : hex;
  }
  
  function rgb2hex(rgb) {
    return parseInt("0x" + componentToHex(rgb[0]) + componentToHex(rgb[1]) + componentToHex(rgb[2]));
  }