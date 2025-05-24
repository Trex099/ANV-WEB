import React, { useRef, useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { gsap } from 'gsap';
import ErrorBoundary from './ErrorBoundary';

interface UnfoldingPaperProps {
  message: string;
  onClose: () => void;
  isOpen: boolean;
  isSmallScreen?: boolean;
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
    color: !texture ? colorIfNotTextured : undefined, // Fallback color if texture is null
    roughness: 0.8,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geometry, material);
};

// Constants for text texture generation
const DESKTOP_CANVAS_WIDTH = 700;
const DESKTOP_CANVAS_HEIGHT = 900;
const DESKTOP_FONT_SIZE_PX = 32;
const DESKTOP_MARGIN_HORIZONTAL_PX = 35; // 5% of 700
const DESKTOP_MARGIN_VERTICAL_PX = 45;   // 5% of 900
const DESKTOP_LINE_HEIGHT_MULTIPLIER = 1.3;

const MOBILE_CANVAS_WIDTH = 490; // 0.7x desktop
const MOBILE_CANVAS_HEIGHT = 630; // 0.7x desktop
const MOBILE_FONT_SIZE_PX = 30; // Slightly smaller absolute, but larger relative to canvas
const MOBILE_MARGIN_HORIZONTAL_PX = 25; // ~5% of 490
const MOBILE_MARGIN_VERTICAL_PX = 30;   // ~5% of 630
const MOBILE_LINE_HEIGHT_MULTIPLIER = 1.35; // Slightly more spacing for smaller text

const TEXT_COLOR = '#3D3D3D'; // Common for both

const generateTextTexture = (
    baseTexture: THREE.Texture | null,
    message: string,
    isSmallScreen: boolean | undefined, // Added isSmallScreen parameter
    onComplete: (texture: THREE.CanvasTexture) => void,
    onError: (error: any) => void
  ) => {

    const canvasWidth = isSmallScreen ? MOBILE_CANVAS_WIDTH : DESKTOP_CANVAS_WIDTH;
    const canvasHeight = isSmallScreen ? MOBILE_CANVAS_HEIGHT : DESKTOP_CANVAS_HEIGHT;
    const fontSizePx = isSmallScreen ? MOBILE_FONT_SIZE_PX : DESKTOP_FONT_SIZE_PX;
    const marginHorizontalPx = isSmallScreen ? MOBILE_MARGIN_HORIZONTAL_PX : DESKTOP_MARGIN_HORIZONTAL_PX;
    const marginVerticalPx = isSmallScreen ? MOBILE_MARGIN_VERTICAL_PX : DESKTOP_MARGIN_VERTICAL_PX;
    const lineHeightMultiplier = isSmallScreen ? MOBILE_LINE_HEIGHT_MULTIPLIER : DESKTOP_LINE_HEIGHT_MULTIPLIER;
    const textFont = `${fontSizePx}px Arial, sans-serif`;

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
  
    if (!ctx) {
      console.error("Failed to get 2D context for texture generation");
      onError(new Error("Failed to get 2D context"));
      return;
    }
  
    // Function to draw the base texture and then the text
    const drawCanvasContent = (img?: HTMLImageElement) => {
      // Fill background (e.g., with white if no base texture or if base texture fails to load)
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (img) {
        try {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        } catch (e) {
            console.error("Error drawing base image to canvas:", e);
            // Continue with white background if image drawing fails
        }
      } else {
        console.warn("No base image provided or loaded, using white background for texture.");
      }
  
      // Text properties
      ctx.font = textFont; // Use dynamically set textFont
      ctx.fillStyle = TEXT_COLOR;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
  
      // Text wrapping
      const words = message.split(' ');
      let line = '';
      const lines = [];
      const maxWidth = canvas.width - 2 * marginHorizontalPx; // Use dynamic margin
  
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
          lines.push(line.trim());
          line = words[n] + ' ';
        } else {
          line = testLine;
        }
      }
      lines.push(line.trim());
  
      // Calculate total text height and starting Y position to center the block
      const singleLineHeight = fontSizePx * lineHeightMultiplier; // Use dynamic font size and line height
      const totalTextHeight = lines.length * singleLineHeight;
      let startY = (canvas.height - totalTextHeight) / 2 + (singleLineHeight / 2); // Centered vertically

      // Ensure text starts within vertical margins if it's too long
      startY = Math.max(startY, marginVerticalPx + (singleLineHeight / 2)); // Use dynamic margin

      // Draw lines
      for (let i = 0; i < lines.length; i++) {
        const lineY = startY + i * singleLineHeight;
        // Check if the *start* of the next line would exceed the bottom margin area
        if (lineY - (singleLineHeight / 2) + (fontSizePx * 0.2) > canvas.height - marginVerticalPx && i > 0) { // fontSizePx*0.2 is a heuristic for descenders
            console.warn("Text content might be too long for the available space; truncating.");
            break;
        }
        ctx.fillText(lines[i], canvas.width / 2, lineY);
      }
  
      const canvasTexture = new THREE.CanvasTexture(canvas);
      canvasTexture.needsUpdate = true;
      onComplete(canvasTexture);
    };

    if (baseTexture && baseTexture.image) {
        if (baseTexture.image.complete && baseTexture.image.naturalHeight !== 0) {
            // Image already loaded
            drawCanvasContent(baseTexture.image);
        } else {
            // Image not yet loaded, wait for it
            const img = baseTexture.image as HTMLImageElement;
            img.onload = () => {
                baseTexture.needsUpdate = true; // Important for the texture to be usable
                drawCanvasContent(img);
            };
            img.onerror = (e) => {
                console.error("Error loading base texture image:", e);
                onError(e);
                drawCanvasContent(); // Draw with white background if base fails
            };
            // If the image src is set but not loaded, it should eventually call onload or onerror.
            // If src is not yet set (e.g. TextureLoader is still working), this might be an issue.
            // TextureLoader handles this by itself; direct image manipulation needs care.
            if (!img.src) { // This check might be too simplistic
                console.warn("Base texture image source is not set. Drawing without base texture.");
                drawCanvasContent();
            }
        }
    } else {
        console.warn("No baseTexture or baseTexture.image provided. Drawing with white background.");
        // Draw immediately with a white background or default paper color
        drawCanvasContent();
    }
};


const PaperMesh = (props: { message: string; textureUrl?: string; isUnfolding: boolean; onAnimationComplete: () => void; isSmallScreen?: boolean; }) => {
  const mainGroupRef = useRef<THREE.Group>(null!); 
  const rightFoldGroupRef = useRef<THREE.Group>(null!); 
  const [dynamicTexture, setDynamicTexture] = useState<THREE.CanvasTexture | null>(null);
  const [textureError, setTextureError] = useState<string | null>(null);

  // Load the base paper texture using useLoader, which integrates with Suspense
  const baseTexture = props.textureUrl ? useLoader(THREE.TextureLoader, props.textureUrl) : null;

  useEffect(() => {
    let currentTexture: THREE.CanvasTexture | null = null;

    const handleTextureGenerated = (newTexture: THREE.CanvasTexture) => {
      if (currentTexture && currentTexture !== newTexture) {
        // This case should not happen if logic is correct, but as a safeguard
        currentTexture.dispose(); 
      }
      setDynamicTexture((prevTexture) => {
        if (prevTexture && prevTexture !== newTexture) { // Ensure we don't dispose the new one if set rapidly
          prevTexture.dispose();
        }
        return newTexture;
      });
      setTextureError(null);
      currentTexture = newTexture; 
    };

    const handleTextureError = (error: any) => {
      console.error("Error generating dynamic texture:", error);
      setTextureError(`Failed to generate texture: ${error.toString()}`);
      setDynamicTexture((prevTexture) => {
        if (prevTexture) prevTexture.dispose();
        return null;
      });
    };

    if (!props.textureUrl && baseTexture === null) { // Explicitly handle no textureUrl case
      console.warn("PaperMesh: No textureUrl provided. Text will be on a white background.");
      generateTextTexture(null, props.message, props.isSmallScreen, handleTextureGenerated, handleTextureError);
    } else if (baseTexture) { // baseTexture is loaded (or null if no textureUrl)
      generateTextTexture(baseTexture, props.message, props.isSmallScreen, handleTextureGenerated, handleTextureError);
    }
    // If props.textureUrl is provided but baseTexture is still loading, Suspense handles it.
    // This effect will re-run once baseTexture is loaded.

    return () => {
      // Cleanup function when effect re-runs or component unmounts
      if (currentTexture) {
        currentTexture.dispose();
      }
      // Also ensure the state-held texture is cleaned if it's being replaced by an error state or unmount
      setDynamicTexture(prevTexture => {
        if (prevTexture && prevTexture !== currentTexture) { // If currentTexture was set to state
             // This check is tricky. The goal is to dispose the one that was in state if it's different from the one we just created and are about to dispose.
             // More robust: rely on the next effect run to clean its "prevTexture"
        }
        return prevTexture; // Keep or clear based on new state in main effect body
      });
    };
  }, [props.message, props.textureUrl, baseTexture, props.isSmallScreen]); // Added props.isSmallScreen


  const tl = useRef<gsap.core.Timeline | null>(null);

  const segments = useMemo(() => {
    if (textureError) {
        console.error("PaperMesh: Texture error, cannot create segments:", textureError);
        return null;
    }
    if (!dynamicTexture) {
        return null;
    }
    // UVs are set up for a single texture spanning all 4 segments
    const tlSeg = createPaperSegment(HALF_PAPER_WIDTH, HALF_PAPER_HEIGHT, dynamicTexture, 'white', [0, 0.5], [0.5, 0.5]);
    const trSeg = createPaperSegment(HALF_PAPER_WIDTH, HALF_PAPER_HEIGHT, dynamicTexture, 'lightgrey', [0.5, 0.5], [0.5, 0.5]);
    const blSeg = createPaperSegment(HALF_PAPER_WIDTH, HALF_PAPER_HEIGHT, dynamicTexture, 'grey', [0, 0], [0.5, 0.5]);
    const brSeg = createPaperSegment(HALF_PAPER_WIDTH, HALF_PAPER_HEIGHT, dynamicTexture, 'darkgrey', [0.5, 0], [0.5, 0.5]);
    return { tlSeg, trSeg, blSeg, brSeg };
  }, [dynamicTexture, textureError]);

  useEffect(() => {
    // This effect sets up the GSAP timeline for folding/unfolding.
    // It depends on `segments` being ready.
    // The actual animation poses should remain the same.
    if (!segments || !mainGroupRef.current || !rightFoldGroupRef.current) {
      return;
    }

    // --- Initial Poses (Folded State) ---
    segments.tlSeg.position.set(-QUARTER_PAPER_WIDTH, HALF_PAPER_HEIGHT / 2, 0.02); 
    segments.blSeg.position.set(-QUARTER_PAPER_WIDTH, -HALF_PAPER_HEIGHT / 2, 0);
    segments.trSeg.position.set(QUARTER_PAPER_WIDTH, HALF_PAPER_HEIGHT / 2, 0.01);
    segments.brSeg.position.set(QUARTER_PAPER_WIDTH, -HALF_PAPER_HEIGHT / 2, 0);

    gsap.set(segments.tlSeg.rotation, { x: -Math.PI }); 
    gsap.set(segments.trSeg.rotation, { x: -Math.PI });
    gsap.set(segments.tlSeg.position, { y: segments.blSeg.position.y + QUARTER_PAPER_HEIGHT, z: segments.tlSeg.position.z });
    gsap.set(segments.trSeg.position, { y: segments.brSeg.position.y + QUARTER_PAPER_HEIGHT, z: segments.trSeg.position.z });

    gsap.set(rightFoldGroupRef.current.position, { x: -HALF_PAPER_WIDTH, y: 0, z: 0.005}); 
    gsap.set(rightFoldGroupRef.current.rotation, { y: -Math.PI }); 
    
    tl.current = gsap.timeline({ 
        paused: true, 
        onComplete: () => {
            props.onAnimationComplete();
        }, 
        onReverseComplete: () => {
            props.onAnimationComplete();
        },
        onError: (e) => {
            console.error("PaperMesh GSAP: Error in timeline", e);
        }
    });

    tl.current.to([segments.tlSeg.rotation, segments.trSeg.rotation], {
      x: 0, 
      duration: FOLD_ANIMATION_DURATION,
      ease: 'power3.inOut',
      stagger: 0.05,
    }, "+=0.1"); 
    tl.current.to([segments.tlSeg.position, segments.trSeg.position], {
        y: (idx) => idx === 0 ? HALF_PAPER_HEIGHT / 2 : HALF_PAPER_HEIGHT / 2, 
        duration: FOLD_ANIMATION_DURATION,
        ease: 'power3.inOut',
        stagger: 0.05,
    }, "<" );

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

  }, [segments, props.onAnimationComplete]); // Keep dependencies correct

  useEffect(() => {
    // This effect controls playing or reversing the animation.
    if (tl.current) {
      if (props.isUnfolding) {
        tl.current.timeScale(1).play();
      } else {
        tl.current.timeScale(1.5).reverse(0); // Reverse slightly faster
      }
    }
  }, [props.isUnfolding]);

  if (textureError) {
    console.error("PaperMesh Render: Cannot render due to texture error:", textureError);
    return (
        <mesh>
            <planeGeometry args={[PAPER_WIDTH, PAPER_HEIGHT]} />
            <meshBasicMaterial color="red" wireframe>
                <text value={`Error: ${textureError}`} anchorX="center" anchorY="middle" />
            </meshBasicMaterial>
        </mesh>
    );
  }
  if (!segments) {
    // Provide a visual fallback that indicates loading, or just null if Suspense handles it higher up.
    return <mesh><planeGeometry args={[PAPER_WIDTH, PAPER_HEIGHT]} /><meshBasicMaterial color="lightgray" wireframe /></mesh>;
  } 

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

const UnfoldingPaper: React.FC<UnfoldingPaperProps> = ({ message, onClose, isOpen, isSmallScreen }) => {
  const [isAnimating, setIsAnimating] = useState(false); // True while open/close animation is running
  const [isFullyOpen, setIsFullyOpen] = useState(false); // True when paper is static and fully open

  useEffect(() => {
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
    return null; 
  }

  const handleInternalClose = useCallback(() => {
    onClose(); 
  }, [onClose]);
  
  const handleAnimationComplete = useCallback(() => {
    if (isOpen) {
        setIsAnimating(false);
        setIsFullyOpen(true);
    } else {
        setIsAnimating(false); // Done closing
    }
  }, [isOpen]);
  
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
          <Canvas camera={{ position: [0, 0, 6], fov: 50 }} dpr={[0.5, 1]}>
            <ambientLight intensity={0.8} /> 
            <directionalLight position={[2, 3, 5]} intensity={1.2} />
            <directionalLight position={[-2, -1, -5]} intensity={0.4} /> 
            <Suspense fallback={ 
              <mesh>
                <planeGeometry args={[PAPER_WIDTH/2, PAPER_HEIGHT/2]} />
                <meshBasicMaterial color="lightblue" wireframe />
              </mesh> 
            }>
              <PaperMesh 
                message={message} 
                isUnfolding={isOpen}
                onAnimationComplete={handleAnimationComplete}
                textureUrl="/textures/@Generated Image May 21, 2025 - 3_47PM.jpg" // This is the base paper texture
                isSmallScreen={isSmallScreen}
              />
            </Suspense>
          </Canvas>
        </ErrorBoundary>
        {/* Close button remains, but HTML message overlay is removed */}
        {(isFullyOpen && isOpen) && ( 
            <button
              onClick={handleInternalClose}
              style={{
                position: 'absolute',
                top: '15px',
                right: '15px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                fontSize: '1.8rem',
                lineHeight:'38px',
                color: 'white', 
                cursor: 'pointer',
                zIndex: 201,
                textShadow: '0 0 4px black', 
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              aria-label="Close message"
            >
              &times;
            </button>
        )}
      </div>
    </div>
  );
};

export default UnfoldingPaper;