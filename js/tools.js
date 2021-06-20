var _prop_cache = null;

var Tools = {
	randomRange : function(min, max) {
		return min + Math.random() * (max - min);
	},
	map : function(value, min1, max1, min2, max2) {
		return Tools.lerp( Tools.norm(value, min1, max1), min2, max2);
	},
	lerp : function(value, min, max){
		return min + (max -min) * value;
	},
	norm : function(value , min, max){
		return (value - min) / (max - min);
	},
	randomVector3: function(range){
		return new THREE.Vector3(Tools.randomRange(-range,range),Tools.randomRange(-range,range),Tools.randomRange(-range,range));
    },
    shuffle : function(o) {
		for (var j, x, i = o.length; i; j = parseInt(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
		return o;
	},
	debug: function (msg) {
		
	}
};

function _getHiddenProp(){
    var prefixes = ['webkit','moz','ms','o'];
    
    if ('hidden' in document) return 'hidden';
    
    for (var i = 0; i < prefixes.length; i++){
        if ((prefixes[i] + 'Hidden') in document) 
            return prefixes[i] + 'Hidden';
    }

    return null;
}

function _isDocumentHidden() {
	if (!_prop_cache) {
		_prop_cache = _getHiddenProp();
	}
    if (!_prop_cache) return false;
    
    return document[_prop_cache];
}