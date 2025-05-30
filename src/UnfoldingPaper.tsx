import React, { useRef, useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { gsap } from 'gsap';
import ErrorBoundary from './ErrorBoundary';
import { Text } from '@react-three/drei';

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

const PaperMesh = (props: { 
  message: string; 
  textureUrl?: string; 
  isUnfolding: boolean; 
  isTextVisible: boolean;
  isParentAnimating: boolean; // New prop: tracks if the parent is in an animation phase
  onAnimationComplete: () => void 
}) => {
  const mainGroupRef = useRef<THREE.Group>(null!); 
  const rightFoldGroupRef = useRef<THREE.Group>(null!); 
  const charRefs = useRef<(THREE.Mesh | null)[]>([]);
  const [populatedRefsCount, setPopulatedRefsCount] = useState(0);

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
      console.log("PaperMesh Effect: Segments or refs not ready.");
      return;
    }
    console.log("PaperMesh Effect: GSAP setup. isUnfolding:", props.isUnfolding, "isParentAnimating:", props.isParentAnimating);

    let newTimelineInstanceCreated = false;
    if (!tl.current) {
      console.log("PaperMesh Effect: Creating new GSAP timeline instance.");
      newTimelineInstanceCreated = true;
      tl.current = gsap.timeline({
        paused: true,
        onComplete: () => {
          console.log("PaperMesh GSAP: Timeline onComplete. isUnfolding:", props.isUnfolding, "isParentAnimating:", props.isParentAnimating);
          // Only call parent's onAnimationComplete if it was an actual unfold animation sequence
          if (props.isUnfolding && props.isParentAnimating) {
            props.onAnimationComplete();
          }
        },
        onReverseComplete: () => {
          console.log("PaperMesh GSAP: Timeline onReverseComplete. isUnfolding:", props.isUnfolding, "isParentAnimating:", props.isParentAnimating);
          // Only call parent's onAnimationComplete if it was an actual fold animation sequence
          if (!props.isUnfolding && props.isParentAnimating) {
            props.onAnimationComplete();
          }
        },
        onError: (e) => {
            console.error("PaperMesh GSAP: Error in timeline", e);
        }
      });

      // --- Define animation from FOLDED to UNFOLDED ---
      // Position segments for pivot points at their edges (only needs to be done once when segments are defined)
      segments.tlSeg.position.set(-QUARTER_PAPER_WIDTH, HALF_PAPER_HEIGHT / 2, 0.02);
      segments.blSeg.position.set(-QUARTER_PAPER_WIDTH, -HALF_PAPER_HEIGHT / 2, 0);
      segments.trSeg.position.set(QUARTER_PAPER_WIDTH, HALF_PAPER_HEIGHT / 2, 0.01);
      segments.brSeg.position.set(QUARTER_PAPER_WIDTH, -HALF_PAPER_HEIGHT / 2, 0);

      // Step 1: Unfold top segments (TL and TR)
      tl.current.to([segments.tlSeg.rotation, segments.trSeg.rotation], {
        x: 0,
        duration: FOLD_ANIMATION_DURATION,
        ease: 'power3.inOut',
        stagger: 0.05,
      }, "+=0.1");
      tl.current.to([segments.tlSeg.position, segments.trSeg.position], {
        y: HALF_PAPER_HEIGHT / 2,
        duration: FOLD_ANIMATION_DURATION, // Corrected typo FAND_ to FOLD_
        ease: 'power3.inOut',
        stagger: 0.05,
      }, "<");

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
    }

    // Set initial state or snap to state if timeline was just created (first mount or remount)
    if (newTimelineInstanceCreated) {
      if (props.isUnfolding && !props.isParentAnimating) {
        // Target: UNFOLDED (likely a remount into an already open state)
        console.log("PaperMesh Effect: Snapping to UNFOLDED state.");
        gsap.set(segments.tlSeg.rotation, { x: 0 });
        gsap.set(segments.trSeg.rotation, { x: 0 });
        gsap.set(segments.tlSeg.position, { y: HALF_PAPER_HEIGHT / 2 });
        gsap.set(segments.trSeg.position, { y: HALF_PAPER_HEIGHT / 2 });
        gsap.set(rightFoldGroupRef.current.rotation, { y: 0 });
        gsap.set(rightFoldGroupRef.current.position, { x: 0, z: 0 });
        tl.current.seek(tl.current.duration()); // Go to end. onComplete will fire.
      } else {
        // Target: FOLDED (initial setup for an animation, or should be closed)
        console.log("PaperMesh Effect: Setting to FOLDED state for animation or closed state.");
        gsap.set(segments.tlSeg.rotation, { x: -Math.PI });
        gsap.set(segments.trSeg.rotation, { x: -Math.PI });
        gsap.set(segments.tlSeg.position, { y: segments.blSeg.position.y + QUARTER_PAPER_HEIGHT, z: segments.tlSeg.position.z });
        gsap.set(segments.trSeg.position, { y: segments.brSeg.position.y + QUARTER_PAPER_HEIGHT, z: segments.trSeg.position.z });
        gsap.set(rightFoldGroupRef.current.position, { x: -HALF_PAPER_WIDTH, y: 0, z: 0.005 });
        gsap.set(rightFoldGroupRef.current.rotation, { y: -Math.PI });
        tl.current.seek(0); // Go to start.
      }
    }
  }, [segments, props.onAnimationComplete, props.isUnfolding, props.isParentAnimating]); // Added isParentAnimating

  useEffect(() => {
    if (!tl.current) {
      console.log("PaperMesh AnimationControl: Timeline not ready for play/reverse.");
      return;
    }
    // console.log("PaperMesh AnimationControl: props.isUnfolding:", props.isUnfolding, "progress:", tl.current.progress(), "isActive:", tl.current.isActive());

    if (props.isUnfolding) { // Target state is OPEN
      if (tl.current.progress() < 1 && !tl.current.isActive()) {
        console.log("PaperMesh AnimationControl: Playing unfold animation.");
        tl.current.play();
      }
    } else { // Target state is CLOSED
      if (tl.current.progress() > 0 && !tl.current.isActive()) {
        console.log("PaperMesh AnimationControl: Playing fold animation (reverse).");
        tl.current.timeScale(1.5).reverse();
      }
    }
  }, [props.isUnfolding]); // This effect solely depends on the target state

  if (!segments) {
    console.log("PaperMesh Render: No segments to render. Returning fallback or null.");
    return <mesh><planeGeometry args={[1,1]} /><meshBasicMaterial color="red" wireframe /></mesh>; // Fallback if no segments
  } 

  // console.log("PaperMesh Render: Rendering segments.");

  const characters = useMemo(() => props.message.split(''), [props.message]);
  const FONT_SIZE = 0.16; // Reduced font size
  const ESTIMATED_CHAR_WIDTH = FONT_SIZE * 0.5; // Adjusted char width estimate
  const LINE_HEIGHT = FONT_SIZE * 1.2;
  const totalEstimatedWidth = characters.length * ESTIMATED_CHAR_WIDTH;

  // Effect to reset refs and count when message changes
  useEffect(() => {
    console.log("PaperMesh TextInit: Message changed, resetting refs state.");
    charRefs.current = new Array(characters.length).fill(null);
    setPopulatedRefsCount(0);
  }, [characters]); // Use memoized characters array

  useEffect(() => {
    console.log("PaperMesh TextAnim: Evaluating. Visible:", props.isTextVisible, "Refs Populated:", populatedRefsCount, "Expected:", characters.length);
    
    // Get valid targets once, upfront.
    const validTargets = charRefs.current.filter(Boolean) as THREE.Mesh[];

    if (props.isTextVisible && populatedRefsCount === characters.length && characters.length > 0) {
      if (validTargets.length !== characters.length) {
        // This case should ideally not be hit if populatedRefsCount is accurate
        console.warn("PaperMesh TextAnim: Mismatch between populatedRefsCount and actual valid targets. Aborting animation.");
        return;
      }
      console.log("PaperMesh TextAnim: Animating IN", validTargets.length, "letters.");

      validTargets.forEach((target, index) => {
        if (target.material) {
          // Ensure material is an object and not an array (usually not for Text)
          const material = Array.isArray(target.material) ? target.material[0] : target.material;
          if (material) {
            material.transparent = true; // ESSENTIAL for opacity to work
            
            // Set initial state
            gsap.set(material, { opacity: 0 });
            gsap.set(target.position, { y: LINE_HEIGHT * 0.7 }); // Start from above
            gsap.set(target.scale, { x: 0.5, y: 0.5, z: 0.5 });
            gsap.set(target.rotation, { z: (Math.random() - 0.5) * Math.PI * 0.3 }); // Random initial tilt

            // Animate to final state
            gsap.to(material, {
              opacity: 1,
              duration: 0.5, // Slightly faster opacity
              ease: 'power2.inOut',
              delay: index * 0.05, // Stagger animation
            });
            gsap.to(target.position, {
              y: 0,
              duration: 0.7,
              ease: 'back.out(1.4)',
              delay: index * 0.05,
            });
            gsap.to(target.scale, {
              x: 1,
              y: 1,
              z: 1,
              duration: 0.7,
              ease: 'back.out(1.4)',
              delay: index * 0.05,
            });
            gsap.to(target.rotation, {
              z: 0,
              duration: 0.7,
              ease: 'elastic.out(1, 0.75)',
              delay: index * 0.05,
            });
          } else {
            console.warn("PaperMesh TextAnim: Material not found for target index", index);
          }
        } else {
          console.warn("PaperMesh TextAnim: Target or material not found for index", index);
        }
      });
    } else if (!props.isTextVisible && validTargets.length > 0 && characters.length > 0) { // Check validTargets here
      console.log("PaperMesh TextAnim: Setting text to invisible (props.isTextVisible is false).");
      validTargets.forEach(target => {
        if (target.material) {
          const material = Array.isArray(target.material) ? target.material[0] : target.material;
          if (material) {
            gsap.set(material, { opacity: 0 });
          }
        }
      });
    }
  }, [props.isTextVisible, populatedRefsCount, characters, LINE_HEIGHT]); // Added characters to dependencies

  return (
    <group ref={mainGroupRef}>
        <primitive object={segments.tlSeg} />
        <primitive object={segments.blSeg} />
        <group ref={rightFoldGroupRef}>
            <primitive object={segments.trSeg} />
            <primitive object={segments.brSeg} />
        </group>
        
        {/* Animated Text: Renders each character individually */} 
        {props.isTextVisible && (
          <Suspense fallback={null}> {/* Inner Suspense for Text only */}
            <group position={[-totalEstimatedWidth / 2, 0, 0.03]}> {/* Center the block of text */}
              {characters.map((char, index) => (
                <Text
                  key={`${char}-${index}`}
                  ref={(el: THREE.Mesh | null) => {
                    // Only update if the ref instance actually changes to avoid potential loops
                    if (el && charRefs.current[index] !== el) {
                      charRefs.current[index] = el;
                      setPopulatedRefsCount(prev => prev + 1);
                    } else if (!el && charRefs.current[index]) {
                      // This part handles cleanup if a Text component unmounts and its ref becomes null
                      // For this app, characters don't dynamically unmount often, but good for robustness
                      charRefs.current[index] = null;
                      setPopulatedRefsCount(prev => prev - 1); // Should be paired with re-initialization logic if characters change
                    }
                  }}
                  fontSize={FONT_SIZE}
                  color="black"
                  anchorX="left"
                  anchorY="middle" 
                  position={[index * ESTIMATED_CHAR_WIDTH, 0, 0]} // Position each letter horizontally
                  // Set initial opacity to 0 to avoid flash before GSAP takes control if needed
                  // However, GSAP.set in useEffect should handle this if timed correctly.
                  // material-opacity={0} // Alternative way to set initial opacity if GSAP set is too slow
                >
                  {char}
                </Text>
              ))}
            </group>
          </Suspense>
        )}
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
  
  const handleAnimationComplete = useCallback(() => {
    console.log(`UnfoldingPaper: handleAnimationComplete. isOpen: ${isOpen}`);
    if (isOpen) {
        setIsAnimating(false);
        setIsFullyOpen(true);
        console.log("UnfoldingPaper: Now fully open and not animating.");
    } else {
        setIsAnimating(false); // Done closing
        console.log("UnfoldingPaper: Now fully closed and not animating.");
    }
  }, [isOpen]);
  
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
          <Canvas camera={{ position: [0, 0, 5], fov: 50 }}> {/* Adjusted camera Z from 6 to 5 */}
            <ambientLight intensity={0.8} /> {/* Slightly increased ambient light */}
            <directionalLight position={[2, 3, 5]} intensity={1.2} /> {/* Slightly increased main light */}
            <directionalLight position={[-2, -2, 4]} intensity={0.6} /> {/* Adjusted secondary light */}
            <Suspense fallback={ <mesh><planeGeometry /><meshBasicMaterial color="blue" wireframeLinewidth={3} /></mesh> /* Basic fallback for Suspense */ }>
              <PaperMesh 
                message={message} 
                isUnfolding={isOpen || isFullyOpen} 
                isTextVisible={isFullyOpen && isOpen} 
                isParentAnimating={isAnimating} // Pass isAnimating state here
                onAnimationComplete={handleAnimationComplete}
                textureUrl="/textures/Generated Image May 21, 2025 - 3_47PM.jpg"
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
            {/* HTML text overlay is now REMOVED */}
          </>
        )}
      </div>
    </div>
  );
};

export default UnfoldingPaper; 