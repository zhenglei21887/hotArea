/**
 *  discription: HotArea is a jQuery plugin that gives you the ability to select multiple areas from an image and set links for them.
 *  author: zhengJC
 */
(function ($) {
  var HotAreaStatus = {CREATE: 'create', MOVE: 'move', RESIZE: 'resize', NEAR: 'near'},
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
          $canvas = $ele.parent().find('canvas').length ? $ele.parent().find('canvas') : $('<canvas/>');

      this.$ele            = $ele;
      this.options         = options;
      this.areas           = this.options.initAreas || [];
      this.$canvas         = $canvas;
      this.g2d             = $canvas[0].getContext('2d');
      this.status          = HotAreaStatus.CREATE;
      this.dragging        = false;
      this.resizeDirection = null;
      this.dragAreaOffset  = {};

      $canvas
          .prepend(String()
            + '<style>'
            +   '.change-img {cursor: pointer; background: url("img/icon_refresh.png"); position: absolute; background-size: 20px 20px; width: 20px;height: 20px;}'
            +   '.insert-img {cursor: pointer; background: url("img/icon_plus.png"); position: absolute; background-size: 20px 20px; width: 20px;height: 20px;}'
            +   '.delete-img {cursor: pointer; background: url("img/icon_minus.png"); position: absolute; background-size: 20px 20px; width: 20px;height: 20px;}'
            + '</style>')
          .attr({'width': this.$ele.width(), 'height': this.$ele.height()})
          .offset({
            top: this.$ele.offset().top + (parseInt(this.$ele.css("border-top")) || 0),
            left: this.$ele.offset().left + (parseInt(this.$ele.css("border-left")) || 0),
          })
          .css({position: "absolute", zIndex: this.options.zIndex, userSelect: "none"})
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

      $(document)
          .off("click.canvas")
          .on("click.canvas", function(e) {
            if(e.target !== $canvas[0]) {
              as.linkUpdateStatus = linkUpdateStatus.HIDE;
            }
            as.linkUpdate();
          });

      window.onresize = function() {as.resizeCanvas.call(as)};

      this.draw();
    },
    bindChangeEvent: function (handle) {
      this.$canvas.on("areasChange", handle);
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

      $.each(this.areas, function(index, area) {
        g2d.fillStyle = "rgba(255,255,255,0.3)";
        g2d.strokeRect(area.x, area.y, area.width, area.height);
        g2d.fillRect(area.x, area.y, area.width, area.height);

        g2d.font = area.width/5 + "px serif";
        g2d.fillStyle = "rgb(233,233,233)";
        g2d.textBaseline = "middle";
        g2d.fillText("双击删除", area.x+area.width/10, area.y+area.height/2);
      });
      
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
        if (padding >= 0
          && abs(x1 - x) + abs(x2 - x) - abs(area.width) <= padding * 2
          && abs(y1 - y) + abs(y2 - y) - abs(area.height) <= padding * 2) {
          return area;
        }
        if (padding < 0
          && abs(x1 - x) + abs(x2 - x) - abs(area.width) < 0.001
          && abs(y1 - y) + abs(y2 - y) - abs(area.height) < 0.001
          && abs(abs(x1 - x) - abs(x2 - x)) <= abs(area.width) + 2 * padding
          && abs(abs(y1 - y) - abs(y2 - y)) <= abs(area.height) + 2 * padding) {
          return area;
        }
      }
      return undefined;
    },
    setArea: function(areas) {
      this.areas = areas;
    },
    getAreaBySection: function(start, end) {
      return (this.areas||[]).filter(function(area) {
        return area.y > start && area.y < (end||Number.POSITIVE_INFINITY)
      });
    },
    moveArea: function(start, offset) {
      this.areas.map(function(area) {area.y > start && (area.y += offset)});
    },
    deleteAreaBySection: function(start, end) {
      var as = this;
      var AreaInSection = as.getAreaBySection(start, end);
      this.areas = this.areas.filter(function(area) {return AreaInSection.indexOf(area)===-1;});
    },
    triggerChange: function () {
      this.$canvas.trigger("areasChange", {areas: this.areas});
    },
    resizeCanvas: function () {
      var as = this;
      as.$canvas
          .offset({
            top: this.$ele.offset().top + (parseInt(this.$ele.css("border-top")) || 0),
            left: this.$ele.offset().left + (parseInt(this.$ele.css("border-left")) || 0),
          })
          .attr({width: this.$ele.width(), height: this.$ele.height()});
      //业务代码 ↓
      as.$ele.find(".change-img, .insert-img, .delete-img").remove();
      as.$ele.find(">img").each(function(i,v) {
        $('<div title="更换图片" class="change-img" img-index="'+i+'" img-width="'+v.naturalWidth+'" img-height="'+v.naturalHeight+'"></div>')
          .offset({
            top: $(v).offset().top,
            left: $(v).offset().left + $(v).width() + 10,
          })
          .appendTo(as.$ele)
          .click(function() {
            var $this = $(this);

            $('<input type="file">')
              .change(handleUploadImage)
              .trigger("click");

            function handleUploadImage(e) {
              var $input = $(e.target);
              var opts = {
                    mask: true,
                    upload_btn: $input,
                    files: $input[0].files,
                    width: +$this.attr("img-width"),
                    height: +$this.attr("img-height"),
                    sizeErrorMessage: "仅支持替换相同尺寸图片(原图尺寸"+$this.attr("img-width")+"X"+$this.attr("img-height")+")",
                    keepFile: true,
                    size: 10*1024,
                    callback: function (r) {
                      if(r.success) {
                        as.$ele.find(">img:eq("+$this.attr("img-index")+")").attr("src", TG.common.gatherPictureUrl(r.data, 'y'));
                      } else {
                        $.messager.alert("操作失败", r.message, "error");
                      }
                      $input.remove();
                    }
                  };
              TG.common.commonUploadImage(opts);
            }
          });
        $('<div title="插入图片" class="insert-img" img-index="'+i+'" img-width="'+v.naturalWidth+'" img-top="'+($(v).offset().top-as.$canvas.offset().top)+'"></div>')
          .offset({
            top: $(v).offset().top,
            left: $(v).offset().left + $(v).width() + 35,
          })
          .appendTo(as.$ele)
          .click(function() {
            var $this = $(this);

            $('<input type="file">')
              .change(handleUploadImage)
              .trigger("click");

            function handleUploadImage(e) {
              var $input = $(e.target);
              var opts = {
                    mask: true,
                    upload_btn: $input,
                    files: $input[0].files,
                    width: +$this.attr("img-width"),
                    keepFile: true,
                    size: 10*1024,
                    callback: function (r) {
                      if(r.success) {
                         $("<img src=\"" + TG.common.gatherPictureUrl(r.data, 'y') + "\" style=\"width:100%;\">")
                          .insertBefore(as.$ele.find(">img:eq("+$this.attr("img-index")+")"))
                          .one("load", function() {
                            as.moveArea(+$this.attr("img-top"), +$(this).height());
                             as.$ele.hotArea("resizeCanvas");
                           });
                      } else {
                        $.messager.alert("操作失败", r.message, "error");
                      }
                      $input.remove();
                    }
                  };
              TG.common.commonUploadImage(opts);
            }
          })
        $('<div title="删除图片" class="delete-img" img-index="'+i+'" img-top="'+($(v).offset().top-as.$canvas.offset().top)+'" img-height="'+$(v).height()+'"></div>')
          .offset({
            top: $(v).offset().top,
            left: $(v).offset().left + $(v).width() + 60,
          })
          .appendTo(as.$ele)
          .click(function() {
            var $this = $(this);

            $.messager.confirm("提示", "确定删除该图片以及图片上的热区？", function(r){
              if(r) {
                as.deleteAreaBySection(+$this.attr("img-top"), +$this.attr("img-height")+$this.attr("img-top")*1);
                as.moveArea(+$this.attr("img-top"), -$this.attr("img-height"));
                as.$ele.find(">img:eq("+$this.attr("img-index")+")").remove();
                as.$ele.hotArea("resizeCanvas");
              }
            });
          })
      });
      //业务代码 ↑

      as.draw();
    },
    get: function() {
      return this.areas;
    },
    toTag: function () {
      var as = this,
          areas = as.areas,
          validAreas = areas.filter(function(item) {return !!item.url});
          var allSet = areas.length === validAreas.length,
          tagHtmlArr = [],
          hotCoverZIndex = as.options.zIndex + 2,
          hotCoverContentZIndex = as.options.zIndex + 3,
          $hotCover = null;

      if(!allSet) { console.log("no link added for any edit box") }
      if(!($hotCover = as.$ele.find(".hotCover")).length) {
        $hotCover = $('<div class="hotCover"></div>').hide().prependTo(as.$ele);
        $(String()
          +  '<style>'
          +    '.hotCover {'
          +      'position: relative;'
          +      'width: 100%;'
          +      'overflow-y: hidden;'
          +    '}'
          +    '.hotCover div {'
          +      'position: absolute;'
          +      'cursor: pointer;'
          +    '}'
          +    '.hotCover div a {'
          +      'width: 100%;'
          +      'height: 100%;'
          +      'display: block;'
          +    '}'
          +    '.hotCover div.imageContainer {'
          +      'width: 100%;'
          +      'position: relative;'
          +    '}'
          +    '.hotCover div.imageContainer div.bracket {'
          +      'height: 0;'
          +      'width: 0;'
          +      'margin: 0;'
          +      'padding: 0;'
          +    '}'
          +    '.hotCover div.imageContainer img {'
          +      'cursor: auto;'
          +      'position: absolute;'
          +      'width: 100%;'
          +      'height: 100%;'
          +      'top: 0;'
          +      'left: 0;'
          +      'right: 0;'
          +      'bottom: 0;'
          +    '}'
          +  '</style>').prependTo(as.$ele);
      }
      $hotCover.css({
        'zIndex': hotCoverZIndex
      });

      validAreas.forEach(function(item) {
        tagHtmlArr.push(String()
          + '<div class="hotLink" style="'
          +      'position: absolute;'
          +      'cursor: pointer;'
          +      'z-index: '+hotCoverContentZIndex+';'
          +      'left: '+item.x*100/as.$ele.width()+'%;'
          +      'top: '+item.y*100/as.$ele.height()+'%;'
          +      'height: '+item.height*100/as.$ele.height()+'%;'
          +      'width: '+item.width*100/as.$ele.width()+'%;'
          +      '">'
          +    '<a href="'+item.url+'"></a>'
          + '</div>'
        );
      });
      as.$ele.find(">img").each(function(i,v) {
        tagHtmlArr.push(
          $('<div class="imageContainer"><div class="bracket" style="position: static;padding-top: '+(v.height/v.width*100)+'%;"></div></div>')
              .append(v.outerHTML)[0].outerHTML
        );
      });

      as.linkUpdateStatus = linkUpdateStatus.HIDE;
      as.linkUpdate();
      $hotCover.html(tagHtmlArr.join("")).show();
      var rtnHtml = as.$ele.find("style")[0].outerHTML + as.$ele.find("style")[1].outerHTML + $hotCover[0].outerHTML;
      $hotCover.hide();

      return rtnHtml;
    },
    fromTag: function (tag) {
      var as = this;
      var areas = [];
      var imgHtmlArr = [];

      $(tag).find("img").each(function(i,v) {
        imgHtmlArr.push(v.outerHTML);
      });

      var deferArr = [];
      as.$ele
        .html(imgHtmlArr.join(""))
        .find("img")
        .each(function(i, v) {
          var defer = $.Deferred();
          deferArr.push(defer);
          v.onload = function() {defer.resolve();}
        });

      $.when.apply(null, deferArr).done(function() {
        as.resizeCanvas();
        $(tag).find("div.hotLink").each(function(index, dom) {
          var $item = $(dom);
          areas.push({
            x: parseFloat($item.css("left")||$item.css("margin-left"))/100*as.$ele.width(),
            y: parseFloat($item.css("top")||$item.css("margin-top"))/100*as.$ele.height(),
            width: parseFloat($item.css("width"))/100*as.$ele.width(),
            height: parseFloat($item.css("height"))/100*as.$ele.height(),
            url: $item.find("a").attr("href")
          });
        });

        as.setArea(areas);
        as.draw();
      });
    },
    clearCanvas: function() {
      var as = this;
      as.setArea([]);
      as.draw();
    },
    linkUpdate: function() {
      var $linkUpdate = null;
      var as = this;

      if(!($linkUpdate = this.$ele.find(".linkUpdate")).length) {
        $linkUpdate = $('<div class="linkUpdate">URL: <input type="text"></div>')
            .hide().prependTo(this.$ele).click(function(e){e.stopPropagation();});
        $(String()
          +  '<style>'
          +    '.linkUpdate{'
          +      'width:300px;'
          +      'padding: 5px;'
          +      'position: absolute;'
          +      'border: lightgray 2px solid;'
          +      'border-radius:5px;'
          +      'background-color: whitesmoke;'
          +    '}'
          +    '.linkUpdate::before{'
          +      'content: "";'
          +      'position: absolute;'
          +      'top: 31px;'
          +      'width: 8px;'
          +      'height: 8px;'
          +      'left: 15px;'
          +      'border: lightgray 2px solid;'
          +      'border-left: transparent;'
          +      'border-top: transparent;'
          +      'z-index: 1;'
          +      'transform: rotate(45deg);'
          +      'background-color: whitesmoke;'
          +    '}'
          +    '.linkUpdate input {'
          +      'width: 250px !important;'
          +      'height: 17px !important;'
          +    '}'
          +  '</style>').prependTo(this.$ele);
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
              var $this = $(this);
              var linkVal = $this.val().trim();
              if(linkVal.length===0) {
                $this.data("currentArea").url = "";
                return;
              }
              if(linkVal.indexOf("http://") !== 0 && linkVal.indexOf("https://") !== 0 && linkVal.indexOf("coupon://") !== 0 && linkVal.indexOf("//") !== 0) {
                linkVal = "//" + linkVal;
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
        $linkTip = $('<div class="linkTip" style="background: rgba(255,0,0,0.5);color: white;position: absolute;padding:5px;"></div>').hide().prependTo(this.$ele);
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
    return /(http:|ftp:|https:)?\/\/[\w\-_]+(\.[\w\-_]+)+([\w\-\.,@?^=%&:/~\+#]*[\w\-\@?^=%&/~\+#])?/.test(value);
  }

  $.fn.hotArea = function (method) {
    var as,
        $this = this,
        defaultOptions = {
          initAreas: [],
          padding: 3,
          zIndex: 1,
          area: {strokeStyle: 'lightgray', lineWidth: 2},
          point: {size: 5, fillStyle: 'gray'}
        },
        rtn;

    if (!(as = $this.data('HotArea'))) {
      var options = $.extend({}, defaultOptions, $.isPlainObject(method) ? method : {});
      as = new HotArea($this, options);
      $this.data('HotArea', as);
    }

    if(typeof method === "string") {
      if (as[method] != undefined) {
        return as[method].apply(as, Array.prototype.slice.apply(arguments).slice(1)) || as.$ele;
      } else {
        console.error('no function: ' + method);
      }
    }
  }
})(jQuery);