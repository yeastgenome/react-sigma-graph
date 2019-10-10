import sigma from 'sigma';

;(function(undefined) {

  /**
   * Sigma Renderer Snapshot Utility
   * ================================
   *
   * The aim of this plugin is to enable users to retrieve a static image
   * of the graph being rendered.
   *
   * Author: Guillaume Plique (Yomguithereal)
   * Version: 0.0.1
   * A few local edits were made by Travis Sheppard, remove delete variables to avoid strict mode error. 
   */

  // Terminating if sigma were not to be found
  if (typeof sigma === 'undefined')
    throw 'sigma.renderers.snapshot: sigma not in scope.';

  // Constants
  var CONTEXTS = ['scene', 'edges', 'nodes', 'labels'],
      TYPES = {
        png: 'image/png',
        jpg: 'image/jpeg',
        gif: 'image/gif',
        tiff: 'image/tiff'
      };

  // Utilities
  function download(dataUrl, extension, filename) {

    // Anchor
    var anchor = document.createElement('a');
    anchor.setAttribute('href', dataUrl);
    anchor.setAttribute('download', filename || 'graph.' + extension);

    // Click event
    var event = document.createEvent('MouseEvent');
    event.initMouseEvent('click', true, false, window, 0, 0, 0 ,0, 0,
      false, false, false, false, 0, null);

    anchor.dispatchEvent(event);
  }

  // Main function
  function snapshot(params) {
    params = params || {};

    // Enforcing
    if (params.format && !(params.format in TYPES))
      throw Error('sigma.renderers.snaphot: unsupported format "' +
                  params.format + '".');

    var self = this,
        webgl = this instanceof sigma.renderers.webgl,
        doneContexts = [];

    // Creating a false canvas where we'll merge the other
    var merged = document.createElement('canvas'),
        mergedContext = merged.getContext('2d'),
        sized = false;

    // Iterating through context
    CONTEXTS.forEach(function(name) {
      if (!self.contexts[name])
        return;

      if (params.labels === false && name === 'labels')
        return;

      var canvas = self.domElements[name] || self.domElements['scene'],
          context = self.contexts[name];

      if (~doneContexts.indexOf(context))
        return;

      if (!sized) {
        merged.width = webgl && context instanceof WebGLRenderingContext ?
         canvas.width / 2 :
         canvas.width;
        merged.height = webgl && context instanceof WebGLRenderingContext ?
          canvas.height / 2 :
          canvas.height
        sized = true;

        // Do we want a background color?
        if (params.background) {
          mergedContext.rect(0, 0, merged.width, merged.height);
          mergedContext.fillStyle = params.background;
          mergedContext.fill();
        }
      }

      if (context instanceof WebGLRenderingContext)
        mergedContext.drawImage(canvas, 0, 0,
          canvas.width / 2, canvas.height / 2);
      else
        mergedContext.drawImage(canvas, 0, 0);

      doneContexts.push(context);
    });

    //Download with title on left
    if(params['title']){
      var ctx = merged.getContext("2d");
      var tempDate = new Date();
      var month = tempDate.getMonth() + 1;
      var formattedMonth = ('0' + month).slice(-2);
      var date = tempDate.getDate();
      var formattedDate = ('0' + date).slice(-2);
      var _HeaderText = params['title'] ? params['title']: `${tempDate.getFullYear()}-${formattedMonth}-${formattedDate}`;
      ctx.font = '17px Arial';
      ctx.fillText(_HeaderText, merged.width - 200, 30);
    }
    //Download with legend
    if (params['legendData']) {
      var ctx = merged.getContext("2d");
      ctx.font = '17px Arial';
      var left = 15;
      for (var i = 0; i < params.legendData.length; i++) {
        ctx.fillStyle = params.legendData[i].color;
        ctx.beginPath();
        ctx.arc(50, 30 + (i * 25), 10, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.fillText(params.legendData[i].text, left + 50, 30 + (i * 25) + 5);
      }
    }
    //End

    var dataUrl = merged.toDataURL(TYPES[params.format || 'png']);

    if (params.download)
      download(
        dataUrl,
        params.format || 'png',
        params.filename
      );

    return dataUrl;
  }

  // Extending canvas and webl renderers
  sigma.renderers.canvas.prototype.snapshot = snapshot;
  sigma.renderers.webgl.prototype.snapshot = snapshot;
}).call(this);
