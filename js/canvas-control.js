// Oscar Saharoy 2021


// get mean and spread of a list of pointer positions
const getMeanPointer   = arr => arr.reduce( (acc, val) => v3add( acc, v3scale(val, 1/arr.length ) ), v3zero );
const getPointerSpread = (positions, mean) => positions.reduce( (acc, val) => acc + ((val[0]-mean[0])**2 + (val[1]-mean[1])**2)**0.5, 0 );
const getPositionDiffs = positions => positions.slice(1).map( (val,i) => v3sub( val, positions[i] ) ); 
const getEndToEnd      = positions => getPositionDiffs( positions ).reduce( v3add, v3zero );

// vars to track panning and zooming
let activePointers     = [];
let pointerPositions   = {};
let meanPointer        = v3zero;
let lastMeanPointer    = v3zero;
let pointerSpread      = 0;
let lastPointerSpread  = 0;
let endToEndVector     = v3zero;
let lastEndToEndVector = v3zero;
let skip1Frame         = false;
let shouldRedraw       = false;
let dpr                = 1; // vital
let furthestLeft       = Infinity;
let clipSpaceBBox      = [];
let clipSpaceBpoints   = [];

let interactiveUIElements = Array.from( document.querySelectorAll( "input, button" ) );
let uiScrollElement = document.querySelector( "#ui-scroll" );


// returns true if the pointer event occured over the geometry as rendered to the screen
const pointerOverGeometry = evt => !!getAlphaAtLocation( [ evt.clientX*dpr, canvas.height - evt.clientY*dpr ] );
const touchOverGeometry   = evt => !!getAlphaAtLocation( [ evt.touches[0].clientX*dpr, canvas.height - evt.touches[0].clientY*dpr ] );


function setPointerMeanAndSpread() {

    // get all the pointer vectors
    const pointers = Object.values( pointerPositions );

    // use functions to find mean and spread and end to end vector (normalised)
    meanPointer    = getMeanPointer( pointers );
    pointerSpread  = getPointerSpread( pointers, meanPointer );
    endToEndVector = v3norm( getEndToEnd( pointers ) );
}


function pointerdown( event ) {

    // if the user isn't manipulating the geometry and the user has tapped on an interactive
    // element or is scrolling, do nothing
    if( ( uiScrollElement.contains( event.target ) || interactiveUIElements.includes( event.target ) )
        && !pointerOverGeometry( event ) && !activePointers.length ) return;

    // dragging the geometry so prevent default and defocus everything
    event.preventDefault();
    document.activeElement.blur();

    // add the pointer to pointerPositions and activePointers
    pointerPositions[event.pointerId] = [event.pageX, -event.pageY, 0];
    activePointers.push( event.pointerId );

    // set the mean pointer position so that we have access to the new meanPointer straight away
    setPointerMeanAndSpread();

    // we added a new pointer so skip a frame to prevent
    // a step change in pan position
    skip1Frame = true;
}

function pointermove( event ) {

    // if this pointer isn't an active pointer (pointerdown occured
    // over a preventDrag element) then do nothing
    if( !activePointers.includes(event.pointerId) ) return;

    // keep track of the pointer pos
    pointerPositions[event.pointerId] = [ event.pageX, -event.pageY, 0 ];
}

function pointerup( event ) {

    // remove the pointer from active pointers and pointerPositions
    // (does nothing if it wasnt in them)
    activePointers = activePointers.filter( id => id != event.pointerId );
    delete pointerPositions[event.pointerId];

    // we lost a pointer so skip a frame to prevent
    // a step change in pan position
    skip1Frame = true;
}

function panAndZoom() {

    // if theres no active pointers do nothing
    if( !activePointers.length ) return;

    // set the mean pointer and spread
    setPointerMeanAndSpread();

    // we have to skip a frame when we change number of pointers to avoid a jump
    if( !skip1Frame ) {

        // calculate inverse model matrix (rotation matrix)
        const invModel = mat4.transpose(new Array(16), uModelMatrix);

        // calculate the movement of the mean pointer to use for panning
        const meanPointerMove = v3sub( meanPointer, lastMeanPointer );
        const axis = v3cross( [0,0,1], meanPointerMove );

        // rotate the geometry
        vec3.transformMat4( axis, axis, invModel );
        mat4.rotate( uModelMatrix, uModelMatrix, v3mod(axis) / 150, axis );
        
        // call the wheel function with a constructed event to zoom with pinch
        wheel( { deltaY: (lastPointerSpread - pointerSpread) * 2.4 } );

        // rotate around the z axis to twist
        const spinAmount = v3dot( v3cross( lastEndToEndVector, endToEndVector ), [0,0,1.4] );
        vec3.transformMat4( axis, [0,0,1], invModel );
        mat4.rotate( uModelMatrix, uModelMatrix, spinAmount, axis );

        // we've adjusted the viewpoint so redraw the scene
        shouldRedraw = true;
    }

    // update the vars to prepare for the next frame
    lastMeanPointer    = meanPointer;
    lastPointerSpread  = pointerSpread;
    lastEndToEndVector = endToEndVector;
    skip1Frame         = false;
}

function wheel( event ) {

    // prevent default body scrolling if the event is outside the uiScrollElement
    if( !uiScrollElement.contains( event.target ) ) event.preventDefault?.();

    // handle the case where the cursor is over the ui entries etc
    if( uiScrollElement.contains( event.target ) ) {

        // under these conditions, prevent default scroll and zoom the geometry
        if( pointerOverGeometry( event ) ) event.preventDefault();
        
        // in other conditions, return from the function and scroll the ui
        else return;
    }

    // limit zoom amount to avoid zooming through the origin
    const zoomAmount = Math.max( -0.2, event.deltaY / 600 );

    // move the view position towards or away from the origin
    vec3.scale( uViewPos, uViewPos, 1 + zoomAmount );
    mat4.lookAt( uViewMatrix, uViewPos, [0,0,0], [0,1,0] );

    // we adjusted the viewpoint so redraw the scene
    shouldRedraw = true;
}

function touchmove( event ) {

    if( !(uiScrollElement.contains( event.target ) || interactiveUIElements.includes( event.target ) )
        || touchOverGeometry( event ) || activePointers.length )
        
        event.preventDefault?.();
}


// add event listeners to body
document.body.addEventListener( "pointerdown",  pointerdown );
document.body.addEventListener( "pointerup",    pointerup   );
document.body.addEventListener( "pointerleave", pointerup   );
document.body.addEventListener( "pointermove",  pointermove, {passive: false} );
document.body.addEventListener( "wheel",        wheel      , {passive: false} );
document.body.addEventListener( "touchstart",   touchmove  , {passive: false} );
// document.body.addEventListener( "touchmove",    touchmove  , {passive: false} );