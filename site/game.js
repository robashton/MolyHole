(function(exports) {
  var CANVASWIDTH = 800;
  var CANVASHEIGHT = 800;
  var CAPTUREDFLUFFSPEED = 10.0;

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

  var Resources = function() {
    Eventable.call(this);
    this.packages = [];
    this.cachedResources = {};
  };
  Resources.prototype = {
    load: function(file, cb) {
      var self = this;  
      $.getJSON(file, function(data) {
        self.packages.push(data);
        cb();
      })
    },
    getTexture: function(path) {
      var texture = this.fromCacheOrCreate(path, function(data) {
        var image = new Image();
        image.src = "data:image/png;base64," + data;
        return image;
      });
      if(!texture)
        console.warn('Missing texture', path);
      return texture;
    },
    fromCacheOrCreate: function(path, createCallback) {
      var item = this.cachedResources[path];
      if(item) return item;
      var data = this.findData(path);
      if(data) {
        item = createCallback(data);
        this.cachedResources[path] = item;
      } 
      return item;
    },
    findData: function(path) {
      for(var i = 0; i < this.packages.length; i++) {
        var package = this.packages[i];
        var data = package[path];
        if(data) return data;
      }
      return null;
    }
  };
  _.extend(Resources.prototype, Eventable.prototype);
  var GlobalResources = new Resources();

  var Effect = function() {
    Eventable.call(this);
  };
  Effect.prototype = {

  };
  _.extend(Effect.prototype, Eventable.prototype);

  var FadeOutEffect = function(quad, frames) {
    Effect.call(this);

    this.frames = frames;
    this.quad = quad;
    this.frameCount = 0;
  };
  FadeOutEffect.prototype = {
    update: function() {
      this.frameCount++;
      this.quad.alpha = Math.max(1.0 - (this.frameCount / this.frames), 0.0);
    }
  };
  _.extend(FadeOutEffect.prototype, Effect.prototype);

  var FadeInAndOutEffect = function(quad, frames) {
    Effect.call(this);
    this.quad = quad;
    this.frames = frames;
    this.frameCount = 0;
  };
  FadeInAndOutEffect.prototype = {
    update: function() {
      this.frameCount++;
      var percentage = this.frameCount / this.frames;
      if(percentage > 0.5) 
        this.quad.alpha = Math.max((percentage - 0.5) * 2.0, 0.0);
      else
        this.quad.alpha = Math.max((0.5 - percentage) * 2.0, 0.0);
    }
  };
  _.extend(FadeInAndOutEffect.prototype, Effect.prototype);

  var Scene = function() {
    Eventable.call(this);
    this.entities = {};
  };

  Scene.prototype = {
    add: function(entity) {
      this.entities[entity.id] = entity;
      entity.scene = this;
      entity.onAny(this.onEntityEvent, this);
      if(entity.onAddedToScene) entity.onAddedToScene();
    },
    remove: function(entity) {
      delete this.entities[entity.id];
      entity.offAny(this.onEntityEvent, this);
      if(entity.onRemovedFromScene) entity.onRemovedFromScene();
      entity.scene = null;
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
    onEntityEvent: function(e, sender) {
      this.raise(e.event, e.data, sender);
    },
    withEntityAt: function(x, y, cb) {
      this.each(function(entity) {
        if(entity.hitTest && entity.hitTest(x, y)) {
          cb(entity);
          return true;
        }
      });
    },
    withEntity: function(id, cb) {
      var entity = this.entities[id];
      if(!entity)
        console.warn("Missing entity", id);
      else
        cb(entity);
    }
  };
  _.extend(Scene.prototype, Eventable.prototype);

  var Quad = function(width, height, colour) {
    Eventable.call(this);
    this.width = width;
    this.height = height;
    this.x = 0;
    this.y = 0;
    this.effect = null;
    this.colour = colour || '#000';
    this.physical = false;
    this.visible = true;
    this.alpha = 1.0;
  };

  Quad.prototype = {
    render: function(context) {
      if(this.effect)
        this.effect.update();
      if(!this.visible) return;

      context.globalAlpha = this.alpha;
      if(this.colour instanceof Image)
        this.renderTexture(context);
      else
        this.renderColour(context);

    },
    renderTexture: function(context) {
      context.drawImage(this.colour, this.x, this.y, this.width, this.height);
    },
    renderColour: function(context) {
      context.fillStyle = this.colour;
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
      if(!this.physical) return false;
      if(x < this.x) return false;
      if(x > this.x + this.width) return false;
      if(y < this.y) return false;
      if(y > this.y + this.height) return false;
      return true;
    },
    intersects: function(other) {
      if(other.x + other.width < this.x)
        return false;
      if(other.x > this.x + this.width)
        return false;
      if(other.y + other.height < this.y)
        return false;
      if(other.y > this.y + this.height)
        return false;
      return true;
    },
    distanceFrom: function(other) {
      var d = this.vectorTo(other);
      return Math.sqrt((d.x * d.x) + (d.y * d.y));
    },
    vectorTo: function(other) {
      return {
        x: (other.x + other.width / 2.0) - (this.x + this.width / 2.0),
        y: (other.y + other.height / 2.0) - (this.y + this.height / 2.0)
      };
    },
    directionTo: function(other) {
      var d = this.vectorTo(other);
      var mag = Math.sqrt((d.x * d.x) + (d.y * d.y));
      return {
        x: d.x / mag,
        y: d.y / mag
      };
    }
  };
  _.extend(Quad.prototype, Eventable.prototype);

  var Fluff = function(speed, size, type) {
    Quad.call(this, size, size);

    this.speed = speed;
    this.size = size;

    this.type = type;
    this.x = 0;
    this.y = 0;
    this.physical = true;
    this.direction = 1;
    this.id = 'fluff-' + Math.random() * 100000;
    this.generateNewBounds();
    this.currentStrategy = this.driftStrategy;
    this.expireTime = 0;
    this.colour = this.type === Fluff.Type.BAD ? '#000' : '#FFF';
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
      this.updatePosition();
      if(this.isNearPlughole()) {
        this.switchToSelectedStrategy();
      }
      else if(this.hasTouchedFloor())
        this.switchToFailedStrategy();
    },
    isNearPlughole: function() {
      if(this.y + this.size < CANVASHEIGHT / 3.0)
        return false;
      var captured = false;
      this.scene.withEntity("plughole", _.bind(function(plughole) {
        if(plughole.canAttract(this))
          captured = true;
      }, this));
      return captured;
    },
    updatePosition: function() {
      this.y += this.speed;
      this.x += (this.speed * this.direction * 10.0);
    },
    hasTouchedFloor: function() {
      return this.y + this.size > CANVASHEIGHT / 2.0;
    },
    interact: function() {
      if(this.currentStrategy == this.driftStrategy) {
        this.switchToSelectedStrategy();
      }
    },
    switchToFailedStrategy: function() {
      this.raise('FluffFailure');
      this.setEffect(new FadeOutEffect(this, Fluff.FadeTime));
      this.currentStrategy = this.expireStrategy;
    },
    switchToSelectedStrategy: function() {
      this.raise('FluffSelected');
      this.currentStrategy = this.attractedStrategy;
    },
    switchToSuccessStrategy: function() {
      this.raise('FluffSuccess');
      this.setEffect(new FadeOutEffect(this, Fluff.FadeTime));
      this.currentStrategy = this.expireStrategy;
    },
    expireStrategy: function() {
      this.expireTime++;
      if(this.expireTime > Fluff.FadeTime)
        this.scene.remove(this);
    },
    attractedStrategy: function() {
      this.scene.withEntity('plughole', _.bind(function(plughole) {
        if(this.intersects(plughole))
          this.switchToSuccessStrategy();
        else
          this.moveTowards(plughole);
      }, this));
    },
    moveTowards: function(target) {
      var direction = this.directionTo(target);
      this.x += direction.x * CAPTUREDFLUFFSPEED;
      this.y += direction.y * CAPTUREDFLUFFSPEED;
    }
  };
  Fluff.FadeTime = 10;
  Fluff.Type = {
    GOOD: 0,
    BAD: 1
  };
  _.extend(Fluff.prototype, Quad.prototype);

  var FluffGenerator = function() {
    Eventable.call(this);

    this.scene = null;
    this.id = "fluffgenerator";
    this.rate = 180;
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
      var speed = this.generateSpeed();
      var type = this.generateType();
      var fluff = new Fluff(speed, size, type);
      this.scene.add(fluff);
    },
    generateType: function() {
      var seed = Math.random() * 3.0;
      if(seed < this.difficulty)
        return Fluff.Type.BAD;
      return Fluff.Type.GOOD;
    },
    generateSpeed: function() {
      return Math.random() * this.difficulty + this.difficulty;
    }
  };
  _.extend(FluffGenerator.prototype, Eventable.prototype);

  var Plughole = function() {
    Quad.call(this, 80, 20, GlobalResources.getTexture('assets/PlugHole.png'));
    Eventable.call(this);

    this.x = 360;
    this.y = CANVASHEIGHT / 2.0;
    this.destx = CANVASWIDTH / 2.0;
    this.speed = 10.0;
    this.id = "plughole";
  };

  Plughole.prototype = {
    moveTo: function(x, y) {
      this.destx = x;
    },
    tick: function() {
      var difference = this.destx - (this.x + this.width / 2.0);
      var accuracy = this.speed / 2.0;
      if(difference > accuracy)
        this.x += this.speed;
      else if(difference < -accuracy)
        this.x -= this.speed;
    },
    canAttract: function(other) {
      return other.distanceFrom(this) < 150;
    }
  };
  _.extend(Plughole.prototype, Quad.prototype);

  var Bathtub = function() {
    Quad.call(this, CANVASWIDTH, CANVASHEIGHT / 2.0, '#00F');
    this.id = "bathtub";
  };
  Bathtub.prototype = {

  };
  _.extend(Bathtub.prototype, Quad.prototype);

  var Waterfall = function() {
    Quad.call(this, 80, CANVASHEIGHT / 2.0, '#00F');
    this.id = "waterfall";
    this.lastx = -1;
  };
  Waterfall.prototype = {
    calculateDimensions: function() {
      this.x = (CANVASWIDTH / 2.0) - this.width / 2.0;
      this.y = CANVASHEIGHT / 2.0;
    },
    updatePositionWith: function(plughole) {
      var middleOfPlughole = (plughole.x + plughole.width / 2.0); 
      this.x = middleOfPlughole - (this.width / 2.0);
      this.y = CANVASHEIGHT / 2.0 + plughole.height;
      this.lastx = plughole.x;
    },
    tick: function() {
      this.scene.withEntity("plughole", _.bind(function(plughole) {
        if(this.lastx === plughole.x) return;
        this.updatePositionWith(plughole);
      }, this));
    }
  };
  _.extend(Waterfall.prototype, Quad.prototype, Eventable.prototype)

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
      this.context.fillStyle = '#F0F';
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
      this.scene.withEntity("plughole", function(entity) {
        entity.moveTo(x, y);
      });
    }
  };

  var CollectedFluff = function(maxCount) {
    Quad.call(this, 0, 0);

    this.visible = false;
    this.count = 0;
    this.maxCount = maxCount;
  };
  CollectedFluff.prototype = {
    onAddedToScene: function(){
      this.scene.on('FluffSuccess', this.onFluffSuccess, this);
      this.scene.on('FluffFailure', this.onFluffFailure, this);
    },
    onFluffSuccess: function() {
      this.count++;
      this.resize();
    },
    onFluffFailure: function() {
      this.count--;
      this.resize();
    },
    tick: function() {
      this.scene.withEntity("plughole", _.bind(function(plughole) {
        this.x = plughole.x + (plughole.width - this.width) / 2.0;
        this.y = plughole.y;   
      }, this));
    },
    resize: function() {
     this.setEffect(new FadeInAndOutEffect(this, 20));
     if(this.count <= 0) {
       this.visible = false;
     }
     else {
       this.visible = true;
       var percentage = this.count / this.maxCount;
       this.scene.withEntity("plughole", _.bind(function(plughole) {
          this.width = plughole.width * percentage;
          this.height = plughole.height * percentage;
       }, this));
     } 
    }
  }
  _.extend(CollectedFluff.prototype, Quad.prototype);

  var Game = function() {
    this.scene = new Scene();
    this.renderer = new Renderer('game');
    this.input = new Input('game', this.scene);
    this.createEntities();
  };

  Game.prototype = {
    createEntities: function() {
      this.fluffgenerator = new FluffGenerator(this.scene);
      this.bathtub = new Bathtub();
      this.waterfall = new Waterfall();
      this.plughole = new Plughole();
      this.spider = new Spider();
      this.collectedfluff = new CollectedFluff(5);
    },
    start: function() {
      this.scene.add(this.fluffgenerator);
      this.scene.add(this.bathtub);
      this.scene.add(this.plughole);
      this.scene.add(this.waterfall);
      this.scene.add(this.spider);
      this.scene.add(this.collectedfluff);
      this.scene.autoHook(this);
      this.startTimers();      
    },
    startTimers: function() {
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
    GlobalResources.load('assets.json', function() {
      var game = new Game();
      game.start();
    });
  });
})();