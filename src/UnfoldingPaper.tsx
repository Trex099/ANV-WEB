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
  isParentAnimating: boolean; 
  onAnimationComplete: () => void 
}) => {
  const mainGroupRef = useRef<THREE.Group>(null!); 
  const rightFoldGroupRef = useRef<THREE.Group>(null!); 
  const textLineRefs = useRef<(THREE.Mesh | null)[]>([]);
  const [refsReady, setRefsReady] = useState(false);
  const hasRunAnimation = useRef(false);
  
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

  // Simple text wrapping logic - calculate lines
  const textLines = useMemo(() => {
    // Reset animation tracking when message changes
    hasRunAnimation.current = false;
    setRefsReady(false);
    
    // Determine max chars per line based on paper width (with some margin)
    const FONT_SIZE = 0.16;
    const maxLineWidth = PAPER_WIDTH * 0.85; // 85% of paper width for margins
    const maxCharsPerLine = Math.floor(maxLineWidth / (FONT_SIZE * 0.55));
    
    // Split message into words
    const words = props.message.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    // Simple word wrapping algorithm
    words.forEach(word => {
      const potentialLine = currentLine ? `${currentLine} ${word}` : word;
      if (potentialLine.length <= maxCharsPerLine) {
        currentLine = potentialLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    });
    
    // Add the last line
    if (currentLine) {
      lines.push(currentLine);
    }
    
    // Initialize or resize the refs array when lines change
    textLineRefs.current = new Array(lines.length).fill(null);
    
    return lines;
  }, [props.message]);

  // Effect to check if refs are ready
  useEffect(() => {
    if (props.isTextVisible) {
      // Check if all expected refs are populated
      const filledRefs = textLineRefs.current.filter(Boolean);
      if (filledRefs.length === textLines.length && textLines.length > 0) {
        console.log("All text line refs are ready now.");
        setRefsReady(true);
      } else {
        console.log(`Refs not fully ready yet. Got ${filledRefs.length}/${textLines.length} refs.`);
      }
    }
  }, [props.isTextVisible, textLines, textLineRefs.current]);

  // Effect to animate text appearance - runs when refs are confirmed ready
  useEffect(() => {
    if (props.isTextVisible && refsReady && !hasRunAnimation.current) {
      console.log("Text animation running with ready refs");
      
      // Mark as run so we don't re-run on the same visible instance
      hasRunAnimation.current = true;
      
      // Get all valid text line refs
      const validTextRefs = textLineRefs.current.filter(Boolean) as THREE.Mesh[];
      
      // Set a short timeout to ensure refs are fully populated in the DOM
      setTimeout(() => {
        validTextRefs.forEach((mesh, index) => {
          if (mesh && mesh.material) {
            const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
            if (material) {
              // Set initial state
              material.transparent = true;
              gsap.set(material, { opacity: 0 });
              gsap.set(mesh.position, { z: -0.02 }); // Start slightly below paper surface
              gsap.set(mesh.scale, { x: 0.95, y: 0.95, z: 0.95 });
              
              // Animate to visible state with a slight delay based on line position
              gsap.to(material, { 
                opacity: 1, 
                duration: 0.8, 
                delay: 0.1 + (index * 0.1),
                ease: 'power2.out' 
              });
              
              gsap.to(mesh.position, { 
                z: 0, 
                duration: 0.8, 
                delay: 0.1 + (index * 0.1),
                ease: 'power2.out' 
              });
              
              gsap.to(mesh.scale, { 
                x: 1, 
                y: 1, 
                z: 1, 
                duration: 0.8, 
                delay: 0.1 + (index * 0.1),
                ease: 'power2.out' 
              });
            }
          }
        });
      }, 100); // Small delay to ensure DOM is ready
    } else if (!props.isTextVisible) {
      // Reset animation flag when text is hidden
      hasRunAnimation.current = false;
      setRefsReady(false);
      
      // Make text invisible when not shown
      const validTextRefs = textLineRefs.current.filter(Boolean) as THREE.Mesh[];
      validTextRefs.forEach(mesh => {
        if (mesh && mesh.material) {
          const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
          if (material) {
            material.transparent = true;
            gsap.set(material, { opacity: 0 });
          }
        }
      });
    }
  }, [props.isTextVisible, refsReady, textLines]);

  // Calculate the line height and starting Y position for text block
  const FONT_SIZE = 0.16;
  const LINE_HEIGHT = FONT_SIZE * 1.5;
  const startY = ((textLines.length - 1) * LINE_HEIGHT) / 2;

  return (
    <group ref={mainGroupRef}>
        <primitive object={segments.tlSeg} />
        <primitive object={segments.blSeg} />
        <group ref={rightFoldGroupRef}>
            <primitive object={segments.trSeg} />
            <primitive object={segments.brSeg} />
        </group>
        
        {/* Simple Text with smooth appearance animation */} 
        {props.isTextVisible && (
          <Suspense fallback={null}>
            <group position={[0, 0, 0.03]}>
              {textLines.map((line, index) => (
                <Text
                  key={`line-${index}-${props.message}`} // Ensure keys are unique when message changes
                  ref={(el) => { 
                    if (el !== textLineRefs.current[index]) {
                      textLineRefs.current[index] = el; 
                      // Force a check for ref readiness
                      const filledRefs = textLineRefs.current.filter(Boolean);
                      if (filledRefs.length === textLines.length) {
                        setRefsReady(true);
                      }
                    }
                  }}
                  fontSize={FONT_SIZE}
                  color="black"
                  anchorX="center"
                  anchorY="middle"
                  position={[0, startY - (index * LINE_HEIGHT), 0]}
                  font="/fonts/ARIAL.TTF"
                  textAlign="center"
                >
                  {line}
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
                textureUrl="/textures/paper-texture.jpg" // Updated texture path
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