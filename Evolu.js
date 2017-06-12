<html><head>
<meta http-equiv="content-type" content="text/html; charset=windows-1252">
<title>Evolution Experiment</title>
<script>

// Handle non-existant consoles
if ( typeof console == 'undefined' ) console = { log: function() {} };

//                                                                                          CONSTANT VARIABLES
// ===========================================================================================================

// Rendering options
    SPEED = 0;
    SHADOWS = true;

// Movement Limitations
    MAX_TURN = Math.PI / 2;
    MAX_VELOCITY = 10;
    MIN_VELOCITY = .1;

// Entity drawing
    WEDGE_ANGLE = Math.PI * 0.25;
    ENTITY_SIZE = 9;

// Neural Tuning
    MAX_NET_LAYERS = 5;
    NEURONS_PER_LAYER = 20; // Should never be less than number of inputs (currently 4)
    MAX_AXONS = 20;
    MAX_STRENGTH = 12;
    MAX_TRIGGER = 20;
    MIN_TRIGGER = 5;
    MAX_RELAXATION = 99;
    THOUGHTS_PER_MOVE = 64;

// Genetics and Population
    POPULATION_SIZE = 264;
    MUTATION_RATE = 1.5;
    MUTATION_DELTA = 4.0;
    PRECISION = 2;
    SEX = true;

// Perceptual Limatations
    FIELD_OF_VIEW = Math.PI;
    VIEW_DISTANCE = 192;

// Food, Metabolism, Aging
    MIN_FOOD_SIZE = 2;
    MAX_FOOD_SIZE = 8;
    FOOD_COUNT = 200;
    STARVATION_LENGTH = 600;
    OLD_AGE = 8192;
    ENERGY_COST = 1.5;

// World Boundary Handling
    CAN_WANDER = true;
    TELEPORT = true;

// Graphs and Reporting
    REPORTING_RATE = 100;
    HISTORY_LENGTH = 384;
    NODE_RADIUS = 18;

//                                                                                            GLOBAL VARIABLES
// ===========================================================================================================

var mainLoop;

// Canvas globals
    var context;
    var canvas;

// Statistics
    var born = 0;
    var eaten = 0;
    var natural = 0;
    var starved = 0;
    var wandered = 0;
    var lowScore = 0; // Only used for graph drawing
    var highScore = 0;
    var iteration = 0;
    var historyList = [];
    var mutationCount = 0;
    
// Time Keeping
    var startTime = new Date();
    var timeStamp = startTime.getTime() / 1000;

//                                                                                            GENESIS FUNCTION
// ===========================================================================================================
    
function genesis() {
    canvas = document.getElementById('world');
    
    // Do initial canvas sizing
    window.onresize();

    // Hide wander column if unneeded
    if ( ! CAN_WANDER ) {
        document.getElementById('stats-area').className = 'noWander';
    }
    
    // Check browser compatability
    if ( !canvas || !canvas.getContext ) {
        alert("Sorry, you're browser can't run this demo.  Please try the lastest Firefox or Chrome browser instead");
        return;
    }
  
    // Get the canvas context
    context = canvas.getContext('2d');
    
    // Activate tooltips for the diagram
    setDiagramMouseHandlers();
    
    // Activate hover animation for time
    counterHover();
    
    // Create our population
    population = new Population();
    mainLoop = setInterval( function() {
        // Keep track of our iteration count
        iteration++;
        
        // Clear the drawing area
        context.clearRect( 0, 0, canvas.width, canvas.height );
        
        // Draw the food supply
        population.foodSupply.draw();
        
        // Run a tick of population life cycle
        population.run();
        
        drawCounters();
        
        updateGraph();
        updateDiagram();
        
        printStats();
    }, SPEED );
}

//                                                                                            POPULATION CLASS
// ===========================================================================================================

function Population( foodSupply ) {
    this.entities = [];
    
    if ( typeof( foodSupply == 'undefined' ) ) {
        this.foodSupply = new FoodSupply();
    } else {
        this.foodSupply = foodSupply;
    }
    
    // Fill our population with entities
    for ( var i = 0; i < POPULATION_SIZE; i++ ) {
        var entity = new Entity;
        entity.population = this;
        this.entities.push( entity );
    }
}

Population.prototype.run = function() {
    this.sortSuccess();
    for ( var i = 0; i < this.entities.length; i++ ) {
        var entity = this.entities[ i ];
        
        entity.think();
        entity.move();
        entity.eat( this.foodSupply );
        entity.draw();
        
        // Check entity lifecycle and replace dead entities
        if ( ! entity.live() ) {
        
            // Copy the genome of a random winner
            var winningGenome = this.findWinner();
            var newGenome = new Genome( winningGenome );
            
            // Mutate it
            newGenome.mutate();

            // Spawn a new entity from it
            var newEntity = new Entity( newGenome );
            
            // Associate the entity with our population
            newEntity.population = this;
      
            // Put it back in the array
            this.entities[ i ] = newEntity;
        }
    }
}

Population.prototype.sortSuccess = function() {
    this.entities.sort( function( a, b ) {
        return b.life.f - a.life.f;
    });
}

Population.prototype.findWinner = function() {
    var weightedList = [];
    for ( i in this.entities ) {
        var entity = this.entities[ i ];
        var successFactor = entity.life.f;
        for ( var j = 0; j < successFactor; j++ ) {
            weightedList.push( entity );
        }
    }
    if ( weightedList.length > 0 ) {
        var winner = weightedList[ Math.floor( Math.random() * weightedList.length ) ];
        return winner.genome;
    } else {
        return new Genome();
    }
}

//                                                                                                ENTITY CLASS
// ===========================================================================================================

function Entity( genome ) {
    // Increment birth counter
    born++;

    // Record genome
    this.genome = new Genome( genome );
    
    // Generate the entities brain using provided genome
    this.brain = [];
    for ( i = 0; i < MAX_NET_LAYERS; i++ ) {
        var layer = [];
        for ( j = 0; j < NEURONS_PER_LAYER; j++ ) {
            var a = [];
            var g = this.genome.genes[ ( i * NEURONS_PER_LAYER ) + j ];
            for ( k in g.a ) {
                var ga = g.a[k];
                a.push({ x: ga.x, y: ga.y, s: ga.s });
            }
            layer.push( { a: a, t: g.t, e: 0, r: g.r } );
        }
        this.brain.push( layer );
    }
    
    this.position = {
        // Starting position and angle
         x: canvas.width * Math.random()
        ,y: canvas.height * Math.random()
        ,a: Math.random() * Math.PI * 2
    }

    this.output = {
        // Movement counters
         al: 0  // Left angle
        ,ar: 0  // Right angle
        ,v:  0  // Velocity accelerator
        ,vn: 0  // Velocity suppressor
        ,ov: 0  // Keep track of last velocity to extract energy cost
    }
    
    // Set life cycle parameters
    this.life = {
         f: 0   // Food eaten
        ,l: 1   // Lifespan
        ,h: 0   // Hunger
    }
}

// Process Entity lifecycle
Entity.prototype.live = function() {
    // Increment life counter
    this.life.l++;

    ww = canvas.width;
    wh = canvas.height;
    e = this.position;
    
    if ( e.x > ww || e.x < 0 || e.y > wh || e.y < 0 ) {
        wandered++;
        return false;
    } 
    
    // Randomly kill entities if it's exceeded starvation threshold
    if ( this.life.h > STARVATION_LENGTH ) {
        // Vulnerable entities have 1/100 chance of death
        if ( Math.random() * 100 <= 1 ) {
            starved++;
            return false;
        }
    // Randomly kill entities who've entered old age
    } else if ( this.life.l > OLD_AGE ) {
        // Vulnerable entities have 1/100 chance of death
        if ( Math.random() * 100 <= 1 ) {
            natural++;
            return false;
        }
    }
    return true;
}

Entity.prototype.findFood = function() { 

    if ( typeof( this.population ) == 'undefined' ) console.log( this );
    var foodSupply = this.population.foodSupply;

    // An array of vectors to foods from this entity's perspective
    var foodVectors = [];
    
    // Simplify reference to entity's position using 'e' variable
    var e = this.position;
    
    // Loop through foodSupply
    for ( i in foodSupply.food ) {
        var f = foodSupply.food[i];
        
        // Find polar coordinates of food relative this entity
        var dx = f.x - e.x; if ( dx == 0 ) dx = 0.000000000001;
        var dy = f.y - e.y;
        
        // Check bounding box first for performance
        if ( Math.abs( dx ) < VIEW_DISTANCE && Math.abs( dy ) < VIEW_DISTANCE ) {
        
            // Find angle of food relative to entity
            var angle = e.a - Math.atan2( dy, dx );

            // Convert angles to right of center into negative values
            if ( angle > Math.PI ) angle -= 2 * Math.PI;
            
            // Calculate distance to this food
            var distance = Math.sqrt( dx * dx + dy * dy );

            // If the food is in viewing range add it to our list
            if ( Math.abs( angle ) <= FIELD_OF_VIEW / 2 && distance <= VIEW_DISTANCE ) {
                foodVectors.push({
                     distance: distance
                    ,angle: angle
                    ,food: f
                });
            }
        }
    }
    
    // Sort our food vectors by distance
    return foodVectors.sort( function( a, b ) {
        return a.distance - b.distance;
    });
}

Entity.prototype.think = function() {
    var foodList = this.findFood();

    // All inputs should be a value of 0 to 1
    var inputs = [
        // left
         typeof( foodList[0] ) == 'undefined' || foodList[0].angle < 0 ? 0 : 
            ( Math.abs( foodList[0].angle ) / ( FIELD_OF_VIEW / 2 ) )
            
        // distance
        ,typeof( foodList[0] ) == 'undefined' ? 0 :
            ( ( VIEW_DISTANCE - foodList[0].distance ) / VIEW_DISTANCE )
            
        // right
        ,typeof( foodList[0] ) == 'undefined' || foodList[0].angle > 0 ? 0 :
            ( Math.abs( foodList[0].angle ) / ( FIELD_OF_VIEW / 2 ) )
            
        // distance to wall
        ,( VIEW_DISTANCE - this.wallDistance() ) / VIEW_DISTANCE
    ];
   
    // Normalize inputs to MAX_STRENGTH
    for ( i in inputs ) {
        inputs[ i ] = inputs[ i ] * MAX_STRENGTH;
    }
    
    // Run through the brain layers once for each 'thought'
    for ( var thought = 0; thought < THOUGHTS_PER_MOVE; thought++ ) {

        for ( var i = 0; i < this.brain.length; i++ ) {
            var layer = this.brain[ i ];
            for ( j = 0; j < layer.length; j++ ) {
                var neuron = layer[ j ];
                
                // Activate inputs if this is the first layer
                if ( i == 0 ) {
                    neuron.e += isNaN( inputs[ j ] ) ? 0 : inputs[ j ];
                }
                
                // Fire neurons that exceed threshold
                if ( neuron.e > neuron.t ) {
                    // Handle motor neurons
                    if ( i == this.brain.length - 1) {
                        // Zero excitation
                        neuron.e = 0;
                        // Increment motor counter
                        this.output[ [ 'al', 'v' ,'ar', 'vn' ][ j ] ]++;
                    } else {
                        // Fire axons
                        for ( k in neuron.a ) {
                            a = neuron.a[k];
                            var target = this.brain[ i + 1 ][ a.x ];
                            target.e += neuron.a[k].s;
                            
                            // Prevent negative excitation of target
                            if ( target.e < 0 ) target.e = 0;
                            
                            // Zero excitation
                            neuron.e = 0;
                        }
                    }
                } else {
                    // Relax neuron
                    neuron.e *= neuron.r;
                    
                    // We don't need infinitesimals
                    if ( neuron.e < 0.01 ) neuron.e = 0;
                }
            }
        }
    }
}

// Move the entity
Entity.prototype.move = function() {
    var v = 0;
    var ll = this.brain.length - 1;
    
    var ww = canvas.width;
    var wh = canvas.height;
    
    var turnIncrement = MAX_TURN / THOUGHTS_PER_MOVE;
    var velocityIncrement = ( MAX_VELOCITY - MIN_VELOCITY ) / THOUGHTS_PER_MOVE;
    
    this.position.a += this.output.al * turnIncrement;
    this.position.a -= this.output.ar * turnIncrement;
    var v =  this.output.v - this.output.vn;
    
    // Prevent reverse
    v =  MIN_VELOCITY + ( v * velocityIncrement );
    if ( v < 0 ) v = 0;
    this.output.ov = v;
   
    // Reset movement counters
    this.output.ar = 0;
    this.output.al = 0;
    this.output.v  = 0;
    this.output.vn = 0;
    
    // Keep angles within bounds
    this.position.a = this.position.a % ( Math.PI * 2 );
    if ( this.position.a < 0 ) this.position.a = ( Math.PI * 2 ) - this.position.a;
    
    // Convert movement vector into polar
    var dx = ( Math.cos( this.position.a ) * v );
    var dy = ( Math.sin( this.position.a ) * v );

    // Move the entity
    this.position.x += dx;
    this.position.y += dy;
   
    if ( ! CAN_WANDER ) {
             if ( this.position.x <= 0 )  this.position.x = TELEPORT ? ww :  0;
        else if ( this.position.x >= ww ) this.position.x = TELEPORT ?  0 : ww;
             if ( this.position.y <= 0 )  this.position.y = TELEPORT ? wh :  0;
        else if ( this.position.y >= wh ) this.position.y = TELEPORT ?  0 : wh;
    }
}

// Draw an entity on the canvas
Entity.prototype.draw = function() {
    var entitySize = ENTITY_SIZE;
    var e = this.position;

    // Find the angle 180deg of entity
    var ba = this.position.a + Math.PI;
    
    // Draw a halo around the current best entity
    if ( this == this.population.entities[0] ) {
        var hX = e.x + ( Math.cos( ba ) * ( entitySize / 2 ) );
        var hY = e.y + ( Math.sin( ba ) * ( entitySize / 2 ) );        
        var highlight = context.createRadialGradient( hX, hY, 0, hX, hY, entitySize );
        highlight.addColorStop( 0, "rgba( 255, 255, 255, 0.6 )" );
        highlight.addColorStop( 1, "rgba( 255, 255,  255, 0.0 )" );
        
        context.fillStyle = highlight
        context.beginPath();
            context.arc( hX , hY, entitySize, 0, Math.PI*2, true );
        context.closePath();        
        context.fill();

    }
    
    // Find left back triangle point
    var lx = Math.cos( ba + ( WEDGE_ANGLE / 2 ) ) * entitySize;
    var ly = Math.sin( ba + ( WEDGE_ANGLE / 2 ) ) * entitySize;

    // Find right back triangle point
    var rx = Math.cos( ba - ( WEDGE_ANGLE / 2 ) ) * entitySize;
    var ry = Math.sin( ba - ( WEDGE_ANGLE / 2 ) ) * entitySize;  

    // Find the curve control point
    var cx = Math.cos( ba ) * entitySize * 0.3;
    var cy = Math.sin( ba ) * entitySize * 0.3;
    
    // Color code entity based on food eaten compared to most successful
    var currentBest = this.population.entities[0].life.f;
    var r = currentBest == 0 ? 0 : Math.floor( ( 255 / currentBest ) * this.life.f );
    var b = ( 255 - r );
    var g = b;
    context.fillStyle = "rgb(" + r +  "," + g + "," + b + ")";
    context.strokeStyle = "#000";
    context.lineWidth = 2;
    
    // Draw the triangle
    context.shadow('rgba(0,0,0,0.5)', 2, 1, 1);
    context.beginPath();
        context.moveTo( e.x, e.y );
        context.lineTo( e.x + lx, e.y + ly );
        context.quadraticCurveTo( e.x + cx, e.y + cy, e.x + rx, e.y + ry );
    context.closePath();        
    context.stroke();
    context.shadow();
    context.fill();
    
    this.wallDistance();
}

Entity.prototype.eat = function( foodSupply ) {
    for ( i in foodSupply.food ) {
        var f = foodSupply.food[ i ];

        // Use formula for a circle to find food
        var x2 = ( this.position.x - f.x ); x2 *= x2;
        var y2 = ( this.position.y - f.y ); y2 *= y2;
        var s2 = f.s + 2; s2 *= s2;
        
        // If we are within the circle, eat it
        if (  x2 + y2 < s2 ) {
            // Increase entities total eaten counter
            this.life.f++;
            
            // Increment global eaten counter
            eaten++;
            
            // Decrease the size of the eaten food
            f.s--;
            
            // Replace the food if it's exhausted
            if ( f.s <= MIN_FOOD_SIZE ) {
                foodSupply.food[ i ] = new Food();
            }
            this.life.h = 0;
            return true;
        }
    }
    this.life.h += 1 + ( this.output.ov * ENERGY_COST );
    return false;
}

Entity.prototype.wallDistance = function() {
    var e = this.position;
    // Adjacent will distance to top wall if facing it
    if ( e.a > Math.PI ) {
        var adj = e.y;
        var angle = e.a - ( Math.PI * 1.5 );
        
    // Otherwise adjacent will be distance to bottom wall
    } else {
        var adj = canvas.height - e.y;
        var angle = ( Math.PI * 0.5 ) - e.a;
    }

    // Find the opposite side
    var opp = ( Math.tan( angle ) * adj );
    
    // If the intersection point is within the canvas width
    // Find and return hypoteneuse
    if ( opp + e.x > 0 && opp + e.x < canvas.width ) {
        var hyp = Math.sec( angle ) * adj;
        
        // If farther than view distance, use view distance
        if ( hyp > VIEW_DISTANCE ) {
            hyp = VIEW_DISTANCE;
        }
        return hyp;
    }

    // Adjacent will be distance to right wall if facing it
    if ( e.a > Math.PI * 1.5 || e.a < Math.PI * 0.5 ) {
        var adj = canvas.width - e.x;
        if ( e.a > Math.PI > Math.PI * 1.5 ) {
            angle = e.a - ( 2 * Math.PI );
        } else {
            angle = e.a;
        }
        
    // Otherwise adjacent will be distance to left wall
    } else {
        var adj = e.x;
        angle = Math.PI - e.a;
    }
    
    // Find the hypoteneuse
    var hyp = Math.sec( angle ) * adj;

    // If farther than view distance, use view distance
    if ( hyp > VIEW_DISTANCE ) {
        hyp = VIEW_DISTANCE;
    }
    return hyp;
}

//                                                                                     GENE AND GENOME CLASSES
// ===========================================================================================================

function Gene( source ) {
    // definitions: t = threshold, r = relaxation, a = axons, a.s = strength, a.x = target coordinate

    // Gene's axon array
    this.a = [];

    // Create random gene if not given a source
    if ( typeof ( source ) == 'undefined' ) {

        var axonCount = Math.floor( Math.random() * MAX_AXONS ) + 1;
        //var axonCount = MAX_AXONS;
        for ( var i = 0; i < axonCount; i++ ) {
            this.a.push({
                 x: Math.floor( Math.random() * NEURONS_PER_LAYER ).fix()
                ,s: ( MAX_STRENGTH - ( Math.random() * MAX_STRENGTH * 2 ) ).fix()
            });
        }
        this.t = ( ( ( MAX_TRIGGER - MIN_TRIGGER ) * Math.random() ) + MIN_TRIGGER ).fix();
        this.r = ( 1 - ( Math.random() * ( MAX_RELAXATION / 100 ) ) ).fix();

    } else {

        // Copy from source if given one
        for ( i in source.a ) {
            var a = source.a[i];
            this.a.push({ x: a.x, s: a.s });
        }
        this.t = source.t;
        this.r = source.r;
        
    }
}

Gene.prototype.mutate = function() {
    mutationCount++;

    // Create an object containing random mutations for all possible parameters
    var mutations = {
         x: Math.floor( Math.random() * NEURONS_PER_LAYER )
        ,s: ( Math.random() * MUTATION_DELTA * 2 ) - MUTATION_DELTA
        ,t: ( Math.random() * MUTATION_DELTA * 2 ) - MUTATION_DELTA
        ,e: ( Math.random() * MUTATION_DELTA * 2 ) - MUTATION_DELTA
        ,r: ( ( Math.random() * MUTATION_DELTA * 2 ) - MUTATION_DELTA ) * 0.1
    }
    
    // Because our mutation engine tweaks values rather than replacing them,
    // we need to prevent the tweaks from exceeding configured limits
    function enforceBounds( boundType, val ) {
        var bounds = {
             's': { u: MAX_STRENGTH, l: -1 * MAX_STRENGTH }
            ,'t': { u: MAX_TRIGGER, l: 0 }
            ,'e': { u: 0, l: 0 }
            ,'r': { u: 1, l: 1 - ( MAX_RELAXATION / 100 ) }
        }
        if ( val > bounds[ boundType ].u ) val = bounds[ boundType ].u;
        else if ( val < bounds[ boundType ].l ) val = bounds[ boundType].l;
        return val;
    }

    axonCount = this.a.length;
    
    // 5% chance of an entirely new gene
    if ( Math.random() * 20 <= 1 ) {
        return( new Gene() );
        
    // 10% chance of adding axon
    } else if ( axonCount < MAX_AXONS && Math.random() * 10 <= 1 ) {
        this.a.push({
             x: Math.floor( Math.random() * NEURONS_PER_LAYER )
            ,s: ( MAX_STRENGTH - ( Math.random() * MAX_STRENGTH * 2 ) ).fix()
        });
        //console.log( 'Added axon' );
    
    // 10% chance of removing axon
    } else if ( axonCount > 1 && Math.random() * 10 <= 1 ) {
        delete this.a[ Math.floor( Math.random() * axonCount ) ];
        //console.log( 'Deleted axon' );
        
    // Otherwise mutate what we have
    } else {
        var AXON_PROPERTIES = 2;
        var BASE_PROPERTIES = 2;
        var possibleChanges = ( axonCount * AXON_PROPERTIES ) + BASE_PROPERTIES;
        var randChange = Math.floor( possibleChanges * Math.random() );
        if ( randChange > BASE_PROPERTIES - 1 ) {
            randChange -= BASE_PROPERTIES;
            axonIndex = randChange % axonCount;
            var axon = this.a[ axonIndex ];
            var type = [ 'x', 's' ][Math.floor( Math.random() * AXON_PROPERTIES )];
            if ( type == 's' ) {
                axon[ type ] += mutations[ type ];
                axon[ type ] = enforceBounds( type, axon[ type ] ).fix();
                //console.log( 'Axon strength change', axon[ type ] );
            } else {
                axon[ type ] = mutations[ type ];
                //console.log( 'Changing axon connection point', mutations[ type ] );
            }
        } else {
            var index = randChange;
            var type = [ 't', 'r' ][ index ];
            this[ type ] += mutations[ type ];
            this[ type ] = enforceBounds( type, this[ type ] ).fix();
            //console.log( 'Adjusting neuron', type, this[ type ] );
        }
    }
}

function Genome( source ) {
    // Gene array
    this.genes = [];

    // Loop through genome size, either creating or copying genes as needed
    for ( i = 0; i < MAX_NET_LAYERS * NEURONS_PER_LAYER; i++ ) {
        var newGene;
        if ( typeof( source ) == 'undefined' ) {
            newGene = new Gene();
        } else {
            newGene = new Gene( source.genes[ i ] );
        }
        this.genes.push( newGene );
    }
}

Genome.prototype.mutate = function() {
    var num = Math.floor( MUTATION_RATE * Math.random() );
    for ( i = 0; i < num; i++ ) { 
        index = Math.floor( Math.random() * this.genes.length );
        this.genes[ index ].mutate();
    }
}

//                                                                                 FOOD AND FOODSUPPLY CLASSES
// ===========================================================================================================

function FoodSupply() {
    this.food = [];

    for ( var i = 0; i < FOOD_COUNT; i++ ) {
        this.food.push( new Food() );
    }
}

FoodSupply.prototype.draw = function() {
    for ( i in this.food ) {
        var food = this.food[i];
        if ( food.x > canvas.width || food.y > canvas.height ) {
            this.food[i] = new Food();
        }
        this.food[i].draw();
    }
}

function Food() {
    var BORDER = 20;
    this.x = BORDER + ( ( canvas.width - ( BORDER * 2 ) )  * Math.random() );
    this.y = BORDER + ( ( canvas.height - ( BORDER * 2 ) )  * Math.random() );
    this.s = MIN_FOOD_SIZE + ( ( MAX_FOOD_SIZE - MIN_FOOD_SIZE ) * Math.random() );
}

Food.prototype.draw = function() {

    if ( this.s != this.oldS ) {
        this.oldS = this.s;
        this.fillFood = context.createRadialGradient( this.x - 2, this.y - 2, 0, this.x, this.y, this.s );
        this.fillFood.addColorStop( 0, "rgba( 255, 204, 48, 0.9 )" );
        this.fillFood.addColorStop( 1, "rgba( 153, 102,  0, 0.9 )" );
    }
        
    context.beginPath();
        context.lineWidth = 3;
        context.strokeStyle = "#000";
        context.fillStyle = this.fillFood;

        context.arc( this.x, this.y, this.s, 0, Math.PI*2, true );

        context.shadow( "rgba( 0, 0, 0, 0.5 )", 2, 1 , 1 );
        context.stroke();
        context.shadow();
        
        context.fill();
    context.closePath();
}

//                                                                                       INFOGRAPHIC FUNCTIONS
// ===========================================================================================================

// Draw counters
function drawCounters() {
    // Draw the timer and born count
    
    // Get elapsed time in seconds
    var time = Math.floor( ( new Date( ( new Date()).getTime() - startTime.getTime() ) ).getTime() / 1000 );
    /*
    h = newTime.getUTCHours() + newTime.get;
    h = h == 0 ? "" : h + ":";
    m = newTime.getMinutes();
    m = m == 0 && h == "" ? "" : leadZero( m ) + ":";
    s = leadZero( newTime.getSeconds() );
    */
    
    var h = Math.floor( time / 3600 );
    var m = Math.floor( ( time % 3600 ) / 60 )
    var s = time % 60;

    s = leadZero( s );
    m = m == 0 && h == 0 ? "" : leadZero( m ) + ":";    
    h = h == 0 ? "" : h + ":";
    
    document.getElementById('time').innerHTML = h + m + s + "<br/>"
                                              + mutationCount + "/" + born + "<br/>"
                                              + population.entities[0].life.f + "/" + highScore;
}

function counterHover() {
    var element = document.getElementById('time');
    var MAX_OPACITY  = 1.0;
    var MIN_OPACITY  = 0.5;
    var OPACITY_STEP = 0.1;
    
    element.style.opacity = MIN_OPACITY;
    
    animHandler = function() {
        if ( element.opDirection == 'up' ) {
            if ( element.style.opacity < MAX_OPACITY ) {
                element.style.opacity = parseFloat( element.style.opacity ) + OPACITY_STEP;
            } else {
                clearInterval( element.opInterval );
                delete element.opInterval;
            }
        } else {
            if ( element.style.opacity > MIN_OPACITY ) {
                element.style.opacity = parseFloat( element.style.opacity ) - OPACITY_STEP;
            } else {
                clearInterval( element.opInterval );
                delete element.opInterval;
            }
        }
    };
    
    element.onmouseover = function() {
        if ( element.style.opacity < MAX_OPACITY ) {
            element.opDirection = 'up';
            if ( typeof( element.opInterval ) == 'undefined' ) {
                element.opInterval = setInterval( animHandler, 1 );
            }
        }
    }
    
    element.onmouseout = function() {
        if ( element.style.opacity > MIN_OPACITY ) {
            element.opDirection = 'down';
            if ( typeof( element.opInterval ) == 'undefined' ) {
                element.opInterval = setInterval( animHandler, 1 );
            }
        }
    }
}

// Print stats table
function printStats() {

    // Only run periodically
    if ( iteration % REPORTING_RATE == 0 ) {
        var statsTable = document.getElementById('stats-tbody');
        
        // Calculate averages
        var foodAverage = 0;
        var lifeAverage = 0;
        for ( i in population.entities ) {
            var e = population.entities[ i ];
            foodAverage += e.life.f;
            lifeAverage += e.life.l;
        }
        foodAverage /= population.entities.length;
        lifeAverage /= population.entities.length;
        lifeAverage = Math.floor( lifeAverage );
        
        // Keep track of time (for FPS)
        newTimeStamp = ( new Date() ).getTime() / 1000;
        
        // Add our new table row
        statsTable.insertBefore( tableRow([
             Math.floor( REPORTING_RATE / ( newTimeStamp - timeStamp ) )
            ,( ( foodAverage * 10000 ) / lifeAverage ).toFixed(2)
            ,foodAverage.toFixed(2)
            ,lifeAverage
            ,starved
            ,wandered
            ,natural
            ,eaten
            ,population.entities[0].life.f
        ]), statsTable.firstChild );
        
        // Reset counters
        starved = 0;
        wandered = 0;
        eaten = 0;
        natural = 0;
        
        // Record new timestamp
        timeStamp = newTimeStamp;
    }
}
function updateDiagram() {
    // Find the best ranking entity for the diagram
    var winner = population.entities[ 0 ];
    
    if ( winner !== updateDiagram.lastWinner ) {
        updateDiagram.lastWinner = winner;
    
        // Drawing parameters
        var BORDER = 20; // Border around diagram
        var SPREAD = 32; // Width of connection spread
        
        // Get canvas and context for diagram
        var dCanvas = document.getElementById('diagram');
        var dContext = dCanvas.getContext('2d');

        if ( ! updateDiagram.firstRun ) {
            dCanvas.x = [];
            dCanvas.y = [];
        }
        
        // Clear the drawing area
        dContext.clearRect( 0, 0, dCanvas.width, dCanvas.height );
       
        // Find brain dimensions
        var bh = winner.brain.length;
        var bw = winner.brain[0].length;

        // Find drawing area ( minus the borders )
        var drawAreaWidth = dCanvas.width - ( BORDER * 2 );
        var drawAreaHeight = dCanvas.height - ( BORDER * 2 );
        
        // Find the distance between nodes
        var distanceX = ( drawAreaWidth  - ( NODE_RADIUS * 2 ) )  / ( bw - 1 );
        var distanceY = ( drawAreaHeight - ( NODE_RADIUS * 2 ) )  / ( bh - 1 );

        // Loop through layers
        for ( i = 0; i < bh; i++ ) {
            // Find coordinates of node layer
            y = Math.floor( BORDER + NODE_RADIUS + ( i * distanceY ) );

            // If this is our first run through, register the coordinates
            // for the onmousemove handler
            if ( ! updateDiagram.firstRun ) {
                dCanvas.y[ i ] = y;
            }
            
            // Loop through nodes
            for ( j = 0; j < bw; j++ ) {
                // Find coordinates of node circle
                x = Math.floor( BORDER + NODE_RADIUS + ( j * distanceX ) );

                // If this is our first run through, register the coordinates
                // for the onmousemove handler
                if ( ! updateDiagram.firstRun && i == 0 ) {
                    dCanvas.x[ j ] = x;
                }
                
                // Draw axon connections if not last layer
                if ( i < bh - 1 ) {

                    // Calculate distance between axon end points
                    spreadDistance = SPREAD / winner.brain[i][j].a.length;
                
                    // Loop through axons
                    for ( k in winner.brain[i][j].a ) {
                        // Find our axon
                        var axon = winner.brain[i][j].a[k];
                        
                        // Calculate coordinates of axon targets
                        ax = Math.floor( BORDER + NODE_RADIUS + ( axon.x * distanceX ) - ( SPREAD / 2 ) + ( spreadDistance * k ) );
                        ay = Math.floor( BORDER + NODE_RADIUS + ( ( i + 1 ) * distanceY ) );

                        // Size line width relative to axon strength
                        dContext.lineWidth = ( axon.s / MAX_STRENGTH ) * ( ( SPREAD / MAX_AXONS ) / 2 );

                        // Draw the axon
                        dContext.beginPath();
                            dContext.shadow( "#000", 4, 2 ,2 );
                        
                            // Color codinbg ( green = excitory / red = inhibitory )
                            if ( axon.s > 0 ) dContext.strokeStyle = "#090";
                                else dContext.strokeStyle = "#900";
                            
                            // Draw the line
                            dContext.moveTo( x, y );
                            dContext.lineTo( ax, ay );
                            dContext.stroke();
                            dContext.shadow();
                        dContext.closePath();
                    }
                }
                // Draw node with white outer border
                dContext.strokeStyle = "#fff";
                dContext.lineWidth = 2.2;

                // Use a blue radial grandient to give impression of 3D
                var gradient = dContext.createRadialGradient( x - 5, y - 5, NODE_RADIUS * 0.4, x, y, NODE_RADIUS );
                gradient.addColorStop( 0, "#269" );
                gradient.addColorStop( 1, "#036" );
                dContext.fillStyle = gradient;

                dContext.beginPath();
                    dContext.shadow( "#000", 4, 2 ,2 );
                    dContext.arc( x, y, NODE_RADIUS, 0, Math.PI*2, true );
                    dContext.stroke();
                    dContext.shadow();
                    dContext.fill();      
                dContext.closePath();
                
                // Align text in node circle
                dContext.textAlign = "center";
                dContext.textBaseline = "middle";

                // White text with black shadow
                dContext.shadow( '#000', 4, 2, 2 );
                dContext.fillStyle = "#fff";
                
                // Draw threshold and relaxation rate
                dContext.fillText( winner.brain[i][j].t.toFixed(1), x, y - 6 );
                dContext.fillText( ( ( 1 - winner.brain[i][j].r ) * 100 ).toFixed(0) + "%", x, y + 6 );

                dContext.shadow();
            }
        }
    }
}

function setDiagramMouseHandlers() {
    var tipGrid = [];
    tipGrid[ 0 ] = [ 'Left angle of closest food',
                     'Proximity of the nearest food',
                     'Right angle of closest food',
                     'Proximity of the nearest wall' ];
    tipGrid[ MAX_NET_LAYERS - 1 ] = [ 'Left wheel',
                                      'Speed up',
                                      'Right wheel',
                                      'Slow down' ];
    var dCanvas = document.getElementById('diagram');
    var tip = document.getElementById('diagram-tip');
    var diagram = document.getElementById('diagram');
        
    diagram.onmousemove = function( e ) {
        tip.style.left  = '';
        tip.style.right = '';
        for ( i in dCanvas.x ) {
            var x = dCanvas.x[ i ];
            if ( e.offsetX > x - NODE_RADIUS && e.offsetX < x + NODE_RADIUS  ) {
                for ( j in dCanvas.y ) {
                    var y = dCanvas.y[ j ];
                    if ( e.offsetY > y - NODE_RADIUS && e.offsetY < y + NODE_RADIUS  ) {
                        if ( typeof( tipGrid[ j ] ) !== 'undefined' ) {
                            tipText = tipGrid[ j ][ i ];
                            if ( typeof( tipText ) !== 'undefined' ) {
                                tip.innerHTML = tipText;
                                
                                var posY = e.offsetY + dCanvas.offsetTop  + 12;
                                if ( posY + tip.offsetHeight < diagram.offsetHeight ) {
                                    tip.style.top  = posY;
                                    tip.style.bottom = '';
                                } else {
                                    tip.style.bottom = document.height - posY + 24;
                                    tip.style.top = '';
                                }

                                var posX = e.offsetX + dCanvas.offsetLeft + 12;
                                tip.style.right = '';
                                tip.style.left = 0;
                                if ( posX + tip.offsetWidth < document.width ) {
                                    tip.style.left = posX;
                                } else {
                                    tip.style.left = '';
                                    tip.style.right = document.width - posX + 24;
                                }
                                tip.style.visibility = 'visible';
                            }
                        }
                        return;
                    }
                }
                break;
            }
        }
        tip.style.visibility = 'hidden';
    }
    diagram.onmouseout = function( e ) {
        tip.style.visibility = 'hidden';
        tip.style.left = '';
        tip.style.right = '';
    }
    
}

function updateGraph() {
    if ( iteration % 33 == 0 ) {
        // Drawing parameters
        var BORDER = 20;

        var current = population.entities[0].life.f;

        // Get canvas and context for graph
        var gCanvas = document.getElementById('graph');
        var gContext = gCanvas.getContext('2d');
        
        // Record current best
        historyList.push({
            'mostEaten': current
        });
        
        // Trim historyList
        var historyLength = gCanvas.width - ( BORDER * 2 );
        if ( historyList.length > historyLength ) historyList.shift();
        
        // Update high score and low score
        if ( current > highScore ) highScore = current;
        if ( current < lowScore )  lowScore  = current;
        
        // Clear the graph canvas
        gContext.clearRect( 0, 0, gCanvas.width, gCanvas.height );
        
        // Find drawing area dimensions
        var drawAreaWidth  = gCanvas.width  - ( BORDER * 2 );
        var drawAreaHeight = gCanvas.height - ( BORDER * 2 );
        
        // Find distance between plots and vertical scaling facter
        var distanceX = historyList.length == 0 ? 1 : drawAreaWidth / ( historyList.length - 1 );
        var yRange = ( highScore - lowScore );
        var yScale = yRange == 0 ? 0 : drawAreaHeight / yRange;

        // Find starting point of graph
        var x = 0;
        var y = 0;

        // Draw 2 pixel wide white line with black shadow
        gContext.strokeStyle = "#fff";        
        gContext.lineWidth = 2;
        gContext.shadow( '#000', 4, 2, 2 );
        
        // Draw the graph line
        gContext.beginPath();
            var newLowScore = highScore;
            for ( i in historyList ) {
                var currentPoint = historyList[i].mostEaten;
            
                // Record old x,y
                ox = x;
                oy = y;
              
                // Find new x,y
                x = BORDER + ( i * distanceX );
                y = gCanvas.height - ( BORDER + ( ( currentPoint - lowScore ) * yScale ) );
                
                // Find lowest score
                if ( currentPoint < newLowScore ) newLowScore = currentPoint;

                // Break out on first loop through, we only want to find starting point
                if ( i == 0 ) continue;
                
                // Add line segment
                gContext.moveTo( ox, oy );
                gContext.lineTo( x, y );
            }
            lowScore = newLowScore;
            gContext.stroke();
        gContext.closePath();
    }
}

//                                                                                     MISCELLANEOUS FUNCTIONS
// ===========================================================================================================

window.onresize = function( event ) {
    canvas.width = window.innerWidth - 384;
    canvas.height = window.innerHeight - 192;
    document.getElementById('graph').height = window.innerHeight - 192 - 384;
}

function tableRow( items ) {
    var row = document.createElement('tr');
    for ( i in items ) {
        var cell = document.createElement('td');
        cell.innerHTML = items[ i ];
        row.appendChild( cell );
    }
    return row;
}

function leadZero( v ) {
    return ( v < 10 ? "0" : "" ) + v;
}

function detectBrowser() {
    if ( /Firefox/.test( navigator.userAgent ) ) {
        return "firefox";
    } else if ( /Chrome/.test( navigator.userAgent ) ) {
        return "chrome";
    } else {
        return "other";
    }
}

if ( detectBrowser() == 'chrome' && SHADOWS ) {

    CanvasRenderingContext2D.prototype.shadow = function( color, xOffset, yOffset, blurRadius ) {
        
        if ( typeof( color ) == 'undefined' ) {
            this.shadowBlur = 0;
            this.shadowOffsetX = 0;
            this.shadowOffsetY = 0;
        } else {
            this.shadowColor = color;
            this.shadowBlur = blurRadius;
            this.shadowOffsetX = xOffset;
            this.shadowOffsetY = yOffset;
        }
    }

} else {
    CanvasRenderingContext2D.prototype.shadow = function( color, xOffset, yOffset, blurRadius ) {};
}

Math.sec = function( a ) {
    return ( 1 / Math.cos( a ) );
}

Number.prototype.fix = function( digits ) {
    if ( typeof( digits ) == 'undefined' ) digits = PRECISION;
    var factor = Math.pow( 10, digits );
    return Math.round( this * factor ) / factor;
}

</script><style>

body {
    background: #000;
}
canvas#world {
    position: fixed;
    top: 0px;
    left: 0px;
    right: 384px;
    bottom: 256px;
    background-image:url(data:image/png;base64,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);
}
canvas#diagram {
    position: fixed;
    top: 0px;
    right: 0px;
    background: -webkit-linear-gradient(top, #666666 0%,#222222 16%,#222222 100%);
    background: -moz-linear-gradient(top, #666666 0%, #222222 16%, #222222 100%);
}
span#diagram-tip {
    position: fixed;
    background: #000;
    padding: 0px 5px;
    color: #ccc;
    opacity: 0.8;
    visibility: hidden;
    border: 1px solid #ccc;
    white-space: nowrap;
}

canvas#graph {
    position: fixed;
    top: 384px;
    bottom: 192px;
    right: 0px;
    background: -moz-linear-gradient(top, #222222 0%, #222222 64%, #000000 100%);
    background: -webkit-gradient(linear, left top, left bottom, color-stop(0%,#222222),
                                                                color-stop(64%,#222222),
                                                                color-stop(100%,#000000));
}
span#time {
    position: fixed;
    top: 0px;
    right: 384px;
    padding: 5px;
    font-family: monospace;
    font-size: 1.2em;
    font-weight: bold;
    color: white;
    text-shadow: 2px 2px 2px #000;
    text-align: right;
}
div#stats-area {
    position: fixed;
    bottom: 0px;
    height: 192px;
    left: 0px;
    right: 0px;
    background: black;
    overflow: auto;
}
table#stats-table {
    width: 100%;
    color: #fff;
}
th {
    background: #249;
}
div#stats-area.noWander th.wandered {
    display: none;
}
div#stats-area.noWander td:nth-child(6) {
    display: none;
}
td {
    text-align: center;
}
</style></head><body onload="genesis()">
<canvas height="697" width="1119" id="world"></canvas>
<canvas height="384" width="384" id="diagram"></canvas><span style="visibility: hidden;" id="diagram-tip"></span>
<canvas height="313" width="384" id="graph"></canvas>
<div id="stats-area"><table id="stats-table"><thead><tr>
    <th>FPS</th>
    <th>Avg. Health</th>
    <th>Avg. Eaten</th>
    <th>Avg. Age</th>
    <th>Starved</th>
    <th class="wandered">Wandered</th>
    <th>Died of Age</th>
    <th>Total Eaten</th>
    <th>Current Best</th>
</tr></thead><tbody id="stats-tbody"><tr><td>48</td><td>45.42</td><td>1.17</td><td>258</td><td>9</td><td>7</td><td>0</td><td>20</td><td>9</td></tr><tr><td>44</td><td>45.34</td><td>1.16</td><td>255</td><td>10</td><td>5</td><td>0</td><td>24</td><td>9</td></tr><tr><td>43</td><td>41.19</td><td>0.98</td><td>239</td><td>15</td><td>3</td><td>0</td><td>16</td><td>9</td></tr><tr><td>39</td><td>38.74</td><td>0.94</td><td>242</td><td>9</td><td>8</td><td>0</td><td>24</td><td>7</td></tr><tr><td>44</td><td>36.73</td><td>0.86</td><td>234</td><td>7</td><td>6</td><td>0</td><td>15</td><td>7</td></tr><tr><td>40</td><td>43.69</td><td>0.92</td><td>211</td><td>17</td><td>13</td><td>0</td><td>12</td><td>7</td></tr><tr><td>32</td><td>39.83</td><td>1.02</td><td>255</td><td>6</td><td>10</td><td>0</td><td>21</td><td>7</td></tr><tr><td>45</td><td>44.82</td><td>1.13</td><td>251</td><td>8</td><td>11</td><td>0</td><td>16</td><td>7</td></tr><tr><td>41</td><td>44.01</td><td>1.08</td><td>245</td><td>18</td><td>5</td><td>0</td><td>21</td><td>7</td></tr><tr><td>40</td><td>35.04</td><td>0.95</td><td>272</td><td>8</td><td>7</td><td>0</td><td>12</td><td>6</td></tr><tr><td>42</td><td>40.05</td><td>0.95</td><td>238</td><td>9</td><td>5</td><td>0</td><td>14</td><td>6</td></tr><tr><td>6</td><td>41.16</td><td>0.84</td><td>205</td><td>17</td><td>7</td><td>0</td><td>18</td><td>6</td></tr><tr><td>41</td><td>36.54</td><td>0.91</td><td>248</td><td>11</td><td>3</td><td>0</td><td>25</td><td>4</td></tr><tr><td>38</td><td>30.99</td><td>0.75</td><td>242</td><td>11</td><td>8</td><td>0</td><td>18</td><td>4</td></tr><tr><td>38</td><td>29.58</td><td>0.72</td><td>243</td><td>11</td><td>6</td><td>0</td><td>13</td><td>4</td></tr><tr><td>34</td><td>32.50</td><td>0.81</td><td>250</td><td>10</td><td>8</td><td>0</td><td>19</td><td>4</td></tr><tr><td>39</td><td>28.71</td><td>0.67</td><td>234</td><td>15</td><td>6</td><td>0</td><td>10</td><td>3</td></tr><tr><td>40</td><td>25.20</td><td>0.63</td><td>248</td><td>13</td><td>6</td><td>0</td><td>11</td><td>3</td></tr><tr><td>38</td><td>23.50</td><td>0.58</td><td>246</td><td>9</td><td>6</td><td>0</td><td>12</td><td>4</td></tr><tr><td>46</td><td>21.11</td><td>0.47</td><td>222</td><td>10</td><td>4</td><td>0</td><td>15</td><td>4</td></tr><tr><td>48</td><td>15.07</td><td>0.30</td><td>197</td><td>18</td><td>7</td><td>0</td><td>7</td><td>4</td></tr><tr><td>45</td><td>19.35</td><td>0.41</td><td>210</td><td>8</td><td>7</td><td>0</td><td>6</td><td>4</td></tr><tr><td>42</td><td>27.67</td><td>0.53</td><td>192</td><td>14</td><td>10</td><td>0</td><td>9</td><td>4</td></tr><tr><td>37</td><td>27.85</td><td>0.56</td><td>202</td><td>8</td><td>7</td><td>0</td><td>15</td><td>4</td></tr><tr><td>35</td><td>22.59</td><td>0.38</td><td>166</td><td>13</td><td>4</td><td>0</td><td>12</td><td>4</td></tr><tr><td>27</td><td>13.19</td><td>0.20</td><td>154</td><td>24</td><td>9</td><td>0</td><td>9</td><td>2</td></tr><tr><td>37</td><td>6.08</td><td>0.11</td><td>180</td><td>0</td><td>8</td><td>0</td><td>3</td><td>2</td></tr><tr><td>33</td><td>6.38</td><td>0.06</td><td>98</td><td>0</td><td>4</td><td>0</td><td>4</td><td>1</td></tr></tbody></table></div>
<span style="opacity: 0.5;" id="time">01:24<br>162/564<br>9/9</span>


</body></html>