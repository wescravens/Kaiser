#Kaiser
####_A conventional way to write JS_

###Install with bower

```
bower install kaiser
```

###Create your first module

#####JS

```
Kaiser.Module.create('myModule', function(scope) {
    
    scope.init = function() {
        // initialize non event-driven, module-specific functionality here
    };
    
    // the events in this object will be bound to the specified element
    // and call the function returned in the scope
    
    scope.events = {
        'click .my-button': 'clickHandler'
    };
    
    scope.clickHandler = function() {
        myLocalFunction();
    };
    
    function myLocalFunction() {
        console.log('button was clicked');
    }
    
    // scope must be returned
    return scope;
    
});
```

#####HTML
When the Kaiser.start() function is called, it will look for module properties in the DOM and initialize the appropriate modules while setting the `scope` of the corresponding function to the element containing the `module` attribute.  This attribute should be on the root element of where your functionality should be scoped.

<pre><code>&lt;div module="myModule"&gt;&lt;/div&gt;</code></pre>

All modules can be accessed through the `Kaiser.Module.find()` function.  This function will return all modules or the module name can be passed in to get a specific module.  `Kaiser.Module.find('myModule');` would return the module created above.

###Directives
You can create your own custom directives which will automatically trigger their corresponding logic.  Directives can either be attributes or data-attributes.

#####JS
```
Kaiser.Directive.create('click', function(scope, $element, data) {
    scope.listenTo('click', $element, data);
    return scope;
});
```
Three parameters are passed into the directive function: 

- `scope` -- scope of the module containing the directive
- `$element` -- the jQuery element containing the directive attribute
- `data` -- the value of the directive property



#####HTML

<pre><code>&lt;div module="myModule"&gt;
    &lt;button click="clickHandler"&gt;Click Me&lt;/button&gt;
&lt;/div&gt;
</code></pre>

This directive would call the function specified on click.  Check out `test/test.js` for more examples.

###Middleware
Middleware allows you to create reusable functions that can be imported into Modules, Directives, or other Middleware.  These functions are stored privately with simple getter and setter functions `create()` and `find()` so that you do not have to directly expose them publicly.

```
Kaiser.Middleware.create('offline', function($el) {
    var $clone = $el.clone(true);

    $clone.online = function() {
        $el.replaceWith($clone);
        $el = $clone;
    };

    return $clone;
});
```
To import functions from Middleware or any other namespace, use the import functions and store the return in a variable.
`var myVar = Kaiser.from(<namespace>).import(<module>);`

```
Kaiser.Module.create('test', function(scope) {
    var offline = Kaiser.from('Middleware').import('offline');
    scope.init = function() {
        console.log('The "offline" function is available via "scope.offline"', scope.offline);
    };
});
This is very much still in development, so any feedback or bug reports is much appreciated.