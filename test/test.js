// Kaiser.options.logEnabled = true;

Kaiser.Middleware.create('offline', function($el) {
    var $clone = $el.clone(true);

    $clone.online = function() {
        $el.replaceWith($clone);
        $el = $clone;
    };

    return $clone;
});

Kaiser.Middleware.create('compileHtml', function($element, model) {
    var offline = Kaiser.from('Middleware').import('offline');
    var bracketMatcher = /\{\{(.+?)\}\}/g;
    var propMatcher = /([.A-Za-z0-9_-]+)/g;
    var shadow = offline($element);
    var shadowString = shadow.html();
    var props = shadowString.match(bracketMatcher);

    function getProperty(propertyName, object) {
        var parts = propertyName.split('.');
        var length = parts.length;
        var property = object || this;

        for (var i = 0; i < length; i++) {
            property = property[parts[i]];
        }

        return property;
    }

    _.forEach(props, function(prop) {
        var trimmedProp = prop.match(propMatcher)[0];
        if (trimmedProp.indexOf('.') !== -1) {
            trimmedProp = getProperty(trimmedProp, model);
        } else {
            trimmedProp = model[trimmedProp];
        }
        shadowString = shadowString.replace(prop, trimmedProp);
    });

    shadow.html(shadowString).online();

    return shadow;
});

Kaiser.Directive.create('k-click', function(scope, $element, data) {
    scope.listenTo('click', $element, data);
    return scope;
});

Kaiser.Directive.create('k-model', function(scope, $element, data) {
    var compileHtml = Kaiser.from('Middleware').import('compileHtml');
    var model = scope[data];
    $element = compileHtml($element, model);
    $element.css({ visibility: 'visible' });
    return scope;
});


Kaiser.Module.create('testModule', function(scope) {

    scope.init = function() {
        // this is called when the feature is loaded to kickoff non event-driven functions
        console.log('testModule scope: ', scope);
    };

    scope.events = {
        'click .click-me': 'clickHandler'
    };

    scope.clickHandler = function() {
        console.log('button was clicked');
        scope.$('#color-change').css({ background: randomColor() });
    };

    scope.directiveTest = function(e) {
    	console.log('macro test', e);
    };

    scope.personModel = {
        name: {
            first: 'Wes',
            last: 'Cravens'
        },
        age: 24
    };


    function randomColor() {
        return (function(m,s,c){return (c ? arguments.callee(m,s,c-1) : '#') + s[m.floor(m.random() * s.length)]})(Math,'0123456789ABCDEF',5);
    }

    return scope;

});

$(function() {
    Kaiser.init();
});