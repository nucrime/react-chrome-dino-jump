import React, { useRef, useEffect, useState, useCallback } from 'react';

const CameraJumpDetector = ({ onJump, isGameActive }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isDetecting, setIsDetecting] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [previousFrames, setPreviousFrames] = useState([]);
  const [jumpThreshold, setJumpThreshold] = useState(50); // Motion threshold for jump detection
  const lastJumpTimeRef = useRef(0); // Use ref to avoid stale closure
  const [currentMotion, setCurrentMotion] = useState(0); // Debug info
  
  // No need for complex pose detector initialization

  // Setup camera and start detection
  useEffect(() => {
    const video = videoRef.current; // Capture ref at beginning of effect
    
    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 640,
            height: 480,
            facingMode: 'user'
          }
        });
        
        if (video) {
          video.srcObject = stream;
          video.onloadedmetadata = () => {
            video.play();
            setIsDetecting(true);
            lastJumpTimeRef.current = Date.now(); // Prevent immediate jump on init
          };
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        alert('Camera access is required for jump detection. Please allow camera permissions and refresh the page.');
      }
    };

    if (isGameActive) {
      setupCamera();
    }

    return () => {
      // Cleanup camera stream using captured ref
      if (video && video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, [isGameActive]);

  // Detect jump based on motion changes
  const detectJump = useCallback((frames, currentTime) => {
    if (frames.length < 6) return false; // Reduced minimum frames needed
    
    // Prevent multiple jumps within 250ms (more responsive)
    if (currentTime - lastJumpTimeRef.current < 250) return false;
    
    // Try multiple detection methods for better accuracy
    
    // Method 1: Brightness change detection
    const recentFrames = frames.slice(-2); // Last 2 frames for immediate response
    const olderFrames = frames.slice(-6, -4); // 2 frames from earlier
    
    let brightnessDiff = 0;
    let edgeDiff = 0;
    if (olderFrames.length > 0 && recentFrames.length > 0) {
      const recentAvg = recentFrames.reduce((sum, frame) => sum + frame.brightness, 0) / recentFrames.length;
      const olderAvg = olderFrames.reduce((sum, frame) => sum + frame.brightness, 0) / olderFrames.length;
      brightnessDiff = Math.abs(recentAvg - olderAvg);
      
      // Edge intensity change (often better for motion detection)
      const recentEdgeAvg = recentFrames.reduce((sum, frame) => sum + frame.edgeIntensity, 0) / recentFrames.length;
      const olderEdgeAvg = olderFrames.reduce((sum, frame) => sum + frame.edgeIntensity, 0) / olderFrames.length;
      edgeDiff = Math.abs(recentEdgeAvg - olderEdgeAvg);
    }
    
    // Method 2: Frame-to-frame variance (detects sudden changes)
    let variance = 0;
    if (frames.length >= 3) {
      const last3 = frames.slice(-3);
      const values = last3.map(f => f.brightness);
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    }
    
    // Method 3: Rate of change (sudden acceleration/deceleration)
    let rateChange = 0;
    if (frames.length >= 4) {
      const f1 = frames[frames.length - 1];
      const f2 = frames[frames.length - 2];
      const f3 = frames[frames.length - 3];
      const f4 = frames[frames.length - 4];
      
      const change1 = Math.abs(f1.brightness - f2.brightness);
      const change2 = Math.abs(f2.brightness - f3.brightness);
      const change3 = Math.abs(f3.brightness - f4.brightness);
      
      rateChange = Math.max(change1, change2, change3);
    }
    
    // Combine all methods for better detection
    const combinedMotion = Math.max(brightnessDiff, variance * 5, rateChange, edgeDiff * 0.5);
    
    // Update motion display for debugging
    setCurrentMotion(combinedMotion);
    
    // Convert jumpThreshold to actual sensitivity with much more aggressive scaling
    // At 100% sensitivity, threshold should be very low (1)
    // At 10% sensitivity, threshold should be high (50)
    const motionThreshold = Math.max(1, (101 - jumpThreshold) / 1);
    
    // If there's significant motion
    if (combinedMotion > motionThreshold) {
      console.log('🎯 JUMP DETECTED!');
      onJump();
      // Also try direct spacebar simulation as backup
      const spaceEvent = new KeyboardEvent('keydown', {
        keyCode: 32,
        code: 'Space',
        key: ' ',
        bubbles: true
      });
      document.dispatchEvent(spaceEvent);
      lastJumpTimeRef.current = currentTime;
      return true;
    }
    
    return false;
  }, [jumpThreshold, onJump, setCurrentMotion]);

  // Motion detection loop
  useEffect(() => {
    let animationId;

    const detectMotion = () => {
      if (videoRef.current && canvasRef.current && isDetecting && isGameActive) {
        try {
          const canvas = canvasRef.current;
          const ctx = canvas.getContext('2d');
          const video = videoRef.current;
          
          // Draw current frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Get image data
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Calculate multiple motion metrics for better detection
          let totalBrightness = 0;
          let edgeIntensity = 0;
          let pixelCount = 0;
          
          // Only analyze the upper 60% of the frame (where jumping motion is most visible)
          const analyzeHeight = Math.floor(canvas.height * 0.6);
          
          for (let y = 1; y < analyzeHeight - 1; y++) {
            for (let x = 1; x < canvas.width - 1; x++) {
              const i = (y * canvas.width + x) * 4;
              const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
              totalBrightness += brightness;
              
              // Calculate edge intensity (detects motion boundaries)
              const rightI = (y * canvas.width + (x + 1)) * 4;
              const bottomI = ((y + 1) * canvas.width + x) * 4;
              
              const rightBrightness = (data[rightI] + data[rightI + 1] + data[rightI + 2]) / 3;
              const bottomBrightness = (data[bottomI] + data[bottomI + 1] + data[bottomI + 2]) / 3;
              
              const horizontalEdge = Math.abs(brightness - rightBrightness);
              const verticalEdge = Math.abs(brightness - bottomBrightness);
              edgeIntensity += Math.sqrt(horizontalEdge * horizontalEdge + verticalEdge * verticalEdge);
              
              pixelCount++;
            }
          }
          
          const avgBrightness = totalBrightness / pixelCount;
          const avgEdgeIntensity = edgeIntensity / pixelCount;
          
          // Store frame data with multiple metrics
          const frameData = {
            brightness: avgBrightness,
            edgeIntensity: avgEdgeIntensity,
            timestamp: Date.now()
          };
          
          // Keep only recent frames (last 1 second) and add new frame
          const now = Date.now();
          setPreviousFrames(prevFrames => {
            const updatedFrames = [...prevFrames, frameData].filter(
              frame => now - frame.timestamp < 1000
            );
            
            // Detect jump based on motion patterns
            detectJump(updatedFrames, now);
            
            return updatedFrames;
          });
          
        } catch (error) {
          console.error('Error detecting motion:', error);
        }
      }
      
      if (isDetecting && isGameActive) {
        animationId = requestAnimationFrame(detectMotion);
      }
    };

    if (isDetecting && isGameActive) {
      detectMotion();
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [isDetecting, isGameActive, detectJump]);

  return (
    <div style={{ 
      position: 'fixed', 
      top: 10, 
      right: 10, 
      zIndex: 1000,
      border: '2px solid #333',
      borderRadius: '8px',
      background: '#000'
    }}>
      <div style={{ position: 'relative' }}>
        <video 
          ref={videoRef}
          width="320"
          height="240"
          style={{ display: 'block' }}
          muted
          playsInline
        />
        <canvas 
          ref={canvasRef}
          width="320"
          height="240"
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0,
            pointerEvents: 'none'
          }}
        />
      </div>
      <div style={{ 
        padding: '5px', 
        color: 'white', 
        fontSize: '12px',
        textAlign: 'center'
      }}>
        {isDetecting ? '🟢 Jump Detection Active' : '🔴 Initializing...'}
      </div>
      <div style={{ 
        padding: '5px', 
        color: 'white', 
        fontSize: '10px',
        textAlign: 'center'
      }}>
        Sensitivity: {jumpThreshold}
        <br />
        <input 
          type="range" 
          min="10" 
          max="100" 
          step="5" 
          value={jumpThreshold}
          onChange={(e) => setJumpThreshold(Number(e.target.value))}
          style={{ margin: '5px', width: '80px' }}
        />
        <br />
        Low ← → High
        <br />
        Motion: {currentMotion.toFixed(1)} | Need: {Math.max(1, (101 - jumpThreshold) / 1).toFixed(1)}
        <br />
        <button 
          onClick={() => {
            console.log('🧪 Manual jump test - calling onJump()');
            onJump();
            // Also try direct spacebar simulation as backup
            const spaceEvent = new KeyboardEvent('keydown', {
              keyCode: 32,
              code: 'Space',
              key: ' ',
              bubbles: true
            });
            document.dispatchEvent(spaceEvent);
          }}
          style={{
            margin: '2px',
            padding: '2px 8px',
            fontSize: '10px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          Test Jump
        </button>
      </div>
    </div>
  );
};

export default CameraJumpDetector;
