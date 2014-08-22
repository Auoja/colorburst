var ColorBurst = (function() {

    var THUMBNAIL_SIZE = 100;
    var BRIGHTNESS_THRESHOLD = 0.4;
    var BORDER_SIZE = 1;

    var floor = function(n) {
        return Math.floor(n);
    };

    var abs = function(n) {
        return Math.abs(n);
    };

    var sqrt = function(n) {
        return Math.sqrt(n);
    };

    var pow = function(n) {
        return Math.pow(n, 2);
    };

    var formatOutput = function(color) {
        return 'rgb(' + floor(color[0] * 255) + ', ' + floor(color[1] * 255) + ', ' + floor(color[2] * 255) + ')';
    };

    var rgbToYuv = function(rgb) {
        return [
            rgb[0] *  0.299 + rgb[1] * 0.587 + rgb[2] * 0.114,
            rgb[0] * -0.147 + rgb[1] * 0.289 + rgb[2] * 0.436,
            rgb[0] *  0.615 + rgb[1] * 0.515 + rgb[2] * 0.100
        ];
    };

    var colorDistance = function(rgb1, rgb2) {
        var yuv1 = rgbToYuv(rgb1);
        var yuv2 = rgbToYuv(rgb2);
        return sqrt(pow(yuv1[0] - yuv2[0]) + pow(yuv1[1] - yuv2[1]) + pow(yuv1[2] - yuv2[2]));
    };

    var colorBrightness = function(rgb) {
        return sqrt(pow(rgb[0]) * 0.241 + pow(rgb[1]) * 0.691 + pow(rgb[2]) * 0.068);
    };

    var gatherSimilarColors = function(colorList, comparator) {

        var subsets = [];

        for (var i = 0, I = colorList.length; i < I; i++) {
            var color = colorList[i];

            for (var j = 0, J = subsets.length; j < J; j++) {
                if (comparator(subsets[j][0], color)) {
                    break;
                }
            }

            if (j === J) {
                subsets.push([]);
            }

            subsets[j].push(color);
        }

        return subsets;
    };

    var meanColor = function(colorList) {

        var finalColor = [0, 0, 0];

        for (var i = 0, I = colorList.length; i < I; i++) {
            var color = colorList[i];

            finalColor[0] += color[0];
            finalColor[1] += color[1];
            finalColor[2] += color[2];
        }

        finalColor[0] /= colorList.length;
        finalColor[1] /= colorList.length;
        finalColor[2] /= colorList.length;

        return finalColor;
    };

    var dominantColor = function(conf) {

        var colorList = conf.colorList;
        var threshold = conf.threshold;
        var count = conf.count;

        if (typeof count === 'undefined') {
            count = null;
        }

        var colorComparator = function(colorA, colorB) {
            return colorDistance(colorA, colorB) < threshold;
        };

        var bucketSort = function(bucketA, bucketB) {
            return bucketB.length - bucketA.length;
        };

        var buckets = gatherSimilarColors(colorList, colorComparator).sort(bucketSort);

        if (count === -1) {
            count = buckets.length;
        }

        if (count === 1) {
            return meanColor(buckets.shift());
        }

        return buckets.slice(0, count).map(function(bucket) {
            return meanColor(bucket);
        });
    };

    var createCanvas = function() {
        return document.createElement('canvas');
    };

    var loadDataFromContext = function(destination, context, x, y, width, height) {
        var data = context.getImageData(x, y, width, height).data;

        for (var i = 0, I = data.length; i < I; i += 4) {
            destination.push([
                data[i + 0] / 255,
                data[i + 1] / 255,
                data[i + 2] / 255
            ]);
        }
    };

    var extractColors = function(conf) {

        var image = conf.image;
        var useThumbnail = conf.useThumbnail || false;
        var threshold = conf.threshold || 0.1;

        var canvas = createCanvas();
        var context = canvas.getContext('2d');

        canvas.width = image.width;
        canvas.height = image.height;

        if (useThumbnail) {
            var widthRatio = Math.max(1, image.width / THUMBNAIL_SIZE);
            var heightRatio = Math.max(1, image.height / THUMBNAIL_SIZE);
            var maxRatio = Math.max(widthRatio, heightRatio);

            canvas.width = image.width / maxRatio;
            canvas.height = image.height / maxRatio;
        }

        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        var borderImageData = [];
        loadDataFromContext(borderImageData, context, 0, 0, canvas.width - BORDER_SIZE, BORDER_SIZE);
        loadDataFromContext(borderImageData, context, canvas.width - BORDER_SIZE, 0, BORDER_SIZE, canvas.height - BORDER_SIZE);
        loadDataFromContext(borderImageData, context, BORDER_SIZE, canvas.height - BORDER_SIZE, canvas.width - BORDER_SIZE, BORDER_SIZE);
        loadDataFromContext(borderImageData, context, 0, BORDER_SIZE, BORDER_SIZE, canvas.height - BORDER_SIZE);

        var centerImageData = [];
        loadDataFromContext(centerImageData, context, BORDER_SIZE, BORDER_SIZE, canvas.width - BORDER_SIZE, canvas.height - BORDER_SIZE);

        var backgroundColor = dominantColor({
            colorList: borderImageData,
            threshold: threshold,
            count: 1
        });

        var centerColors = dominantColor({
            colorList: centerImageData,
            threshold: threshold,
            count: -1
        });

        var colorFilter = function(color) {
            return abs(colorBrightness(backgroundColor) - colorBrightness(color)) > BRIGHTNESS_THRESHOLD;
        };

        var colorReduction = function(filteredContentColors, currentColor) {
            var previous = filteredContentColors[filteredContentColors.length - 1];

            if (!previous || colorDistance(previous, currentColor) > 0.3) {
                filteredContentColors.push(currentColor);
            }

            return filteredContentColors;
        };

        centerColors = centerColors.filter(colorFilter).reduce(colorReduction, []);

        backgroundColor = formatOutput(backgroundColor);
        centerColors = centerColors.map(formatOutput);

        return {
            backgroundColor: backgroundColor,
            centerColors: centerColors
        };
    };

    return {
        extractColors: extractColors
    };

})();