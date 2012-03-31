(function(exports) {
  var CANVASWIDTH = 800;
  var CANVASHEIGHT = 800;

  var EventContainer = function(defaultContext) {
    this.handlers = [];
    this.defaultContext = defaultContext;
  }; 
  
  EventContainer.prototype = {
    raise: function(source, data) {
     var handlerLength = this.handlers.length;
     for(var i = 0; i < handlerLength; i++) {
        var handler = this.handlers[i];
        handler.method.call(handler.context || this.defaultContext, data, source);   
     }
    },
    add: function(method, context) {
      this.handlers.push({
        method: method,
        context: context      
      });
    },
    remove: function(method, context) {
      this.handlers = _(this.handlers).filter(function(item) {
        return item.method !== method || item.context !== context;
      });
    }
  };

   var Eventable = function() {
    this.eventListeners = {};
    this.allContainer = new EventContainer(this);
    this.eventDepth = 0;
  };
  
  Eventable.prototype = {
    autoHook: function(container) {
      for(var key in container) { 
        if(key.indexOf('on') === 0) {
          this.on(key.substr(2), container[key], container);
        }   
      }
    },
    autoUnhook: function(container) {
      for(var key in container) { 
        if(key.indexOf('on') === 0) {
          this.off(key.substr(2), container[key], container);
        }   
      }
    },
    once: function(eventName, callback, context) {
      var self = this;
      var wrappedCallback = function(data, sender) {
        callback.call(this, data, sender);
        self.off(eventName, wrappedCallback, context);
      };
      this.on(eventName, wrappedCallback, context);
    },
    
    on: function(eventName, callback, context) {
      this.eventContainerFor(eventName).add(callback, context);
    },
    
    off: function(eventName, callback, context) {
      this.eventContainerFor(eventName).remove(callback, context);
    },

    onAny: function(callback, context) {
      this.allContainer.add(callback, context);
    },

    offAny: function(callback, context) {
      this.allContainer.remove(callback, context);
    },

    raise: function(eventName, data, sender) {
      this.audit(eventName, data);
      var container = this.eventListeners[eventName];

      if(container)
        container.raise(sender || this, data);
      
      this.allContainer.raise(sender || this, {
        event: eventName,
        data: data
      });
    },
    
    audit: function(eventName, data) {
      
    },

    eventContainerFor: function(eventName) {
      var container = this.eventListeners[eventName];
      if(!container) {
        container =  new EventContainer(this);
        this.eventListeners[eventName] = container;
      }
      return container;
    }
  };

  var Effect = function() {
    Eventable.call(this);
  };
  Effect.prototype = {

  };
  _.extend(Effect.prototype, Eventable.prototype);

  var FadeEffect = function(frames, quad) {
    Effect.call(this);

    this.frames = frames;
    this.quad = quad;
    this.frameCount = 0;
  };
  FadeEffect.prototype = {
    update: function() {

    }
  };
  _.extend(FadeEffect.prototype, Effect.prototype);

  var Scene = function() {
    Eventable.call(this);
    this.entities = {};
  };

  Scene.prototype = {
    add: function(entity) {
      this.entities[entity.id] = entity;
      entity.scene = this;
      entity.onAny(this.onEntityEvent, this);
    },
    remove: function(entity) {
      delete this.entities[entity.id];
      entity.offAny(this.onEntityEvent, this);
    },
    render: function(context) {
      this.each(function(entity) {
        if(entity.render) entity.render(context);
      });
    },
    tick: function() {
      this.each(function(entity) {
        if(entity.tick) entity.tick();
      });
    },
    each: function(cb) {
      for(var key in this.entities) {
        if(cb(this.entities[key]))
          return;
      }
    },
    onEntityEvent: function(event, data, sender) {
      this.raise(event, data);
    },
    withEntityAt: function(x, y, cb) {
      this.each(function(entity) {
        if(entity.hitTest && entity.hitTest(x, y)) {
          cb(entity);
          return true;
        }
      });
    }
  };
  _.extend(Scene.prototype, Eventable.prototype);

  var Quad = function(width, height) {
    this.width = width;
    this.height = height;
    this.x = 0;
    this.y = 0;
    this.effect = null;
  };

  Quad.prototype = {
    render: function(context) {
      if(this.effect)
        this.effect.update();
      context.fillStyle = '#000';
      context.fillRect(this.x, this.y, this.width, this.height);
    },
    setEffect: function(effect) {
      if(this.effect)
        this.removeEffect();
      this.effect = effect;
      this.effect.once('finished', this.removeEffect, this);
    },
    removeEffect: function() {
      this.effect = null;
    },
    hitTest: function(x, y) {
      if(x < this.x) return false;
      if(x > this.x + this.width) return false;
      if(y < this.y) return false;
      if(y > this.y + this.height) return false;
      return true;
    }
  };

  var Fluff = function(speed, size) {
    Quad.call(this, size, size);
    Eventable.call(this);

    this.speed = speed;
    this.size = size;

    this.x = 0;
    this.y = 0;
    this.direction = 1;
    this.id = 'fluff-' + Math.random() * 100000;
    this.generateNewBounds();
    this.currentStrategy = this.driftStrategy;
    this.failedTime = 0;
  };

  Fluff.prototype = {
    tick: function() {
      this.currentStrategy();
    },
    calculateDirection: function() {
      var middle = this.x + this.size / 2.0;
      if((middle < this.min && this.direction < 0) || (middle > this.max && this.direction > 0))
        this.switchDirection();
    },
    switchDirection: function() {
      this.direction = -this.direction;
      this.generateNewBounds();
    },
    generateNewBounds: function() {
      this.min = Math.random() * (CANVASWIDTH / 2.0);
      this.max = CANVASWIDTH - this.min;
    },
    driftStrategy: function() {
      this.calculateDirection();
      this.y += this.speed;
      this.x += (this.speed * this.direction * 10.0);
      if(this.y + this.size > CANVASHEIGHT / 2.0)
        this.switchToFailedStrategy();
    },
    interact: function() {
      if(this.currentStrategy == this.driftStrategy) {
        this.switchToSelectedStrategy();
      }
    },
    switchToFailedStrategy: function() {
      this.raise('FluffFailure');
      this.setEffect(new FadeEffect(30));
      this.currentStrategy = this.failedStrategy;
    },
    switchToSelectedStrategy: function() {
      this.raise('FluffSelected');
      this.currentStrategy = this.selectedStrategy;
    },
    failedStrategy: function() {
      this.failedTime++;
      if(this.failedTime > 30)
        this.scene.remove(this);
    },
    selectedStrategy: function() {

    }
  };
  _.extend(Fluff.prototype, Quad.prototype, Eventable.prototype);

  var FluffGenerator = function() {
    Eventable.call(this);
    this.scene = null;
    this.id = "fluffgenerator";
    this.rate = 2000;
    this.frame = 0;
    this.difficulty = 0.5;
  };

  FluffGenerator.prototype = {
    tick: function() {
      if(this.frame++ % this.rate === 0)
        this.generateFluff();
    },
    generateFluff: function() {
      var size = Math.random() * 30 + 30;
      var speed = Math.random() * this.difficulty + this.difficulty;
      var fluff = new Fluff(speed, size);
      this.scene.add(fluff);
    }
  };
  _.extend(FluffGenerator.prototype, Eventable.prototype);

  var Plughole = function() {
    Quad.call(this, 80, 20);
    Eventable.call(this);

    this.x = 360;
    this.y = 390;
    this.id = "plughole";
  };

  Plughole.prototype = {

  };
  _.extend(Plughole.prototype, Quad.prototype, Eventable.prototype);

  var Spider = function() {
    Quad.call(this, 60, 60);
    Eventable.call(this);
    this.x = 370;
    this.y = 740;
    this.id = "spider";
  };

  Spider.prototype = {

  };
  _.extend(Spider.prototype, Eventable.prototype);

  var Renderer = function(id) {
    this.canvas = document.getElementById(id);
    this.context = this.canvas.getContext('2d');
  };

  Renderer.prototype = {
    clear: function() {
      this.context.fillStyle = '#55F';
      this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  };

  var Input = function(id, scene) {
    this.element = document.getElementById(id);
    this.scene = scene;

    $(this.element).on({
      click: _.bind(this.onClick, this)
    });
  };

  Input.prototype = {
    onClick: function(e) {
      this.actionOn(e.clientX, e.clientY);
    },
    actionOn: function(x, y) {
      this.scene.withEntityAt(x, y, function(entity) {
        if(entity.interact)
          entity.interact();
      });
    }
  };

  var Game = function() {
    this.scene = new Scene();
    this.renderer = new Renderer('game');
    this.input = new Input('game', this.scene);
  };

  Game.prototype = {
    start: function() {
      this.scene.add(new FluffGenerator(this.scene));
      this.scene.add(new Plughole());
      this.scene.add(new Spider());
      var self = this;
      setInterval(function() {
        self.tick();
      }, 1000 / 30);
    },
    tick: function() {

      // TODO: Decouple, use reqanimationframe
      this.scene.tick();
      this.renderer.clear();
      this.scene.render(this.renderer.context);
    }
  };

  $(document).ready(function(){
    var game = new Game();
    game.start();
  });
  
})();