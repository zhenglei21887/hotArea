/**
 *  discription: HotArea is a jQuery plugin that gives you the ability to Select multiple areas from an image and set links for them.
 *  		based on jquery.areaSelect.js（https://github.com/gongshw/jquery.areaSelect.js）
 *  author: zhenglei
 *  time: 2017.1.25
 */
(function ($) {
	var 
			HotAreaStatus = {CREATE: 'create', MOVE: 'move', RESIZE: 'resize', NEAR: 'near'},
			linkUpdateStatus = {HIDE: 'hide', SHOW: 'show'},
			Direction = {
						NE: {name: 'NE', x: 1, y: -1, cursor: 'nesw-resize'},
						NW: {name: 'NW', x: -1, y: -1, cursor: 'nwse-resize'},
						SE: {name: 'SE', x: 1, y: 1, cursor: 'nwse-resize'},
						SW: {name: 'SW', x: -1, y: 1, cursor: 'nesw-resize'}
					};

	function HotArea($ele, options) {
		this.init($ele, options);
	}

	HotArea.prototype = {
		constructor: HotArea,
		init: function ($ele, options) {
			var as = this,
					moveDownPoint = {},
					$canvas = $('<canvas/>');

			this.$ele            = $ele;
			this.options         = options;
			this.areas           = this.options.initAreas.length ? this.options.initAreas : this.fromTag();
			this.$canvas         = $canvas;
			this.g2d             = $canvas[0].getContext('2d');
			this.status          = HotAreaStatus.CREATE;
			this.dragging        = false;
			this.resizeDirection = null;
			this.dragAreaOffset  = {};

			$canvas
					.attr({'width': this.$ele.width(), 'height': this.$ele.height()})
					.offset(this.$ele.position())
					.css({position: "absolute", zIndex: this.options.zIndex})
					.appendTo(this.$ele.parent())
					.mousemove(function (event) {
						var offsetX = get_offset_X(event);
						var offsetY = get_offset_Y(event);
						if (as.dragging) {
							as.onDragging(offsetX, offsetY);
						} else {
							as.onMouseMoving(offsetX, offsetY);
						}
					})
					.mousedown(function (event) {
						moveDownPoint = {x: get_offset_X(event), y: get_offset_Y(event)};
						as.onDragStart(get_offset_X(event), get_offset_Y(event));
						if(as.status !== HotAreaStatus.MOVE) {as.linkUpdateStatus = linkUpdateStatus.HIDE;}
					})
					.mouseup(function (event) {
						as.onDragStop();
					})
					.dblclick(function (event) {
						as.onDoubleClick(get_offset_X(event), get_offset_Y(event));
					})
					.click(function (event) {
						var x = get_offset_X(event),
								y = get_offset_Y(event);
						if (x == moveDownPoint.x && y == moveDownPoint.y && as.getArea(x, y, as.options.padding)) {//原地点击
							as.linkUpdateStatus = linkUpdateStatus.SHOW;
						} else {//点击后拖拽
							// as.linkUpdateStatus = linkUpdateStatus.HIDE;
						}
						as.linkUpdate();
					});

			this.draw();
		},
		get: function () {
			return this.areas;
		},
		bindChangeEvent: function (handle) {
			this.$canvas.on("areasChange", handle[0]);
		},
		onDragStart: function (x, y) {
			this.dragging = true;
			switch (this.status) {
				case HotAreaStatus.RESIZE:
					!this.currentArea || setAreaDirection(this.currentArea, this.resizeDirection);
					break;
				case HotAreaStatus.MOVE:
					this.dragAreaOffset = {x: this.currentArea.x - x, y: this.currentArea.y - y};
					break;
				case HotAreaStatus.CREATE:
					var newArea = {x: x, y: y, width: 0, height: 0};
					this.areas.push(newArea);
					this.currentArea = newArea;
					this.status = HotAreaStatus.RESIZE;
					break;
			}
		},
		onDragStop: function () {
			this.dragging = false;
			switch (this.status) {
				case HotAreaStatus.RESIZE:
					if (this.currentArea != undefined) {
						if (this.currentArea.width < 10 && this.currentArea.height < 10) {
							this.deleteArea(this.currentArea);
							this.currentArea = undefined;
							this.status = HotAreaStatus.CREATE;
						} else {
							setAreaDirection(this.currentArea, Direction.SE);
							this.triggerChange();
						}
					}
					break;
				case HotAreaStatus.MOVE:
					this.triggerChange();
					break;
			}
		},
		onMouseMoving: function (x, y) {
			var area = this.getArea(x, y, this.options.padding);
			var $canvas = this.$canvas;
			if (area != undefined) {
				this.currentArea = area;
				var nearDrag = false;
				var dragDirection = null;
				var dragPoints = getPositionPoints(area);
				for (var d in dragPoints) {
					if (near({x: x, y: y}, dragPoints[d], this.options.padding)) {
						nearDrag = true;
						dragDirection = Direction[d];
						break;
					}
				}
				if (nearDrag) {
					$canvas.css({cursor: dragDirection.cursor});
					this.status = HotAreaStatus.RESIZE;
					this.resizeDirection = dragDirection;
				}
				else if (this.getArea(x, y, -this.options.padding) != undefined) {
					$canvas.css({cursor: 'move'});
					this.status = HotAreaStatus.MOVE;
				} else {
					$canvas.css({cursor: 'auto'});
					this.status = HotAreaStatus.NEAR;
				}
			} else {
				this.currentArea = undefined;
				$canvas.css({cursor: 'default'});
				this.status = HotAreaStatus.CREATE;
			}
			this.linkTip();
			this.draw();
		},
		onDragging: function (x, y) {
			var area = this.currentArea;
			switch (this.status) {
				case HotAreaStatus.RESIZE:
					area.width = x - area.x;
					area.height = y - area.y;
					break;
				case HotAreaStatus.MOVE:
					area.x = (x + this.dragAreaOffset.x);
					area.y = (y + this.dragAreaOffset.y);
					break;
				case HotAreaStatus.CREATE:
					break;
			}
			this.linkUpdate();
			this.linkTip();
			this.draw();
		},
		onDoubleClick: function (x, y) {
			var area = this.getArea(x, y, this.options.padding);
			if (area != undefined) {
				this.deleteArea(area);
				this.draw();
			}
		},
		draw: function () {
			var g2d = this.g2d;
			/* clear canvas */
			g2d.clearRect(0, 0, this.$canvas[0].width, this.$canvas[0].height);
			/* draw areas */
			g2d.strokeStyle = this.options.area.strokeStyle;
			g2d.lineWidth = this.options.area.lineWidth;
			g2d.setLineDash([6, 3]);
			for (var index in this.areas) {
				var area = this.areas[index];
				this.g2d.strokeRect(area.x, area.y, area.width, area.height);
			}
			/* draw current area */
			var area = this.currentArea;
			g2d.fillStyle = this.options.point.fillStyle;
			if (area != undefined) {
				var positionPoints = getPositionPoints(area);
				/* draw position point */
				for (var index in positionPoints) {
					var point = positionPoints[index];
					g2d.beginPath();
					g2d.arc(point.x, point.y, this.options.point.size, 0, Math.PI * 2, true);
					g2d.closePath();
					g2d.fill();
				}
			}
		},
		deleteArea: function (area) {
			var areas = this.areas;
			var index = areas.indexOf(area);
			if (index >= 0) {
				areas.splice(areas.indexOf(area), 1);
				this.currentArea = undefined;
				this.triggerChange();
				this.status = HotAreaStatus.CREATE;
			}
			this.linkUpdateStatus = linkUpdateStatus.HIDE;
			this.linkUpdate();
		},
		getArea: function (x, y, padding) {
			padding = padding === undefined ? 0 : padding;
			for (var index in this.areas) {
				var area = this.areas[index];
				var abs = Math.abs;
				var x1 = area.x;
				var x2 = area.x + area.width;
				var y1 = area.y;
				var y2 = area.y + area.height;
				if (padding >= 0 && abs(x1 - x) + abs(x2 - x) - abs(area.width) <= padding * 2
					&& abs(y1 - y) + abs(y2 - y) - abs(area.height) <= padding * 2) {
					return area;
				}
				if (padding < 0
					&& abs(x1 - x) + abs(x2 - x) - abs(area.width) == 0
					&& abs(y1 - y) + abs(y2 - y) - abs(area.height) == 0
					&& abs(abs(x1 - x) - abs(x2 - x)) <= abs(area.width) + 2 * padding
					&& abs(abs(y1 - y) - abs(y2 - y)) <= abs(area.height) + 2 * padding) {
					return area;
				}
			}
			return undefined;
		},
		triggerChange: function () {
			this.$canvas.trigger("areasChange", {areas: this.areas});
		},
		resizeCanvas: function () {
			this.$canvas.attr({width: this.$ele.width(), height: this.$ele.height()});
			this.draw();
		},
		toTag: function () {
			var as = this,
					areas = as.areas,
					validAreas = areas.filter(function(item) {return !!item.url});
					allSet = areas.length === validAreas.length,
					tagHtmlArr = [],
					hotCoverZIndex = as.options.zIndex + 2,
					hotCoverContentZIndex = as.options.zIndex + 3,
					$hotCover = null;

			if(!allSet) { console.log("no link added for some edit box") }
			if(!($hotCover = as.$ele.find(".hotCover")).length) {
				$hotCover = $('<div class="hotCover"></div>').hide().prependTo(as.$ele);
				$(String()
					+	'<style>'
					+		'.hotCover {'
					+			'position: absolute;'
					+			'opacity: 0;'
					+		'}'
					+		'.hotCover div {'
					+			'position: absolute;'
					+			'cursor: pointer;'
					+		'}'
					+		'.hotCover div a {'
					+			'width: 100%;'
					+			'height: 100%;'
					+			'display: block;'
					+		'}'
				  +	'</style>').prependTo(as.$ele);
			}
			$hotCover.css({
				'height': as.$ele.height(),
				'width': as.$ele.width(),
				'zIndex': hotCoverZIndex
			});

			validAreas.forEach(function(item) {
				tagHtmlArr.push(String()
					+ '<div style="'
					+			'z-index: '+hotCoverContentZIndex+';'
					+			'left: '+item.x+'px;'
					+			'top: '+item.y+'px;'
					+			'height: '+item.height+'px;'
					+			'width: '+item.width+'px;'
					+			'">'
					+		'<a href="'+item.url+'">'
					+ '</div>'
				);
			});

			as.linkUpdateStatus = linkUpdateStatus.HIDE;
			as.linkUpdate();
			$hotCover.html(tagHtmlArr.join("")).show();
			var rtnHtml = as.$ele[0].outerHTML;
			$hotCover.hide();

			return rtnHtml;
		},
		fromTag: function () {
			var areas = [];
			this.$ele.find(".hotCover > div").each(function(index, dom) {
				var $item = $(dom);
				areas.push({
					x: parseInt($item.css("left")||$item.css("margin-left")),
					y: parseInt($item.css("top")||$item.css("margin-top")),
					height: parseInt($item.css("height")),
					width: parseInt($item.css("width")),
					url: $item.find("a").attr("href")
				});
			});

			this.$ele.find(".hotCover").hide();
			
			return areas;
		},
		linkUpdate: function() {
			var $linkUpdate = null;
			var as = this;

			if(!($linkUpdate = this.$ele.find(".linkUpdate")).length) {
				$linkUpdate = $('<div class="linkUpdate">URL: <input type="text"></div>').hide().prependTo(this.$ele);
				$(String()
					+	'<style>'
					+		'.linkUpdate{'
					+			'line-height: 1.5em;'
					+			'width:300px;'
					+			'padding: 5px;'
					+			'position: absolute;'
					+			'border: lightgray 2px solid;'
					+			'border-radius:5px;'
					+			'background-color: whitesmoke;'
					+		'}'
					+		'.linkUpdate::before{'
					+			'content: "";'
					+			'position: absolute;'
					+			'top: 31px;'
					+			'width: 8px;'
					+			'height: 8px;'
					+			'left: 15px;'
					+			'border: lightgray 2px solid;'
					+			'border-left: transparent;'
					+			'border-top: transparent;'
					+			'z-index: 1;'
					+			'transform: rotate(45deg);'
					+			'background-color: whitesmoke;'
					+		'}'
					+		'.linkUpdate input {'
					+			'width: 250px;'
					+		'}'
				  +	'</style>').prependTo(this.$ele);
			}
				
			if(as.currentArea) {
				$linkUpdate
						.css({
							[as.$ele.css("position")==="static" ? 'margin-top' : 'top']: as.currentArea.y-50,
							[as.$ele.css("position")==="static" ? 'margin-left' : 'left']: as.currentArea.x,
							'zIndex': as.options.zIndex+1
						})
						.find("input")
						.data("currentArea", as.currentArea)
						.unbind("change").change(function() {
							$this = $(this);
							var linkVal = $this.val().trim();
							if(linkVal.length===0) {
								$this.data("currentArea").url = "";
								return;
							}
							if(linkVal.indexOf("http://") !== 0 && linkVal.indexOf("https://") !== 0) {
								linkVal = "http://" + linkVal;
							}
							if(linkValidator(linkVal)) {
								$this.data("currentArea").url = linkVal;
							} else {
								as.linkUpdateStatus = linkUpdateStatus.SHOW;
								setTimeout(function() {
									if(as.options.linkErrorCallback) {
										as.options.linkErrorCallback();
									} else {
										alert("链接地址格式错误，请重新填写")
									}
								}, 100);
							}
						})
						.val(as.currentArea.url || "");
			}
			as.linkUpdateStatus && $linkUpdate[as.linkUpdateStatus]();
		},
		linkTip: function() {
			var $linkTip = null;
			var as = this;

			if(!($linkTip = this.$ele.find(".linkTip")).length) {
				$linkTip = $('<div class="linkTip" style="color: red;position: absolute;"></div>').hide().prependTo(this.$ele);
			}

			if(as.status === HotAreaStatus.MOVE) {
				$linkTip
						.css({
							[as.$ele.css("position")==="static" ? 'margin-top' : 'top']: as.currentArea.y,
							[as.$ele.css("position")==="static" ? 'margin-left' : 'left']: as.currentArea.x,
							'zIndex': as.options.zIndex
						})
						.show()
						.text(as.currentArea.url || "");
			} else {
				$linkTip.hide();
			}
		}
	};

	var getPositionPoints = function (area) {
		var points = {};
		for (var d in Direction) {
			points[d] = {
				x: area.x + area.width * (Direction[d].x + 1) / 2,
				y: area.y + area.height * (Direction[d].y + 1) / 2
			};
		}
		return points;
	};

	var setAreaDirection = function (area, direction) {
		if (area != undefined && direction != undefined) {
			var x1 = area.x,
					x2 = area.x + area.width,
					y1 = area.y,
					y2 = area.y + area.height,
					width = Math.abs(area.width),
					height = Math.abs(area.height),
					minOrMax = {'1': Math.min, '-1': Math.max};
			area.x = minOrMax[direction.x](x1, x2);
			area.y = minOrMax[direction.y](y1, y2);
			area.width = direction.x * width;
			area.height = direction.y * height;
		}
	};

	var near = function (point1, point2, s) {
		return Math.pow(point1.x - point2.x, 2) + Math.pow(point1.y - point2.y, 2) <= Math.pow(s, 2);
	};

	var get_offset_X = function (event) {
		return event.offsetX ? event.offsetX : event.originalEvent.layerX;
	};

	var get_offset_Y = function (event) {
		return event.offsetY ? event.offsetY : event.originalEvent.layerY;
	};

	var linkValidator = function(value) {
    return /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i
            .test(value);
	}

	$.fn.hotArea = function (method) {
		var as,
				$this = this,
				defaultOptions = {
					initAreas: [],
					padding: 3,
					zIndex: 1000000,
					area: {strokeStyle: 'red', lineWidth: 2},
					point: {size: 4, fillStyle: 'black'}
				};
		as = $this.data('HotArea');
		if (as == undefined && (method === undefined || $.isPlainObject(method))) {
			var options = $.extend({}, defaultOptions, method);
			as = new HotArea($this, options);
			$this.data('HotArea', as);
		} else {
			if (as === undefined) {
				console.error('pls invoke hotArea() on this element first!');
			} else if (as[method] != undefined) {
				return as[method](Array.prototype.slice.call(arguments, 1));
			} else {
				console.error('no function ' + method);
			}
		}
	}
})(jQuery);