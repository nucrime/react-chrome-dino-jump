import React from 'react';

import Resources from './Resources.js';
import DinoScript from './DinoScript.js';
import DinoStyle from './DinoStyle.js';
import CameraJumpDetector from './CameraJumpDetector.js';

import './Dino.css';

class ChromeDinoComponent extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      gameActive: false
    };
    this.runnerInstance = null;
  }

  appendDinoScript() {
    let dinoScriptContainer = document.createElement("script");
    dinoScriptContainer.appendChild(document.createTextNode(DinoScript)); 
    this.startDiv.appendChild(dinoScriptContainer);
  }

  appendRunnerScript() {
    let runnerScriptContainer = document.createElement("script");
    runnerScriptContainer.appendChild(document.createTextNode(`new Runner('.interstitial-wrapper');`)); 

    this.endDiv.appendChild(runnerScriptContainer);
  }

  // Function to simulate spacebar press for jump
  simulateJump = () => {
    console.log('simulateJump called');
    
    if (typeof window !== 'undefined' && window.Runner && window.Runner.instance_) {
      const runner = window.Runner.instance_;
      console.log('Runner instance found, triggering jump');
      
      // Simulate keydown event for spacebar (keyCode 32)
      const spaceEvent = new KeyboardEvent('keydown', {
              keyCode: 32,
              code: 'Space',
              key: ' ',
              bubbles: true
            });
      
      // Trigger the jump action
      document.dispatchEvent(spaceEvent);
      console.log('✅ Camera jump triggered successfully!');
    } else {
      console.log('❌ Runner instance not available:', {
        windowExists: typeof window !== 'undefined',
        runnerExists: window?.Runner,
        instanceExists: window?.Runner?.instance_
      });
      
      // Fallback: try dispatching the event to document
      const spaceEvent = new KeyboardEvent('keydown', {
        keyCode: 32,
        code: 'Space',
        key: ' ',
        bubbles: true
      });
      document.dispatchEvent(spaceEvent);
      console.log('📤 Dispatched spacebar event as fallback');
    }
  }

  componentDidMount() {
    this.appendDinoScript();
    this.appendRunnerScript();
    
    // Set game as active after a short delay to ensure Runner is initialized
    setTimeout(() => {
      this.setState({ gameActive: true });
    }, 1000);
  }

    render() {
        return (
          <div ref={el => (this.startDiv = el)}>
            <style>{DinoStyle}</style>
            <div id="main-frame-error" className="interstitial-wrapper">
              <Resources />
              <div ref={el => (this.endDiv = el)}>
              </div>
            </div>
            <CameraJumpDetector 
              onJump={this.simulateJump}
              isGameActive={this.state.gameActive}
            />
          </div>
        );
    }
}

export default ChromeDinoComponent;
