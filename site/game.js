(function() {

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

  var Scene = function() {
    this.entities = {};
  };

  Scene.prototype = function() {
    add: function(entity) {
      this.entities[entity.id] = entity;
    },
    remove: function(entity) {
      delete this.entities[entity.id];
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
        cb(this.entities[key]);
      }
    }
  };

  var FluffGenerator = function(scene) {
    this.scene = scene;
    this.id = "fluffgenerator";
  };
  FluffGenerator.prototype = {

  };

  var Quad = function(width, height)
    this.width = width;
    this.height = height;
    this.x = 0;
    this.y = 0;
  };
  Quad.prototype = {
    render: function(context) {
      context.fillStyle = '#000';
      context.fillRect(this.x, this.y, this.width, this.height);
    }
  };

  var Fluff = function(speed, width, height) {
    Quad.call(this, width, height);
    this.speed = 0;
    this.x = Math.random() * 800;
    this.y = 0;
    this.id = 'fluff-' + Math.random() * 100000;
  };

  Fluff.prototype = function() {
    tick: function() {
      this.y += this.speed;
    }
  };
  _.extend(Fluff.prototype, Quad.prototype);

  var Plughole = function() {
    Quad.call(this, 120, 40);
    this.x = 340;
    this.y = 380;
    this.id = "plughole";
  };

  Plughole.prototype = {

  };
  _.extend(Plughole.prototype, Quad.prototype);

  var Spider = function() {
    Quad.call(this, 60, 60);
    this.x = 370;
    this.y = 740;
    this.id = "spider";
  };

  Spider.prototype = {

  };

  var Game = function() {
    this.scene = new Scene();
    this.renderer = new Renderer('game');
  };

  Game.prototype = function() {
    start: function() {
      this.scene.add(new FluffGenerator(this.scene));
      this.scene.add(new Plughole());
      this.scene.add(new Spider());
    }
  };





}).call(this);