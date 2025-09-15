document.addEventListener("DOMContentLoaded", () => {
  // Preloader elements
  const preloader = document.getElementById('preloader');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  
  const canvas = document.getElementById("scrollCanvas");
  const context = canvas.getContext("2d");
  
  if (!canvas) {
    console.error('Canvas element not found!');
    return;
  }

  // Create debug display for frame number
  const debugDisplay = document.createElement('div');
  debugDisplay.id = 'frameDebugDisplay';
  debugDisplay.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    font-family: 'Inter', sans-serif;
    font-size: 14px;
    font-weight: 500;
    z-index: 1000;
    pointer-events: none;
    user-select: none;
    display: none;
  `;
  debugDisplay.textContent = 'Frame: 1';
  document.body.appendChild(debugDisplay);

  // Debug display toggle functionality
  let debugVisible = false;
  
  function toggleDebugDisplay() {
    debugVisible = !debugVisible;
    debugDisplay.style.display = debugVisible ? 'block' : 'none';
  }

  // Add keyboard shortcut to toggle debug display (press 'D' key)
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'd' && !e.ctrlKey && !e.altKey && !e.metaKey) {
      // Only toggle if not typing in an input field
      if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        toggleDebugDisplay();
      }
    }
  });

  // Noise setup
  const noiseBG = document.getElementById('noiseBG');
  if (noiseBG) {
    staticAnimate(noiseBG);
  }
  
  // CONFIGURATION
  const totalFrames = 841;
  const maxCacheSize = 841;
  const preloadBuffer = 30;
  let currentFrame = 1;
  
  let lastScrollProgress = 0;
  let lastTime = performance.now();
  const frameCache = new Map();
  let lastRenderedFrame = null;
  let framesLoaded = 0;
  
  const framePaths = Array.from({ length: totalFrames }, (_, i) =>
    `assets/frames/frame-${String(i + 1).padStart(4, "0")}.webp`
  );
  
  const worker = new Worker("frameWorker.js");
  
  // Store previous percentage to detect changes
  let previousPercentage = 0;
  
  // Hero image element
  const heroImage = document.getElementById('heroImage');
  
  // Initialize hero image animations
  function initHeroAnimations() {
    if (heroImage) {
      // Basic scale up and down loop animation
      gsap.to(heroImage, {
        scale: 1.25,
        duration: 2,
        ease: "power2.inOut",
        yoyo: true,
        repeat: -1
      });
      
      // Mouse move parallax effect
      document.addEventListener('mousemove', (e) => {
        const x = (e.clientX / window.innerWidth) - 0.5;
        const y = (e.clientY / window.innerHeight) - 0.5;
        
        gsap.to(heroImage, {
          x: x * 20,
          y: y * 20,
          duration: 0.5,
          ease: "power2.out"
        });
      });
    }
  }
  
  // Initialize animations when hero image loads
  if (heroImage) {
    heroImage.addEventListener('load', initHeroAnimations);
    // If image is already loaded
    if (heroImage.complete) {
      initHeroAnimations();
    }
  }
  
  // Update progress bar
  function updateProgress(loaded, total) {
    const percentage = Math.round((loaded / total) * 100);
    progressFill.style.width = percentage + '%';
    
    // Only animate if percentage has changed
    if (percentage !== previousPercentage) {
      const percentageStr = percentage.toString();
      const previousStr = previousPercentage.toString();
      
      // Pad with leading zeros for comparison
      const maxLength = Math.max(percentageStr.length, previousStr.length);
      const currentPadded = percentageStr.padStart(maxLength, '0');
      const previousPadded = previousStr.padStart(maxLength, '0');
      
      // Create HTML with rotation only for changed digits
      progressText.innerHTML = currentPadded.split('').map((digit, index) => {
        const isChanged = digit !== previousPadded[index];
        return `<span class="${isChanged ? 'rotate-digit' : ''}" style="--i: ${index}">${digit}</span>`;
      }).join('');
      
      previousPercentage = percentage;
    }
  }
  
  // Hide preloader and show main content
  function hidePreloader() {
    preloader.classList.add('hidden');
    setTimeout(() => {
      // Reset scroll position to top
      window.scrollTo(0, 0);
      initializeMainSystem();
      // Auto-scroll 25 frames after loading
      autoScrollFrames(25);
    }, 500);
  }
  
  // Auto-scroll function to scroll a specific number of frames
  function autoScrollFrames(frameCount) {
    const currentScrollY = window.scrollY || window.pageYOffset;
    const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
    const frameHeight = scrollHeight / (totalFrames - 1);
    const targetScrollY = currentScrollY + (frameCount * frameHeight);
    
    // Ensure we don't scroll beyond the maximum scroll height
    const maxScrollY = Math.min(targetScrollY, scrollHeight);
    
    // Use Lenis smooth scroll if available, otherwise use native smooth scroll
    if (window.lenis && typeof window.lenis.scrollTo === 'function') {
      window.lenis.scrollTo(maxScrollY, { 
        duration: 2.0, 
        easing: (t) => t * (2 - t) // ease-out
      });
    } else {
      window.scrollTo({ 
        top: maxScrollY, 
        behavior: 'smooth' 
      });
    }
  }
  
  // Initialize main system after all frames are loaded
  function initializeMainSystem() {
    // Set scroll spacer height
    const scrollSpacer = document.querySelector('.scroll-spacer');
    if (scrollSpacer) {
      const frameHeight = Math.max(window.innerHeight, 800);
      const totalScrollHeight = totalFrames * (frameHeight / 30);
      scrollSpacer.style.height = `${totalScrollHeight}px`;
    }
    
    // Always start at frame 1, regardless of scroll position
    currentFrame = 1;
    renderFrame(currentFrame);
    updateContentVisibility(currentFrame);
    
    
    // Header: scroll progress
    const progressFillEl = document.getElementById('scrollProgressFill');
    function updateScrollProgress(progress01) {
      if (progressFillEl) {
        progressFillEl.style.width = Math.round(progress01 * 100) + '%';
      }
    }

    // Header: menu toggle logic
    const menuToggleBtn = document.getElementById('menuToggle');
    const menuPanel = document.getElementById('menuPanel');
    const menuIcon = document.getElementById('menuIcon');
    let isMenuOpen = false;
    const menuOverlay = document.getElementById('menuOverlay');
    const menuCloseBtn = document.getElementById('menuClose');

    function setMenuState(open) {
      isMenuOpen = open;
      if (!menuPanel || !menuToggleBtn || !menuIcon) return;

      // Toggle classes
      menuPanel.classList.toggle('open', open);
      if (menuOverlay) menuOverlay.classList.toggle('open', open);

      // Accessibility + icon
      menuToggleBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      menuPanel.setAttribute('aria-hidden', open ? 'false' : 'true');
      menuOverlay?.setAttribute?.('aria-hidden', open ? 'false' : 'true');
      menuIcon.textContent = open ? '✕' : '▦';

      // GSAP animations
      if (window.gsap) {
        const items = menuPanel.querySelectorAll('.menu-item');
        if (open) {
          gsap.fromTo(menuToggleBtn, { scale: 1 }, { scale: 1.15, duration: 0.2, ease: 'power2.out', yoyo: true, repeat: 1 });
          gsap.fromTo(menuPanel, { y: 6, opacity: 0, scale: 0.96 }, { y: 0, opacity: 1, scale: 1, duration: 0.3, ease: 'power2.out' });
          if (items && items.length) {
            gsap.fromTo(items, { y: 12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.28, ease: 'power2.out', stagger: 0.06, delay: 0.06 });
          }
        } else {
          gsap.to(menuPanel, { y: 6, opacity: 0, scale: 0.98, duration: 0.22, ease: 'power2.in', onComplete: () => {
            menuPanel.classList.remove('open');
            if (menuOverlay) menuOverlay.classList.remove('open');
          } });
          if (items && items.length) {
            gsap.to(items, { y: 8, opacity: 0, duration: 0.16, ease: 'power2.in' });
          }
        }
      }
    }
    if (menuToggleBtn) {
      menuToggleBtn.addEventListener('click', () => setMenuState(!isMenuOpen));
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isMenuOpen) setMenuState(false);
    });

    if (menuCloseBtn) menuCloseBtn.addEventListener('click', () => setMenuState(false));
    if (menuOverlay) menuOverlay.addEventListener('click', () => setMenuState(false));

    // Lenis smooth scroll
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => t,
      smoothWheel: true,
      smoothTouch: false,
    });
    
    // Expose Lenis for navigation clicks
    window.lenis = lenis;

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    
    // GSAP ScrollTrigger with proper frame calculation
    gsap.registerPlugin(ScrollTrigger);
    
    
    // Create a timeline that directly controls frame progression
    const mainTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: document.body,
        start: "top top",
        end: "bottom bottom",
        scrub: 0.5,
        onUpdate: (self) => {
          const scrollProgress = self.progress;
          updateScrollProgress(scrollProgress);
          
          // Calculate frame based on scroll progress (0 to 1)
          let frameIndex = Math.round(scrollProgress * (totalFrames - 1)) + 1;
          frameIndex = Math.min(totalFrames, Math.max(1, frameIndex));
          
          // Only update if frame actually changed
          if (frameIndex !== currentFrame) {
            currentFrame = frameIndex;
            renderFrame(currentFrame);
            updateContentVisibility(currentFrame);
          }
        }
      }
    });
    
    // Add frame progression to timeline
    mainTimeline.to({}, { 
      duration: 1,
      onUpdate: function() {
        // This ensures the timeline is properly initialized
      }
    });
    
    // Canvas resize
    function resizeCanvas() {
      const container = document.querySelector('.container');
      if (container && canvas) {
        const rect = container.getBoundingClientRect();
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
      }
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
  }
  
  worker.addEventListener("message", async (e) => {
    if (e.data.type === "blobsLoaded") {
      for (const { blob, framePath } of e.data.payload) {
        const img = new Image();
        img.src = URL.createObjectURL(blob);
        await new Promise((res) => (img.onload = res));
        const index = framePaths.indexOf(framePath) + 1;
        frameCache.set(index, img);
        
        framesLoaded++;
        updateProgress(framesLoaded, totalFrames);
        
        if (framesLoaded === totalFrames) {
          hidePreloader();
        }
      }
    } else if (e.data.type === "error") {
      console.error("Frame loading error:", e.data.payload.error);
    }
  });
  
  function preloadFrames(index) {
    const start = Math.max(1, index - preloadBuffer);
    const end = Math.min(totalFrames, index + preloadBuffer);
    const priorityFrames = [];
    const regularFrames = [];
    
    for (let i = start; i <= end; i++) {
      if (!frameCache.has(i)) {
        if (i === index) {
          priorityFrames.push(framePaths[i - 1]);
        } else {
          regularFrames.push(framePaths[i - 1]);
        }
      }
    }
    
    if (priorityFrames.length > 0) {
      worker.postMessage({ type: "loadFrames", payload: { frames: priorityFrames } });
    }
    if (regularFrames.length > 0) {
      worker.postMessage({ type: "loadFrames", payload: { frames: regularFrames } });
    }
  }
  
  function renderFrame(index) {
    const img = frameCache.get(index);
    
    // Update debug display only if visible
    if (debugDisplay && debugVisible) {
      debugDisplay.textContent = `Frame: ${index}`;
    }
    
    if (!img) {
      let closestFrame = null;
      let minDistance = Infinity;
      for (let i = 1; i <= totalFrames; i++) {
        if (frameCache.has(i)) {
          const distance = Math.abs(i - index);
          if (distance < minDistance) {
            minDistance = distance;
            closestFrame = i;
          }
        }
      }
      if (closestFrame && closestFrame !== lastRenderedFrame) {
        drawFrameToCanvas(frameCache.get(closestFrame));
        lastRenderedFrame = closestFrame;
        // Update debug display for closest frame
        if (debugDisplay && debugVisible) {
          debugDisplay.textContent = `Frame: ${closestFrame} (closest to ${index})`;
        }
      }
      return;
    }
    
    drawFrameToCanvas(img);
    lastRenderedFrame = index;
    preloadFrames(index);
  }
  
  function drawFrameToCanvas(img) {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    canvas.width = viewportWidth;
    canvas.height = viewportHeight;
    
    const imgAspectRatio = img.width / img.height;
    const viewportAspectRatio = viewportWidth / viewportHeight;
    
    let drawWidth, drawHeight, offsetX, offsetY;
    if (imgAspectRatio > viewportAspectRatio) {
      drawHeight = viewportHeight;
      drawWidth = viewportHeight * imgAspectRatio;
      offsetX = (viewportWidth - drawWidth) / 2;
      offsetY = 0;
    } else {
      drawWidth = viewportWidth;
      drawHeight = viewportWidth / imgAspectRatio;
      offsetX = 0;
      offsetY = (viewportHeight - drawHeight) / 2;
    }
    
    context.clearRect(0, 0, viewportWidth, viewportHeight);
    context.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
  }
  
  function updateContentVisibility(frameIndex) {
    const frameBasedElements = document.querySelectorAll('[data-reveal-frame]');
    
    frameBasedElements.forEach((section) => {
      const revealFrame = parseInt(section.dataset.revealFrame);
      const frameDuration = parseInt(section.dataset.revealFrameDuration) || 50;
      const isVisible = frameIndex >= revealFrame && frameIndex < revealFrame + frameDuration;
      
      // Check if this is the first frame of visibility (for animation trigger)
      const isFirstFrameOfVisibility = frameIndex === revealFrame;
      
      if (isVisible) {
        // Show section if not already visible OR if it's the first frame of visibility
        if (section.classList.contains('content-hidden') || isFirstFrameOfVisibility) {
        section.classList.remove('content-hidden');
        section.classList.add('content-visible');
        
          // Check if this is the background overlay (no scale animation)
          if (section.classList.contains('agile-office-overlay') || section.classList.contains('ixer-overlay') || section.classList.contains('edgerp-overlay') || section.classList.contains('ixer2-overlay') || section.classList.contains('invoicedge-overlay') || section.classList.contains('telto-overlay') || section.classList.contains('demo-overlay') || section.classList.contains('demo2-overlay') || section.classList.contains('demo3-overlay') || section.classList.contains('demo4-overlay')) {
            // Simple fade in for background overlay
            section.style.opacity = '0';
            section.style.visibility = 'visible';
            section.style.transform = 'none';
            section.style.filter = 'none';
            
            gsap.to(section, { 
              opacity: 1,
              duration: 0.8,
              delay: 1.5,
              ease: "power2.out"
            });
          } else {
            // Scale in + blur in effect for content sections
        section.style.opacity = '1';
        section.style.visibility = 'visible';
        section.style.transform = 'translateY(0) scale(1)';
            section.style.filter = 'blur(0px)';
            
            // Check if this is the agile office section for staggered animation
            if (section.classList.contains('agile-office-section')) {
              // Animate individual elements with stagger
              const logo = section.querySelector('.agile-office-logo');
              const heading = section.querySelector('.agile-office-heading');
              const description = section.querySelector('.agile-office-description');
              const button = section.querySelector('.explore-button');
              
              // No need to set transform origin since we're not using scale animation
              
              // Animate with stagger using fromTo
              gsap.fromTo([logo, heading, description, button], {
                opacity: 0,
                y: 30
              }, {
                opacity: 1,
                y: 0,
                duration: 0.6,
                stagger: 0.2,
                ease: "power2.out"
              });
            } else if (section.classList.contains('ixer-section')) {
              // Animate individual elements with stagger for Ixer section
              const logo = section.querySelector('.ixer-logo');
              const heading = section.querySelector('.ixer-heading');
              const description = section.querySelector('.ixer-description');
              const button = section.querySelector('.explore-button');
              
              // Animate with stagger using fromTo
              gsap.fromTo([logo, heading, description, button], {
                opacity: 0,
                y: 30
              }, {
                opacity: 1,
                y: 0,
                duration: 0.6,
                stagger: 0.2,
                ease: "power2.out"
              });
            } else if (section.classList.contains('edgerp-section')) {
              // Animate individual elements with stagger for Edgerp section
              const logo = section.querySelector('.edgerp-logo');
              const heading = section.querySelector('.edgerp-heading');
              const description = section.querySelector('.edgerp-description');
              const button = section.querySelector('.explore-button');
              
              // Animate with stagger using fromTo
              gsap.fromTo([logo, heading, description, button], {
                opacity: 0,
                y: 30
              }, {
                opacity: 1,
                y: 0,
                duration: 0.6,
                stagger: 0.2,
                ease: "power2.out"
              });
            } else if (section.classList.contains('ixer2-section')) {
              // Animate individual elements with stagger for Ixer 2 section
              const logo = section.querySelector('.ixer2-logo');
              const heading = section.querySelector('.ixer2-heading');
              const description = section.querySelector('.ixer2-description');
              const button = section.querySelector('.explore-button');
              
              // Animate with stagger using fromTo
              gsap.fromTo([logo, heading, description, button], {
                opacity: 0,
                y: 30
              }, {
                opacity: 1,
                y: 0,
                duration: 0.6,
                stagger: 0.2,
                ease: "power2.out"
              });
            } else if (section.classList.contains('invoicedge-section')) {
              // Animate individual elements with stagger for Invoicedge section
              const logo = section.querySelector('.invoicedge-logo');
              const heading = section.querySelector('.invoicedge-heading');
              const description = section.querySelector('.invoicedge-description');
              const button = section.querySelector('.explore-button');
              
              // Animate with stagger using fromTo
              gsap.fromTo([logo, heading, description, button], {
                opacity: 0,
                y: 30
              }, {
                opacity: 1,
                y: 0,
                duration: 0.6,
                stagger: 0.2,
                ease: "power2.out"
              });
            } else if (section.classList.contains('telto-section')) {
              // Animate individual elements with stagger for Telto section
              const logo = section.querySelector('.telto-logo');
              const heading = section.querySelector('.telto-heading');
              const description = section.querySelector('.telto-description');
              const button = section.querySelector('.explore-button');
              
              // Animate with stagger using fromTo
              gsap.fromTo([logo, heading, description, button], {
                opacity: 0,
                y: 30
              }, {
                opacity: 1,
                y: 0,
                duration: 0.6,
                stagger: 0.2,
                ease: "power2.out"
              });
            } else if (section.classList.contains('demo-section')) {
              // Animate individual elements with stagger for Demo section
              const logo = section.querySelector('.demo-logo');
              const heading = section.querySelector('.demo-heading');
              const description = section.querySelector('.demo-description');
              const button = section.querySelector('.explore-button');
              
              // Animate with stagger using fromTo
              gsap.fromTo([logo, heading, description, button], {
                opacity: 0,
                y: 30
              }, {
                opacity: 1,
                y: 0,
                duration: 0.6,
                stagger: 0.2,
                ease: "power2.out"
              });
            } else if (section.classList.contains('demo2-section')) {
              // Animate individual elements with stagger for Demo 2 section
              const logo = section.querySelector('.demo2-logo');
              const heading = section.querySelector('.demo2-heading');
              const description = section.querySelector('.demo2-description');
              const button = section.querySelector('.explore-button');
              
              // Animate with stagger using fromTo
              gsap.fromTo([logo, heading, description, button], {
                opacity: 0,
                y: 30
              }, {
                opacity: 1,
                y: 0,
                duration: 0.6,
                stagger: 0.2,
                ease: "power2.out"
              });
            } else if (section.classList.contains('demo3-section')) {
              // Animate individual elements with stagger for Demo 3 section
              const logo = section.querySelector('.demo3-logo');
              const heading = section.querySelector('.demo3-heading');
              const description = section.querySelector('.demo3-description');
              const button = section.querySelector('.explore-button');
              
              // Animate with stagger using fromTo
              gsap.fromTo([logo, heading, description, button], {
                opacity: 0,
                y: 30
              }, {
                opacity: 1,
                y: 0,
                duration: 0.6,
                stagger: 0.2,
                ease: "power2.out"
              });
            } else if (section.classList.contains('demo4-section')) {
              // Animate individual elements with stagger for Demo 4 section
              const logo = section.querySelector('.demo4-logo');
              const heading = section.querySelector('.demo4-heading');
              const description = section.querySelector('.demo4-description');
              const button = section.querySelector('.explore-button');
              
              // Animate with stagger using fromTo
              gsap.fromTo([logo, heading, description, button], {
                opacity: 0,
                y: 30
              }, {
                opacity: 1,
                y: 0,
                duration: 0.6,
                stagger: 0.2,
                ease: "power2.out"
              });
            } else {
              // Regular animation for other sections
              gsap.fromTo(section, { 
                opacity: 0, 
                scale: 0.3, 
                filter: 'blur(20px)',
                transformOrigin: 'center center'
              }, { 
                opacity: 1, 
                scale: 1, 
                filter: 'blur(0px)',
                duration: 0.3
              });
            }
          }
        } else if (section.classList.contains('content-visible')) {
          // Section is already visible, ensure it stays in the correct state
          if (section.classList.contains('agile-office-overlay') || section.classList.contains('ixer-overlay') || section.classList.contains('edgerp-overlay') || section.classList.contains('ixer2-overlay') || section.classList.contains('invoicedge-overlay') || section.classList.contains('telto-overlay') || section.classList.contains('demo-overlay') || section.classList.contains('demo2-overlay') || section.classList.contains('demo3-overlay') || section.classList.contains('demo4-overlay')) {
            section.style.opacity = '1';
            section.style.visibility = 'visible';
            section.style.transform = 'none';
            section.style.filter = 'none';
          } else {
            section.style.opacity = '1';
            section.style.visibility = 'visible';
            section.style.transform = 'scale(1)';
            section.style.filter = 'blur(0px)';
          }
        }
      } else {
        // Hide section if currently visible
        if (section.classList.contains('content-visible')) {
        section.classList.remove('content-visible');
        section.classList.add('content-hidden');
        
          if (section.classList.contains('agile-office-overlay') || section.classList.contains('ixer-overlay') || section.classList.contains('edgerp-overlay') || section.classList.contains('ixer2-overlay') || section.classList.contains('invoicedge-overlay') || section.classList.contains('telto-overlay') || section.classList.contains('demo-overlay') || section.classList.contains('demo2-overlay') || section.classList.contains('demo3-overlay') || section.classList.contains('demo4-overlay')) {
            // Simple fade out for background overlay
            gsap.to(section, { 
              opacity: 0,
              duration: 0.3,
              ease: "power2.in",
              onComplete: () => {
                section.style.opacity = '0';
                section.style.visibility = 'hidden';
              }
            });
          } else {
            // Check if this is the agile office section for staggered hide animation
            if (section.classList.contains('agile-office-section')) {
              // Animate individual elements out with reverse stagger
              const logo = section.querySelector('.agile-office-logo');
              const heading = section.querySelector('.agile-office-heading');
              const description = section.querySelector('.agile-office-description');
              const button = section.querySelector('.explore-button');
              
              // Animate out with reverse stagger (reverse order)
              gsap.to([button, description, heading, logo], {
                opacity: 0,
                y: -20,
                duration: 0.4,
                stagger: 0.15,
                ease: "power2.in",
                onComplete: () => {
                  section.style.opacity = '0';
                  section.style.visibility = 'hidden';
                }
              });
            } else if (section.classList.contains('ixer-section')) {
              // Animate individual elements out with reverse stagger for Ixer section
              const logo = section.querySelector('.ixer-logo');
              const heading = section.querySelector('.ixer-heading');
              const description = section.querySelector('.ixer-description');
              const button = section.querySelector('.explore-button');
              
              // Animate out with reverse stagger (reverse order)
              gsap.to([button, description, heading, logo], {
                opacity: 0,
                y: -20,
                duration: 0.4,
                stagger: 0.15,
                ease: "power2.in",
                onComplete: () => {
                  section.style.opacity = '0';
                  section.style.visibility = 'hidden';
                }
              });
            } else if (section.classList.contains('edgerp-section')) {
              // Animate individual elements out with reverse stagger for Edgerp section
              const logo = section.querySelector('.edgerp-logo');
              const heading = section.querySelector('.edgerp-heading');
              const description = section.querySelector('.edgerp-description');
              const button = section.querySelector('.explore-button');
              
              // Animate out with reverse stagger (reverse order)
              gsap.to([button, description, heading, logo], {
                opacity: 0,
                y: -20,
                duration: 0.4,
                stagger: 0.15,
                ease: "power2.in",
                onComplete: () => {
                  section.style.opacity = '0';
                  section.style.visibility = 'hidden';
                }
              });
            } else if (section.classList.contains('ixer2-section')) {
              // Animate individual elements out with reverse stagger for Ixer 2 section
              const logo = section.querySelector('.ixer2-logo');
              const heading = section.querySelector('.ixer2-heading');
              const description = section.querySelector('.ixer2-description');
              const button = section.querySelector('.explore-button');
              
              // Animate out with reverse stagger (reverse order)
              gsap.to([button, description, heading, logo], {
                opacity: 0,
                y: -20,
                duration: 0.4,
                stagger: 0.15,
                ease: "power2.in",
                onComplete: () => {
                  section.style.opacity = '0';
                  section.style.visibility = 'hidden';
                }
              });
            } else if (section.classList.contains('invoicedge-section')) {
              // Animate individual elements out with reverse stagger for Invoicedge section
              const logo = section.querySelector('.invoicedge-logo');
              const heading = section.querySelector('.invoicedge-heading');
              const description = section.querySelector('.invoicedge-description');
              const button = section.querySelector('.explore-button');
              
              // Animate out with reverse stagger (reverse order)
              gsap.to([button, description, heading, logo], {
                opacity: 0,
                y: -20,
                duration: 0.4,
                stagger: 0.15,
                ease: "power2.in",
                onComplete: () => {
                  section.style.opacity = '0';
                  section.style.visibility = 'hidden';
                }
              });
            } else if (section.classList.contains('telto-section')) {
              // Animate individual elements out with reverse stagger for Telto section
              const logo = section.querySelector('.telto-logo');
              const heading = section.querySelector('.telto-heading');
              const description = section.querySelector('.telto-description');
              const button = section.querySelector('.explore-button');
              
              // Animate out with reverse stagger (reverse order)
              gsap.to([button, description, heading, logo], {
                opacity: 0,
                y: -20,
                duration: 0.4,
                stagger: 0.15,
                ease: "power2.in",
                onComplete: () => {
                  section.style.opacity = '0';
                  section.style.visibility = 'hidden';
                }
              });
            } else if (section.classList.contains('demo-section')) {
              // Animate individual elements out with reverse stagger for Demo section
              const logo = section.querySelector('.demo-logo');
              const heading = section.querySelector('.demo-heading');
              const description = section.querySelector('.demo-description');
              const button = section.querySelector('.explore-button');
              
              // Animate out with reverse stagger (reverse order)
              gsap.to([button, description, heading, logo], {
                opacity: 0,
                y: -20,
                duration: 0.4,
                stagger: 0.15,
                ease: "power2.in",
                onComplete: () => {
        section.style.opacity = '0';
        section.style.visibility = 'hidden';
                }
              });
            } else if (section.classList.contains('demo2-section')) {
              // Animate individual elements out with reverse stagger for Demo 2 section
              const logo = section.querySelector('.demo2-logo');
              const heading = section.querySelector('.demo2-heading');
              const description = section.querySelector('.demo2-description');
              const button = section.querySelector('.explore-button');
              
              // Animate out with reverse stagger (reverse order)
              gsap.to([button, description, heading, logo], {
                opacity: 0,
                y: -20,
                duration: 0.4,
                stagger: 0.15,
                ease: "power2.in",
                onComplete: () => {
                  section.style.opacity = '0';
                  section.style.visibility = 'hidden';
                }
              });
            } else if (section.classList.contains('demo3-section')) {
              // Animate individual elements out with reverse stagger for Demo 3 section
              const logo = section.querySelector('.demo3-logo');
              const heading = section.querySelector('.demo3-heading');
              const description = section.querySelector('.demo3-description');
              const button = section.querySelector('.explore-button');
              
              // Animate out with reverse stagger (reverse order)
              gsap.to([button, description, heading, logo], {
                opacity: 0,
                y: -20,
                duration: 0.4,
                stagger: 0.15,
                ease: "power2.in",
                onComplete: () => {
                  section.style.opacity = '0';
                  section.style.visibility = 'hidden';
                }
              });
            } else if (section.classList.contains('demo4-section')) {
              // Animate individual elements out with reverse stagger for Demo 4 section
              const logo = section.querySelector('.demo4-logo');
              const heading = section.querySelector('.demo4-heading');
              const description = section.querySelector('.demo4-description');
              const button = section.querySelector('.explore-button');
              
              // Animate out with reverse stagger (reverse order)
              gsap.to([button, description, heading, logo], {
                opacity: 0,
                y: -20,
                duration: 0.4,
                stagger: 0.15,
                ease: "power2.in",
                onComplete: () => {
                  section.style.opacity = '0';
                  section.style.visibility = 'hidden';
                }
              });
        } else {
              // Scale to 0 + blur out effect for other content sections
              gsap.to(section, { 
                scale: 0, 
                filter: 'blur(15px)',
                transformOrigin: 'center center',
                duration: 0.3, 
                onComplete: () => {
                  section.style.opacity = '0';
                  section.style.visibility = 'hidden';
                  section.style.transform = 'scale(0)';
                  section.style.filter = 'blur(15px)';
        }
      });
    }
          }
        } else if (section.classList.contains('content-hidden')) {
          // Section is already hidden, ensure it stays in the correct state
          if (section.classList.contains('agile-office-overlay') || section.classList.contains('ixer-overlay') || section.classList.contains('edgerp-overlay') || section.classList.contains('ixer2-overlay') || section.classList.contains('invoicedge-overlay') || section.classList.contains('telto-overlay') || section.classList.contains('demo-overlay') || section.classList.contains('demo2-overlay') || section.classList.contains('demo3-overlay') || section.classList.contains('demo4-overlay')) {
            section.style.opacity = '0';
            section.style.visibility = 'hidden';
            section.style.transform = 'none';
            section.style.filter = 'none';
          } else {
            section.style.opacity = '0';
            section.style.visibility = 'hidden';
            section.style.transform = 'scale(0.3)';
            section.style.filter = 'blur(20px)';
          }
        }
      }
    });
  }
  
  // Static noise animation function
  function staticAnimate(object) {
    TweenMax.to(object, 0.03, {
      backgroundPosition: Math.floor(Math.random() * 100) + 1 + "% " + Math.floor(Math.random() * 10) + 1 + "%", 
      onComplete: staticAnimate,
      onCompleteParams: [object],
      ease: SteppedEase.config(1)
    });
  }
  
  updateProgress(0, totalFrames);
  
  const batchSize = 50;
  for (let i = 0; i < totalFrames; i += batchSize) {
    const batch = framePaths.slice(i, i + batchSize);
    setTimeout(() => {
      worker.postMessage({ type: "loadFrames", payload: { frames: batch } });
    }, i * 10);
  }
  
  function cleanup() {
    frameCache.forEach(img => {
      if (img.src) {
        URL.revokeObjectURL(img.src);
      }
    });
    worker.terminate();
    frameCache.clear();
    
    // Remove debug display
    if (debugDisplay && debugDisplay.parentNode) {
      debugDisplay.parentNode.removeChild(debugDisplay);
    }
  }
  
  window.addEventListener('beforeunload', cleanup);
  
  worker.addEventListener('error', (error) => {
    console.error('Web Worker error:', error);
  });


});