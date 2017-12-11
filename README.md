jquery.hotArea.js
====================

HotArea is a jQuery plugin that gives you the ability to Select multiple areas from an image(any $container in fact) and set links for them. If not works well, try the update to date Chrome.

view demo: https://zhenglei21887.github.io/plugin/hotArea/demo.html

Init
====
```javascript
var options = { // all the option fields are optional(including options itself)
  initAreas: [ // the initial areas when the plugin load(optional)
    {
      "x": 280,
      "y": 93,
      "width": 50,
      "height": 50,
      "url":"http://baidu.com"
    }
  ],
  area: {strokeStyle: 'red', lineWidth: 2}, // style to draw selected areas
  point: {size: 3, fillStyle: 'black'}, // style to draw point
};
$container.hotArea(options);
```

Get Selected Areas
=================
```javascript
var selectAreas = $container.hotArea('get');
// [{"x":280,"y":93,"width":50,"height":50,"url":"http://baidu.com"}]
```

Get HTML Code Fragment
=================
```javascript
var htmlTag = $container.hotArea('toTag');
//...
```

Get Edit Box From HTML Code Fragment
=================
```javascript
$container.hotArea('fromTag');
// render edit box to view
```

Notice
=====

1.mousedown to kick off, mouseup to stop

2.click an edit box to add an link

3.mouseover to view the link you added

4.double click to delete an edit box
