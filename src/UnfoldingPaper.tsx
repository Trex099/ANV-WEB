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
  const charRefs = useRef<(THREE.Mesh | null)[]>([]);
  const [populatedRefsCount, setPopulatedRefsCount] = useState(0);
  
  // NEW STATE: To store precise glyph layout information
  const [glyphLayouts, setGlyphLayouts] = useState<Array<{ x: number; width: number; char: string }> | null>(null);

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

  // RESTORED character splitting and individual letter layout logic
  const characters = useMemo(() => props.message.split(''), [props.message]);
  const FONT_SIZE = 0.16;
  // ESTIMATED_CHAR_WIDTH is no longer primary for positioning, but LINE_HEIGHT is still useful for animation.
  const LINE_HEIGHT = FONT_SIZE * 1.2; 
  // totalEstimatedWidth will be replaced by actual width from glyphLayouts

  // Effect to reset char refs and glyphLayouts when message changes
  useEffect(() => {
    console.log("[PaperMesh TextInit] Message changed. Resetting char refs and glyphLayouts. Message:", props.message);
    charRefs.current = new Array(props.message.length).fill(null); // Use props.message.length directly
    setPopulatedRefsCount(0);
    setGlyphLayouts(null); // Reset layouts so they are re-calculated
  }, [props.message]); // props.message is the source of truth for characters array

  useEffect(() => {
    // This effect depends on characters array which is derived from props.message
    // It ensures charRefs array is always correctly sized for the current message
    // before any attempt to populate it.
    if (charRefs.current.length !== characters.length) {
        console.log("[PaperMesh CharRefSync] Syncing charRefs length due to character array change.");
        charRefs.current = new Array(characters.length).fill(null);
        setPopulatedRefsCount(0); // Critical to reset if characters array identity changes
    }
  }, [characters]);

  useEffect(() => {
    if (!props.isTextVisible || !glyphLayouts || populatedRefsCount !== characters.length || characters.length === 0) {
      if (props.isTextVisible && !glyphLayouts) {
        // console.log("[PaperMesh TextAnim Effect] Waiting for glyphLayouts to be computed.");
      } else if (props.isTextVisible && glyphLayouts && populatedRefsCount !== characters.length) {
        // console.log(`[PaperMesh TextAnim Effect] Waiting for all charRefs. Populated: ${populatedRefsCount}, Expected: ${characters.length}`);
      }
      return;
    }

    console.log(`[PaperMesh TextAnim Effect] All conditions met. Animating IN ${characters.length} letters.`);
    const validTargets = charRefs.current.filter(Boolean) as THREE.Mesh[];
    if (validTargets.length !== characters.length) {
        console.warn(`[PaperMesh TextAnim Effect] Mismatch between populatedRefsCount/characters.length and actual valid targets. Expected ${characters.length}, got ${validTargets.length}. Aborting animation.`);
        return;
    }

    validTargets.forEach((target, index) => {
      const material = Array.isArray(target.material) ? target.material[0] : target.material as THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
      if (material) {
        material.transparent = true; 
        // console.log(`[PaperMesh TextAnim] Setting initial state for char '${characters[index]}' at index ${index}`);
        gsap.set(material, { opacity: 0 });
        gsap.set(target.position, { y: LINE_HEIGHT * 0.7 }); 
        gsap.set(target.scale, { x: 0.5, y: 0.5, z: 0.5 });
        gsap.set(target.rotation, { z: (Math.random() - 0.5) * Math.PI * 0.3 });

        // console.log(`[PaperMesh TextAnim] Starting GSAP animation for char '${characters[index]}' at index ${index}`);
        gsap.to(material, { opacity: 1, duration: 0.5, ease: 'power2.inOut', delay: index * 0.05 });
        gsap.to(target.position, { y: 0, duration: 0.7, ease: 'back.out(1.4)', delay: index * 0.05 });
        gsap.to(target.scale, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'back.out(1.4)', delay: index * 0.05 });
        gsap.to(target.rotation, { z: 0, duration: 0.7, ease: 'elastic.out(1, 0.75)', delay: index * 0.05 });
      } else {
        // console.warn(`[PaperMesh TextAnim] Material not found for char '${characters[index]}' at index ${index}`);
      }
    });
  }, [props.isTextVisible, populatedRefsCount, characters, glyphLayouts, LINE_HEIGHT, FONT_SIZE]);

  // Fallback if segments (the paper pieces themselves) aren't ready.
  if (!segments) {
    console.warn("[PaperMesh Render] Segments not ready. Rendering fallback.");
    return <mesh><planeGeometry args={[1,1]} /><meshBasicMaterial color="red" wireframe /></mesh>;
  }
  
  // Calculate total width for centering the group if layouts are available
  let totalTextWidth = 0;
  if (glyphLayouts && glyphLayouts.length > 0) {
    const firstGlyphX = glyphLayouts[0].x;
    const lastGlyph = glyphLayouts[glyphLayouts.length - 1];
    totalTextWidth = (lastGlyph.x + lastGlyph.width) - firstGlyphX;
  }

  // console.log(`[PaperMesh Render] glyphLayouts: ${glyphLayouts ? ' vorhanden' : 'nicht vorhanden'}, props.isTextVisible: ${props.isTextVisible}`);

  return (
    <group ref={mainGroupRef}>
        {/* Paper Segments - These should always be part of the scene if PaperMesh is rendered */} 
        <primitive object={segments.tlSeg} />
        <primitive object={segments.blSeg} />
        <group ref={rightFoldGroupRef}>
            <primitive object={segments.trSeg} />
            <primitive object={segments.brSeg} />
        </group>

        {/* Pass 1: Render invisible Text to calculate layout if not already done and text should be visible */}
        {props.isTextVisible && !glyphLayouts && props.message && (
          <Text
            fontSize={FONT_SIZE}
            font="/fonts/ARIAL.TTF"
            anchorX="left" 
            anchorY="middle"
            onSync={(troikaMesh: any) => { 
              if (troikaMesh && troikaMesh.textRenderInfo && troikaMesh.textRenderInfo.visibleGlyphs) {
                const computedLayouts = troikaMesh.textRenderInfo.visibleGlyphs.map((glyph: any, index: number) => ({
                  x: glyph.x,
                  width: glyph.xAdvance, 
                  char: props.message[glyph.charIndex] || characters[index], 
                }));
                if (props.message === characters.join('')) { 
                  setGlyphLayouts(computedLayouts);
                } else {
                  // console.warn('[PaperMesh LayoutCalculator] Message changed during layout. Discarded.');
                }
              } else {
                // console.warn('[PaperMesh LayoutCalculator] onSync: no textRenderInfo/visibleGlyphs.', troikaMesh);
              }
            }}
            visible={false} 
          >
            {props.message} 
          </Text>
        )}

        {/* Pass 2: Render visible, animated characters if layouts are ready and text should be visible */}
        {props.isTextVisible && glyphLayouts && characters.length > 0 && (
          <Suspense fallback={null}>
            <group position={[-totalTextWidth / 2, 0, 0.03]}> {/* Center the block of text */}
              {characters.map((char, index) => {
                if (!glyphLayouts || !glyphLayouts[index]) { 
                  // console.warn(`[PaperMesh Render] Missing glyphLayout for char '${char}' at index ${index}`);
                  return null;
                }
                const layout = glyphLayouts[index];
                return (
                  <Text
                    key={`${char}-${index}-${props.message}`} 
                    ref={(el: THREE.Mesh | null) => {
                      if (charRefs.current.length > index) { 
                          const oldRef = charRefs.current[index];
                          if (el && oldRef !== el) {
                              charRefs.current[index] = el;
                              setPopulatedRefsCount(prev => prev + 1);
                          } else if (!el && oldRef) {
                              charRefs.current[index] = null;
                              // This ensures count is accurate if a ref is cleared then re-added
                              setPopulatedRefsCount(prev => Math.max(0, prev -1)); 
                          }
                      }
                    }}
                    fontSize={FONT_SIZE}
                    color="black"
                    anchorX="left" 
                    anchorY="middle" 
                    position={[layout.x, 0, 0]} 
                    font="/fonts/ARIAL.TTF" 
                  >
                    {char}
                  </Text>
                );
              })}
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