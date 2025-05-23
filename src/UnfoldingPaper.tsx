import React, { useRef, useState, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { gsap } from 'gsap';
import ErrorBoundary from './ErrorBoundary';

interface UnfoldingPaperProps {
  message: string;
  onClose: () => void;
  isOpen: boolean;
}

const PAPER_WIDTH = 3.5; // Slightly wider for a more standard paper aspect ratio
const PAPER_HEIGHT = 4.5;
const FOLD_ANIMATION_DURATION = 0.6; // Duration for each fold stage
const HALF_PAPER_WIDTH = PAPER_WIDTH / 2;
const HALF_PAPER_HEIGHT = PAPER_HEIGHT / 2;
const QUARTER_PAPER_WIDTH = PAPER_WIDTH / 4;
const QUARTER_PAPER_HEIGHT = PAPER_HEIGHT / 4;

// Helper to create a textured plane segment
const createPaperSegment = (width: number, height: number, texture: THREE.Texture | null, colorIfNotTextured: string, uvOffset: [number, number], uvScale: [number, number]) => {
  const geometry = new THREE.PlaneGeometry(width, height);
  
  // Adjust UVs for texture mapping across segments
  const uvs = geometry.attributes.uv as THREE.BufferAttribute;
  const newUvs = new Float32Array(uvs.count * 2);
  for (let i = 0; i < uvs.count; i++) {
    newUvs[i * 2] = uvs.getX(i) * uvScale[0] + uvOffset[0];
    newUvs[i * 2 + 1] = uvs.getY(i) * uvScale[1] + uvOffset[1];
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(newUvs, 2));

  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: !texture ? colorIfNotTextured : undefined,
    roughness: 0.8,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geometry, material);
};

const PaperMesh = (props: { message: string; textureUrl?: string; isUnfolding: boolean; onAnimationComplete: () => void }) => {
  const mainGroupRef = useRef<THREE.Group>(null!); 
  const rightFoldGroupRef = useRef<THREE.Group>(null!); 
  
  const texture = useMemo(() => {
    try {
      if (!props.textureUrl) {
        console.log("PaperMesh: No textureUrl provided.");
        return null;
      }
      console.log("PaperMesh: Attempting to load texture:", props.textureUrl);
      const loadedTexture = new THREE.TextureLoader().load(props.textureUrl, 
        () => console.log("PaperMesh: Texture loaded successfully:", props.textureUrl),
        undefined,
        (err) => console.error("PaperMesh: Error loading texture:", props.textureUrl, err)
      );
      return loadedTexture;
    } catch (error) {
      console.error("PaperMesh: Exception during texture loading setup:", error);
      return null;
    }
  }, [props.textureUrl]);

  const tl = useRef<gsap.core.Timeline | null>(null);

  const segments = useMemo(() => {
    if (!texture) {
        console.log("PaperMesh: No texture available for segments.");
        return null;
    }
    console.log("PaperMesh: Creating segments with texture.");
    const tlSeg = createPaperSegment(HALF_PAPER_WIDTH, HALF_PAPER_HEIGHT, texture, 'white', [0, 0.5], [0.5, 0.5]);
    const trSeg = createPaperSegment(HALF_PAPER_WIDTH, HALF_PAPER_HEIGHT, texture, 'lightgrey', [0.5, 0.5], [0.5, 0.5]);
    const blSeg = createPaperSegment(HALF_PAPER_WIDTH, HALF_PAPER_HEIGHT, texture, 'grey', [0, 0], [0.5, 0.5]);
    const brSeg = createPaperSegment(HALF_PAPER_WIDTH, HALF_PAPER_HEIGHT, texture, 'darkgrey', [0.5, 0], [0.5, 0.5]);
    return { tlSeg, trSeg, blSeg, brSeg };
  }, [texture]);

  useEffect(() => {
    if (!segments || !mainGroupRef.current || !rightFoldGroupRef.current) {
      console.log("PaperMesh Effect: Segments or refs not ready. Segments:", !!segments, "MainRef:", !!mainGroupRef.current, "RightFoldRef:", !!rightFoldGroupRef.current);
      return;
    }
    console.log("PaperMesh Effect: Setting up initial poses and GSAP timeline.");

    // --- Initial Poses (Folded State) ---
    // The JSX structure now handles adding segments to groups.
    // This effect only sets their initial transformations and the GSAP timeline.

    // Reposition segments for pivot points at their edges and initial layout
    // Note: These positions are relative to their parent group in the JSX structure.
    // TL and BL are direct children of mainGroupRef.
    // TR and BR are children of rightFoldGroupRef.

    // Left side (TL, BL)
    segments.tlSeg.position.set(-QUARTER_PAPER_WIDTH, HALF_PAPER_HEIGHT / 2, 0.02); 
    segments.blSeg.position.set(-QUARTER_PAPER_WIDTH, -HALF_PAPER_HEIGHT / 2, 0);
    
    // Right side (TR, BR) within rightFoldGroupRef
    // Their X positions are relative to rightFoldGroupRef's origin.
    segments.trSeg.position.set(QUARTER_PAPER_WIDTH, HALF_PAPER_HEIGHT / 2, 0.01);
    segments.brSeg.position.set(QUARTER_PAPER_WIDTH, -HALF_PAPER_HEIGHT / 2, 0);

    // Set initial folded state rotations:
    // 1. Top segments folded down over bottom segments
    gsap.set(segments.tlSeg.rotation, { x: -Math.PI }); 
    gsap.set(segments.trSeg.rotation, { x: -Math.PI });
    // Adjust Y positions because their rotation is around their own center.
    // When folded, tlSeg sits on blSeg, trSeg sits on brSeg.
    gsap.set(segments.tlSeg.position, { y: segments.blSeg.position.y + QUARTER_PAPER_HEIGHT, z: segments.tlSeg.position.z });
    gsap.set(segments.trSeg.position, { y: segments.brSeg.position.y + QUARTER_PAPER_HEIGHT, z: segments.trSeg.position.z });

    // 2. Right group (TR+BR) folded over Left group (TL+BL)
    // rightFoldGroupRef itself is positioned and rotated.
    // Its children (TR, BR) are already positioned relative to it.
    gsap.set(rightFoldGroupRef.current.position, { x: -HALF_PAPER_WIDTH, y: 0, z: 0.005}); 
    gsap.set(rightFoldGroupRef.current.rotation, { y: -Math.PI }); 
    
    // GSAP Timeline for Unfolding
    tl.current = gsap.timeline({ 
        paused: true, 
        onComplete: () => {
            console.log("PaperMesh GSAP: Unfolding animation complete.");
            props.onAnimationComplete();
        }, 
        onReverseComplete: () => {
            console.log("PaperMesh GSAP: Folding animation complete (reverse).");
            props.onAnimationComplete();
        },
        onError: (e) => {
            console.error("PaperMesh GSAP: Error in timeline", e);
        }
    });

    console.log("PaperMesh Effect: GSAP timeline created.");

    // Step 1: Unfold top segments (TL and TR)
    tl.current.to([segments.tlSeg.rotation, segments.trSeg.rotation], {
      x: 0, 
      duration: FOLD_ANIMATION_DURATION,
      ease: 'power3.inOut',
      stagger: 0.05,
    }, "+=0.1"); 
    // Adjust positions back as they unfold
    tl.current.to([segments.tlSeg.position, segments.trSeg.position], {
        // Target Y is their original centered Y position relative to their direct parent
        y: (idx) => idx === 0 ? HALF_PAPER_HEIGHT / 2 : HALF_PAPER_HEIGHT / 2, 
        duration: FOLD_ANIMATION_DURATION,
        ease: 'power3.inOut',
        stagger: 0.05,
    }, "<" );

    // Step 2: Unfold the right group (TR+BR)
    tl.current.to(rightFoldGroupRef.current.rotation, {
      y: 0, 
      duration: FOLD_ANIMATION_DURATION * 1.2, 
      ease: 'power3.inOut',
    });
    tl.current.to(rightFoldGroupRef.current.position, {
        x: 0, 
        z: 0,
        duration: FOLD_ANIMATION_DURATION * 1.2,
        ease: 'power3.inOut',
    }, "<");

  }, [segments, props.onAnimationComplete]);

  useEffect(() => {
    if (tl.current) {
      if (props.isUnfolding) {
        console.log("PaperMesh Effect: Playing unfolding animation.");
        tl.current.play();
      } else {
        console.log("PaperMesh Effect: Reversing folding animation.");
        tl.current.timeScale(1.5).reverse(0);
      }
    } else {
        console.log("PaperMesh Effect: GSAP timeline (tl.current) not available for play/reverse.");
    }
  }, [props.isUnfolding]);

  if (!segments) {
    console.log("PaperMesh Render: No segments to render. Returning fallback or null.");
    return <mesh><planeGeometry args={[1,1]} /><meshBasicMaterial color="red" wireframe /></mesh>; // Fallback if no segments
  } 

  console.log("PaperMesh Render: Rendering segments.");

  return (
    <group ref={mainGroupRef}>
        <primitive object={segments.tlSeg} />
        <primitive object={segments.blSeg} />
        <group ref={rightFoldGroupRef}>
            <primitive object={segments.trSeg} />
            <primitive object={segments.brSeg} />
        </group>
    </group>
  );
};

const UnfoldingPaper: React.FC<UnfoldingPaperProps> = ({ message, onClose, isOpen }) => {
  const [isAnimating, setIsAnimating] = useState(false); // True while open/close animation is running
  const [isFullyOpen, setIsFullyOpen] = useState(false); // True when paper is static and fully open

  useEffect(() => {
    console.log(`UnfoldingPaper Effect: isOpen changed to ${isOpen}. isAnimating: ${isAnimating}, isFullyOpen: ${isFullyOpen}`);
    if (isOpen) {
      setIsAnimating(true);
      setIsFullyOpen(false); 
    } else {
      // If it was open or animating to open, and now isOpen is false, start closing animation
      if (isFullyOpen || isAnimating) {
        setIsFullyOpen(false);
        setIsAnimating(true); 
      } else {
        // If it was already closed and not animating, do nothing
        setIsAnimating(false);
      }
    }
  }, [isOpen]);

  if (!isOpen && !isAnimating) {
    console.log("UnfoldingPaper Render: Not open and not animating, returning null.");
    return null; 
  }

  const handleInternalClose = () => {
    console.log("UnfoldingPaper: handleInternalClose triggered.");
    onClose(); 
  };
  
  const handleAnimationComplete = () => {
    console.log(`UnfoldingPaper: handleAnimationComplete. isOpen: ${isOpen}`);
    if (isOpen) {
        setIsAnimating(false);
        setIsFullyOpen(true);
        console.log("UnfoldingPaper: Now fully open and not animating.");
    } else {
        setIsAnimating(false); // Done closing
        console.log("UnfoldingPaper: Now fully closed and not animating.");
    }
  };
  
  console.log(`UnfoldingPaper Render: isOpen: ${isOpen}, isAnimating: ${isAnimating}, isFullyOpen: ${isFullyOpen}`);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 200,
        opacity: isOpen || isAnimating ? 1 : 0,
        transition: 'opacity 0.3s ease-in-out',
      }}
      onClick={isOpen && isFullyOpen ? handleInternalClose : undefined} 
    >
      <div 
        style={{ 
            width: 'clamp(300px, 90vw, ' + (PAPER_WIDTH * 100) + 'px)', // Max width based on paper
            height: 'clamp(400px, 90vh, ' + (PAPER_HEIGHT * 100) + 'px)', // Max height based on paper
            maxWidth: '800px', // Overall max
            maxHeight: '700px',
            position: 'relative'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <ErrorBoundary fallbackRender={(error, errorInfo) => (
          <div style={{ color: 'white', background: 'rgba(100,0,0,0.7)', padding: '20px', height:'100%', overflowY:'auto'}}>
            <h3>Animation Error</h3>
            <p>The 3D paper animation encountered a problem.</p>
            <pre><strong>Error:</strong> {error?.toString()}</pre>
            <details><summary>Details</summary><pre>{errorInfo?.componentStack}</pre></details>
          </div>
        )}>
          <Canvas camera={{ position: [0, 0, 6], fov: 50 }}> {/* Zoomed out slightly */}
            <ambientLight intensity={0.7} />
            <directionalLight position={[2, 3, 5]} intensity={1.0} />
            <directionalLight position={[-2, 3, -5]} intensity={0.5} /> {/* Added another light */}
            <Suspense fallback={ <mesh><planeGeometry /><meshBasicMaterial color="blue" wireframeLinewidth={3} /></mesh> /* Basic fallback for Suspense */ }>
              <PaperMesh 
                message={message} 
                isUnfolding={isOpen}
                onAnimationComplete={handleAnimationComplete}
                textureUrl="/textures/@Generated Image May 21, 2025 - 3_47PM.jpg"
              />
            </Suspense>
          </Canvas>
        </ErrorBoundary>
        {(isFullyOpen && isOpen) && ( 
          <>
            <button
              onClick={handleInternalClose}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: 'none',
                border: 'none',
                fontSize: '2.2rem',
                color: 'white', 
                cursor: 'pointer',
                zIndex: 201,
                textShadow: '0 0 6px black, 0 0 3px black', 
              }}
              aria-label="Close message"
            >
              &times;
            </button>
            {/* HTML text overlay for now - will be replaced by text on 3D paper */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: 'black',
                backgroundColor: 'rgba(255,255,255,0.8)',
                padding: '20px',
                borderRadius: '10px',
                textAlign: 'center',
                width: '85%',
                maxWidth: 'calc(100% - 40px)', 
                maxHeight: '80%',
                overflowY: 'auto',
                pointerEvents: 'none',
                zIndex: 202,
                boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
            }}>
                <h2 style={{fontSize: 'clamp(1.1em, 4vw, 1.5em)', marginBottom: '15px', fontWeight: 'bold', color: '#333'}}>A Special Note:</h2>
                <p style={{fontSize: 'clamp(0.9em, 3.5vw, 1.2em)', lineHeight: '1.7', color: '#444'}}>{message}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default UnfoldingPaper; 