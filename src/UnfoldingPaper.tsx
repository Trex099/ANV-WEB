import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { gsap } from 'gsap';

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
  const mainGroupRef = useRef<THREE.Group>(null!); // Overall group for centering and rotation
  const rightFoldGroupRef = useRef<THREE.Group>(null!); // Group for the right two segments, folds along vertical center
  
  // Refs for the four segments (TL, TR, BL, BR when looking at unfolded paper)
  const topLeftSegmentRef = useRef<THREE.Mesh>(null!);
  const topRightSegmentRef = useRef<THREE.Mesh>(null!);
  const bottomLeftSegmentRef = useRef<THREE.Mesh>(null!);
  const bottomRightSegmentRef = useRef<THREE.Mesh>(null!);

  const texture = props.textureUrl ? useLoader(THREE.TextureLoader, props.textureUrl) : null;
  const tl = useRef<gsap.core.Timeline | null>(null);

  // Memoize segments to prevent re-creation on re-renders unless texture changes
  const segments = useMemo(() => {
    if (!texture) return null; // Wait for texture
    // Create 4 segments, each a quarter of the total paper size
    // UVs are set to map to quadrants of the texture image
    // Top-Left: (0, 0.5) offset, (0.5, 0.5) scale
    const tlSeg = createPaperSegment(HALF_PAPER_WIDTH, HALF_PAPER_HEIGHT, texture, 'white', [0, 0.5], [0.5, 0.5]);
    // Top-Right: (0.5, 0.5) offset, (0.5, 0.5) scale
    const trSeg = createPaperSegment(HALF_PAPER_WIDTH, HALF_PAPER_HEIGHT, texture, 'lightgrey', [0.5, 0.5], [0.5, 0.5]);
    // Bottom-Left: (0, 0) offset, (0.5, 0.5) scale
    const blSeg = createPaperSegment(HALF_PAPER_WIDTH, HALF_PAPER_HEIGHT, texture, 'grey', [0, 0], [0.5, 0.5]);
    // Bottom-Right: (0.5, 0) offset, (0.5, 0.5) scale
    const brSeg = createPaperSegment(HALF_PAPER_WIDTH, HALF_PAPER_HEIGHT, texture, 'darkgrey', [0.5, 0], [0.5, 0.5]);
    return { tlSeg, trSeg, blSeg, brSeg };
  }, [texture]);

  useEffect(() => {
    if (!segments || !mainGroupRef.current || !rightFoldGroupRef.current || 
        !topLeftSegmentRef.current || !topRightSegmentRef.current || 
        !bottomLeftSegmentRef.current || !bottomRightSegmentRef.current) {
      return;
    }

    // Setup initial positions and rotations for a paper folded in quarters.
    // Imagine it's folded like a small square booklet, then opens up.
    // Final state: TL | TR
    //              BL | BR
    // Fold 1: Right side (TR, BR) folds over left side (TL, BL) along vertical centerline.
    // Fold 2: Top side (TL, TR after first fold) folds down over bottom side (BL, BR after first fold) along horizontal centerline.

    // Assign memoized segments to refs (this is a bit of a workaround for direct ref assignment with useMemo)
    topLeftSegmentRef.current = segments.tlSeg;
    topRightSegmentRef.current = segments.trSeg;
    bottomLeftSegmentRef.current = segments.blSeg;
    bottomRightSegmentRef.current = segments.brSeg;

    // Clear previous children if any from potential re-runs (though useMemo helps)
    mainGroupRef.current.clear();
    rightFoldGroupRef.current.clear();

    // Assemble the paper:
    // Left side (top-left and bottom-left segments)
    mainGroupRef.current.add(segments.tlSeg);
    mainGroupRef.current.add(segments.blSeg);
    // Right fold group contains top-right and bottom-right segments
    rightFoldGroupRef.current.add(segments.trSeg);
    rightFoldGroupRef.current.add(segments.brSeg);
    mainGroupRef.current.add(rightFoldGroupRef.current);

    // --- Initial Poses (Folded State) ---
    // Segments are HALF_PAPER_WIDTH x HALF_PAPER_HEIGHT
    // Top-Left segment (becomes the front-facing part of the fully folded paper)
    segments.tlSeg.position.set(-QUARTER_PAPER_WIDTH, QUARTER_PAPER_HEIGHT, 0.01); // Slightly in front
    // Bottom-Left segment (directly behind TL when top is folded down)
    segments.blSeg.position.set(-QUARTER_PAPER_WIDTH, -QUARTER_PAPER_HEIGHT, 0);
    
    // Right-Fold-Group (contains TR and BR)
    // This group will pivot around the left edge of TL/BL segments (vertical centerline of paper)
    rightFoldGroupRef.current.position.set(0, 0, 0); // Pivot is at x=0 of mainGroup
    segments.trSeg.position.set(QUARTER_PAPER_WIDTH, QUARTER_PAPER_HEIGHT, 0); // Relative to rightFoldGroup
    segments.brSeg.position.set(QUARTER_PAPER_WIDTH, -QUARTER_PAPER_HEIGHT, -0.01); // Slightly behind when folded

    // Initial Folds:
    // 1. Top fold (TL folds over BL, TR folds over BR). Rotate mainGroup around X-axis.
    //    However, it's easier to rotate the segments themselves or a sub-group for this.
    //    Let's assume the "booklet" is closed first, meaning the right side is folded over the left.
    //    So rightFoldGroup is rotated -PI around Y-axis and positioned at x=0.
    gsap.set(rightFoldGroupRef.current.rotation, { y: -Math.PI });
    gsap.set(rightFoldGroupRef.current.position, { x: -HALF_PAPER_WIDTH, z: 0.005 }); // Positioned to fold over left
    
    // 2. Then the whole thing (now TL/BL on top of TR/BR effectively) is folded top over bottom.
    //    Rotate the entire mainGroup around its bottom edge (horizontal centerline of the current folded state).
    //    For simplicity, let's rotate top segments (TL, TR) down. This is complex with current hierarchy.
    //    Alternative: Fold TL over BL, and TR (in its group) over BR.
    
    // Let's simplify: Start with right side (TR,BR) folded over left (TL,BL)
    // Then TL is folded over BL. TR is folded over BR.
    // This means `segments.tlSeg` and `segments.trSeg` are rotated -PI around X-axis.
    // Their pivot point needs to be their bottom edge.

    // Reposition segments for pivot points at their edges
    segments.tlSeg.position.set(-QUARTER_PAPER_WIDTH, HALF_PAPER_HEIGHT / 2, 0.02); // y is center of this segment
    segments.blSeg.position.set(-QUARTER_PAPER_WIDTH, -HALF_PAPER_HEIGHT / 2, 0);
    segments.trSeg.position.set(QUARTER_PAPER_WIDTH, HALF_PAPER_HEIGHT / 2, 0.01); // relative to its group
    segments.brSeg.position.set(QUARTER_PAPER_WIDTH, -HALF_PAPER_HEIGHT / 2, 0);

    // Set initial folded state:
    // 1. Top segments folded down over bottom segments
    gsap.set(segments.tlSeg.rotation, { x: -Math.PI }); 
    gsap.set(segments.trSeg.rotation, { x: -Math.PI });
    // Adjust y positions because rotation is around center. Effectively they sit on top of BL and BR.
    gsap.set(segments.tlSeg.position, { y: segments.blSeg.position.y + QUARTER_PAPER_HEIGHT, z: 0.02 });
    gsap.set(segments.trSeg.position, { y: segments.brSeg.position.y + QUARTER_PAPER_HEIGHT, z: 0.01 });

    // 2. Right group (TR+BR) folded over Left group (TL+BL)
    // rightFoldGroupRef pivots around its own local x= -QUARTER_PAPER_WIDTH (effectively the spine)
    // For this, we need to shift the contents of rightFoldGroupRef so its left edge is at its local x=0
    segments.trSeg.position.x = HALF_PAPER_WIDTH / 2; // Centered in its half
    segments.brSeg.position.x = HALF_PAPER_WIDTH / 2;
    gsap.set(rightFoldGroupRef.current.position, { x: -HALF_PAPER_WIDTH, y: 0, z: 0.005}); // Position for folding
    gsap.set(rightFoldGroupRef.current.rotation, { y: -Math.PI }); // Folded over
    

    // GSAP Timeline for Unfolding
    tl.current = gsap.timeline({ paused: true, onComplete: props.onAnimationComplete, onReverseComplete: props.onAnimationComplete });

    // Step 1: Unfold top segments (TL and TR)
    tl.current.to([segments.tlSeg.rotation, segments.trSeg.rotation], {
      x: 0, // Unfold to flat
      duration: FOLD_ANIMATION_DURATION,
      ease: 'power3.inOut',
      stagger: 0.05, // Slight stagger if desired
    }, "+=0.1"); // Start slightly after previous step or at beginning
    // Adjust positions back as they unfold (pivot was center)
    tl.current.to([segments.tlSeg.position, segments.trSeg.position], {
        y: (idx) => idx === 0 ? HALF_PAPER_HEIGHT / 2 : HALF_PAPER_HEIGHT / 2, // Back to their centered Y pos
        duration: FOLD_ANIMATION_DURATION,
        ease: 'power3.inOut',
        stagger: 0.05,
    }, "<" ); // Run concurrently with rotation

    // Step 2: Unfold the right group (TR+BR)
    tl.current.to(rightFoldGroupRef.current.rotation, {
      y: 0, // Unfold to flat
      duration: FOLD_ANIMATION_DURATION * 1.2, // Slightly longer for a larger movement
      ease: 'power3.inOut',
    });
    tl.current.to(rightFoldGroupRef.current.position, {
        x: 0, // Move to its final position (centered)
        z: 0,
        duration: FOLD_ANIMATION_DURATION * 1.2,
        ease: 'power3.inOut',
    }, "<"); // Run concurrently

  }, [segments, props.onAnimationComplete]); // Re-run if segments (texture) or callback changes

  useEffect(() => {
    if (tl.current) {
      if (props.isUnfolding) {
        tl.current.play();
      } else {
        // Ensure timeline is properly reset for reversing from any point
        tl.current.timeScale(1.5).reverse(0); // Reverse from its current position, slightly faster
      }
    }
  }, [props.isUnfolding]);

  // If segments are not ready (texture not loaded), render nothing for PaperMesh
  if (!segments) return null; 

  return (
    <group ref={mainGroupRef} rotation={[0,0,0]}> {/* Base rotation/position for the whole paper */}
        {/* Children are added dynamically in useEffect based on `segments` */}
        {/* This ensures that Object3Ds are not re-created on every render by JSX */}
        <primitive object={segments.tlSeg} ref={topLeftSegmentRef} />
        <primitive object={segments.blSeg} ref={bottomLeftSegmentRef} />
        <group ref={rightFoldGroupRef}>
            <primitive object={segments.trSeg} ref={topRightSegmentRef} />
            <primitive object={segments.brSeg} ref={bottomRightSegmentRef} />
        </group>
    </group>
  );
};

const UnfoldingPaper: React.FC<UnfoldingPaperProps> = ({ message, onClose, isOpen }) => {
  const [isAnimating, setIsAnimating] = useState(false); // True while open/close animation is running
  const [isFullyOpen, setIsFullyOpen] = useState(false); // True when paper is static and fully open

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      setIsFullyOpen(false); 
    } else {
      setIsFullyOpen(false);
      setIsAnimating(true); 
    }
  }, [isOpen]);

  if (!isOpen && !isAnimating) {
    return null; 
  }

  const handleInternalClose = () => {
    onClose(); 
  };
  
  const handleAnimationComplete = () => {
    if (isOpen) {
        setIsAnimating(false);
        setIsFullyOpen(true);
    } else {
        setIsAnimating(false);
    }
  };

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
        <Canvas camera={{ position: [0, 0, 6], fov: 50 }}> {/* Zoomed out slightly */}
          <ambientLight intensity={0.7} />
          <directionalLight position={[2, 3, 5]} intensity={1.0} />
          <directionalLight position={[-2, 3, -5]} intensity={0.5} /> {/* Added another light */}
          <React.Suspense fallback={null}>
            <PaperMesh 
              message={message} 
              isUnfolding={isOpen}
              onAnimationComplete={handleAnimationComplete}
              textureUrl="/textures/@Generated Image May 21, 2025 - 3_47PM.jpg"
            />
          </React.Suspense>
        </Canvas>
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